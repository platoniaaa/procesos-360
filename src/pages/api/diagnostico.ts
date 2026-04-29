export const prerender = false;

import type { APIRoute } from 'astro';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { DIAGNOSTIC_SYSTEM_PROMPT } from '../../lib/pemm-knowledge';
import {
  scoreExpress,
  scoreCompleto,
  type AssessmentResult,
  type Mode,
  type Rating,
} from '../../lib/pemm-scoring';
import { getSupabaseAdmin } from '../../lib/supabase';
import { sendDiagnosticoLeadNotification, sendDiagnosticoReportToLead } from '../../lib/email';

interface DiagnosticPayload {
  lead: {
    nombre: string;
    email: string;
    empresa: string;
    cargo?: string;
    telefono?: string;
  };
  type: 'empresa' | 'proceso' | 'ambos';
  mode: Mode;
  procesoNombre?: string | null;
  answers: {
    empresa?: Record<string, number | { L1: Rating; L2: Rating; L3: Rating; L4: Rating }>;
    proceso?: Record<string, number | { L1: Rating; L2: Rating; L3: Rating; L4: Rating }>;
  };
}

function buildResults(payload: DiagnosticPayload): AssessmentResult[] {
  const out: AssessmentResult[] = [];
  if ((payload.type === 'empresa' || payload.type === 'ambos') && payload.answers.empresa) {
    const fn = payload.mode === 'express' ? scoreExpress : scoreCompleto;
    out.push(fn('empresa', payload.answers.empresa as any));
  }
  if ((payload.type === 'proceso' || payload.type === 'ambos') && payload.answers.proceso) {
    const fn = payload.mode === 'express' ? scoreExpress : scoreCompleto;
    out.push(fn('proceso', payload.answers.proceso as any));
  }
  return out;
}

function formatResultsForPrompt(payload: DiagnosticPayload, results: AssessmentResult[]): string {
  const lines: string[] = [];
  lines.push(`# Datos del lead`);
  lines.push(`- Empresa: ${payload.lead.empresa}`);
  lines.push(`- Nombre: ${payload.lead.nombre}`);
  if (payload.lead.cargo) lines.push(`- Cargo: ${payload.lead.cargo}`);
  lines.push(`- Modalidad: ${payload.mode === 'express' ? 'Express (1 pregunta por dimensión)' : 'Completo (escala V/A/N por afirmación)'}`);
  if (payload.procesoNombre) lines.push(`- Proceso evaluado: ${payload.procesoNombre}`);
  lines.push('');

  for (const r of results) {
    lines.push(`# Resultados — ${r.type === 'empresa' ? 'Empresa' : `Proceso "${payload.procesoNombre || 'no especificado'}"`}`);
    lines.push(`Nivel global: ${r.overallLabel} (score numérico ${r.overallLevel.toFixed(2)} sobre 4.0)`);
    lines.push('');
    lines.push('## Por categoría');
    for (const c of r.categoryAverages) {
      lines.push(`- ${c.category}: ${c.level.toFixed(2)} / 4.0`);
    }
    lines.push('');
    lines.push('## Por dimensión');
    for (const d of r.dimensions) {
      lines.push(`- ${d.category} → ${d.dimension}: ${d.levelLabel} (${d.level.toFixed(2)})`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

async function generateDiagnostic(payload: DiagnosticPayload, results: AssessmentResult[]): Promise<string> {
  const apiKey = import.meta.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const userPrompt = `Genera el diagnóstico personalizado para este lead. Devuelve ÚNICAMENTE HTML con tags <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>. Sin <html>, <head>, <body>. Sin markdown.

${formatResultsForPrompt(payload, results)}`;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: DIAGNOSTIC_SYSTEM_PROMPT,
  });

  const result = await model.generateContent(userPrompt);
  const text = result.response.text();
  return cleanHtml(text);
}

function cleanHtml(html: string): string {
  // Strip code fences if Gemini wrapped the output
  let s = html.trim();
  s = s.replace(/^```(?:html)?\s*/i, '').replace(/```\s*$/, '');
  // Strip surrounding doctype/body if present
  s = s.replace(/<!DOCTYPE[^>]*>/i, '');
  s = s.replace(/<\/?(?:html|head|body)[^>]*>/gi, '');
  return s.trim();
}

async function saveLead(payload: DiagnosticPayload, results: AssessmentResult[], diagnosticHtml: string) {
  try {
    const supabase = getSupabaseAdmin();
    const overall: Record<string, any> = {};
    for (const r of results) {
      overall[r.type] = {
        overallLabel: r.overallLabel,
        overallLevel: Number(r.overallLevel.toFixed(2)),
        categories: r.categoryAverages,
        dimensions: r.dimensions,
      };
    }

    const conversacion = {
      kind: 'diagnostico',
      type: payload.type,
      mode: payload.mode,
      procesoNombre: payload.procesoNombre || null,
      cargo: payload.lead.cargo || null,
      results: overall,
      diagnosticHtml,
      generated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('leads').insert({
      source: 'diagnostico',
      nombre: payload.lead.nombre,
      email: payload.lead.email,
      telefono: payload.lead.telefono || null,
      empresa: payload.lead.empresa,
      servicio: 'Diagnóstico PEMM',
      desafio: results.map(r => `${r.type}: ${r.overallLabel}`).join(' · '),
      conversacion,
      estado: 'nuevo',
      notas: 'diagnostic_completed',
    });

    if (error) console.error('[diagnostico] Supabase error:', error.message);
  } catch (err: any) {
    console.error('[diagnostico] saveLead error:', err?.message || err);
  }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const payload = (await request.json()) as DiagnosticPayload;

    // Validation
    if (!payload?.lead?.email || !payload.lead.nombre || !payload.lead.empresa) {
      return new Response(JSON.stringify({ error: 'missing_lead_fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!['empresa', 'proceso', 'ambos'].includes(payload.type)) {
      return new Response(JSON.stringify({ error: 'invalid_type' }), { status: 400 });
    }
    if (!['express', 'completo'].includes(payload.mode)) {
      return new Response(JSON.stringify({ error: 'invalid_mode' }), { status: 400 });
    }

    // Score
    const results = buildResults(payload);
    if (results.length === 0) {
      return new Response(JSON.stringify({ error: 'no_answers' }), { status: 400 });
    }

    // AI diagnostic
    let diagnosticHtml = '';
    try {
      diagnosticHtml = await generateDiagnostic(payload, results);
    } catch (err: any) {
      console.error('[diagnostico] Gemini error:', err?.message);
      diagnosticHtml = `<p>Estamos generando tu análisis personalizado. Mientras tanto, los puntajes calculados se muestran arriba. En unos minutos recibirás el reporte completo en tu correo.</p>`;
    }

    // Persist (don't block response)
    saveLead(payload, results, diagnosticHtml).catch(() => {});

    // Notify Procesos 360 + send report to lead (don't block response)
    sendDiagnosticoLeadNotification({
      lead: payload.lead,
      type: payload.type,
      mode: payload.mode,
      procesoNombre: payload.procesoNombre || null,
      results,
      diagnosticHtml,
    }).catch(() => {});

    sendDiagnosticoReportToLead({
      lead: payload.lead,
      type: payload.type,
      procesoNombre: payload.procesoNombre || null,
      results,
      diagnosticHtml,
    }).catch(() => {});

    return new Response(
      JSON.stringify({
        success: true,
        results: results.map(r => ({
          type: r.type,
          mode: r.mode,
          overallLabel: r.overallLabel,
          overallLevel: r.overallLevel,
          categoryAverages: r.categoryAverages,
          dimensions: r.dimensions,
        })),
        diagnosticHtml,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[diagnostico] Error:', err?.message);
    return new Response(JSON.stringify({ error: 'server_error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
