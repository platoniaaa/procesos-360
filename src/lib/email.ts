import { Resend } from 'resend';

const resendApiKey = import.meta.env.RESEND_API_KEY;
const notificationEmail = import.meta.env.NOTIFICATION_EMAIL || 'ignacio.calderon237@gmail.com';
const fromAddress = import.meta.env.RESEND_FROM || 'Procesos 360 Leads <onboarding@resend.dev>';

interface FormLeadData {
  nombre: string;
  email: string;
  telefono?: string;
  empresa?: string;
  servicio: string;
  desafio: string;
}

interface ChatLeadData {
  email?: string | null;
  telefono?: string | null;
  desafio?: string | null;
  conversation?: { role: string; content: string }[];
  sessionId?: string;
}

function escapeHtml(s: string | null | undefined): string {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function sendFormLeadNotification(data: FormLeadData) {
  if (!resendApiKey) {
    console.warn('[email] RESEND_API_KEY not set, skipping notification');
    return;
  }

  try {
    const resend = new Resend(resendApiKey);
    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <div style="background:linear-gradient(135deg,#1E3A8A,#1E5BFF);color:#fff;padding:24px;border-radius:12px 12px 0 0;">
          <h1 style="margin:0;font-size:22px;">📩 Nuevo lead desde el formulario</h1>
          <p style="margin:6px 0 0;opacity:0.85;font-size:14px;">procesos360.cl</p>
        </div>
        <div style="background:#fff;border:1px solid #eee;border-top:none;padding:24px;border-radius:0 0 12px 12px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px 0;color:#666;width:140px;">Nombre</td><td style="padding:8px 0;font-weight:600;">${escapeHtml(data.nombre)}</td></tr>
            <tr><td style="padding:8px 0;color:#666;">Email</td><td style="padding:8px 0;"><a href="mailto:${escapeHtml(data.email)}" style="color:#1E5BFF;">${escapeHtml(data.email)}</a></td></tr>
            ${data.telefono ? `<tr><td style="padding:8px 0;color:#666;">WhatsApp</td><td style="padding:8px 0;"><a href="https://wa.me/${escapeHtml(data.telefono.replace(/\D/g, ''))}" style="color:#1E5BFF;">${escapeHtml(data.telefono)}</a></td></tr>` : ''}
            ${data.empresa ? `<tr><td style="padding:8px 0;color:#666;">Empresa</td><td style="padding:8px 0;">${escapeHtml(data.empresa)}</td></tr>` : ''}
            <tr><td style="padding:8px 0;color:#666;">Servicio</td><td style="padding:8px 0;">${escapeHtml(data.servicio)}</td></tr>
          </table>
          <div style="margin-top:18px;padding-top:18px;border-top:1px solid #eee;">
            <div style="color:#666;font-size:13px;margin-bottom:8px;">Desafío principal:</div>
            <div style="background:#faf7f0;padding:14px;border-radius:8px;border-left:3px solid #1E5BFF;font-size:14px;line-height:1.5;color:#333;white-space:pre-wrap;">${escapeHtml(data.desafio)}</div>
          </div>
        </div>
        <p style="text-align:center;color:#999;font-size:12px;margin-top:16px;">Recibido vía Procesos 360 · ${new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' })}</p>
      </div>
    `;

    await resend.emails.send({
      from: fromAddress,
      to: notificationEmail,
      replyTo: data.email,
      subject: `📩 Nuevo lead: ${data.nombre} (${data.servicio})`,
      html,
    });
  } catch (err: any) {
    console.error('[email] Form notification failed:', err.message);
  }
}

export async function sendChatLeadNotification(data: ChatLeadData) {
  if (!resendApiKey) {
    console.warn('[email] RESEND_API_KEY not set, skipping notification');
    return;
  }

  try {
    const resend = new Resend(resendApiKey);

    const transcript = (data.conversation || [])
      .map(m => {
        const who = m.role === 'user' ? '👤 Usuario' : '🤖 Procesos 360';
        return `<div style="margin-bottom:10px;"><div style="font-size:11px;color:#888;margin-bottom:2px;">${who}</div><div style="background:${m.role === 'user' ? '#f3f4f6' : '#F3E8FF'};padding:8px 12px;border-radius:8px;font-size:13px;line-height:1.5;color:#333;white-space:pre-wrap;">${escapeHtml(m.content)}</div></div>`;
      })
      .join('');

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <div style="background:linear-gradient(135deg,#1E3A8A,#1E5BFF);color:#fff;padding:24px;border-radius:12px 12px 0 0;">
          <h1 style="margin:0;font-size:22px;">🤖 Nuevo lead capturado por la IA</h1>
          <p style="margin:6px 0 0;opacity:0.85;font-size:14px;">El asistente capturó datos de contacto</p>
        </div>
        <div style="background:#fff;border:1px solid #eee;border-top:none;padding:24px;border-radius:0 0 12px 12px;">
          <table style="width:100%;border-collapse:collapse;">
            ${data.email ? `<tr><td style="padding:8px 0;color:#666;width:140px;">Email</td><td style="padding:8px 0;"><a href="mailto:${escapeHtml(data.email)}" style="color:#1E5BFF;">${escapeHtml(data.email)}</a></td></tr>` : ''}
            ${data.telefono ? `<tr><td style="padding:8px 0;color:#666;">WhatsApp</td><td style="padding:8px 0;"><a href="https://wa.me/${escapeHtml(data.telefono.replace(/\D/g, ''))}" style="color:#1E5BFF;">${escapeHtml(data.telefono)}</a></td></tr>` : ''}
            ${data.desafio ? `<tr><td style="padding:8px 0;color:#666;vertical-align:top;">Primer mensaje</td><td style="padding:8px 0;">${escapeHtml(data.desafio.slice(0, 200))}${data.desafio.length > 200 ? '…' : ''}</td></tr>` : ''}
          </table>
          <div style="margin-top:18px;padding-top:18px;border-top:1px solid #eee;">
            <div style="color:#666;font-size:13px;margin-bottom:12px;">Conversación completa:</div>
            ${transcript}
          </div>
        </div>
        <p style="text-align:center;color:#999;font-size:12px;margin-top:16px;">Recibido vía Procesos 360 · ${new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' })}</p>
      </div>
    `;

    const subject = data.email
      ? `🤖 Lead IA: ${data.email}`
      : data.telefono
      ? `🤖 Lead IA: ${data.telefono}`
      : '🤖 Lead capturado por el asistente IA';

    await resend.emails.send({
      from: fromAddress,
      to: notificationEmail,
      replyTo: data.email || undefined,
      subject,
      html,
    });
  } catch (err: any) {
    console.error('[email] Chat notification failed:', err.message);
  }
}

// ===== Diagnostic emails =====

interface DiagnosticEmailLead {
  nombre: string;
  email: string;
  empresa: string;
  cargo?: string;
  telefono?: string;
}

interface DiagnosticResult {
  type: 'empresa' | 'proceso';
  overallLabel: string;
  overallLevel: number;
  categoryAverages: { category: string; level: number }[];
  dimensions: { category: string; dimension: string; level: number; levelLabel: string }[];
}

interface DiagnosticEmailData {
  lead: DiagnosticEmailLead;
  type: 'empresa' | 'proceso' | 'ambos';
  mode: 'express' | 'completo';
  procesoNombre: string | null;
  results: DiagnosticResult[];
  diagnosticHtml: string;
}

interface DiagnosticReportData {
  lead: DiagnosticEmailLead;
  type: 'empresa' | 'proceso' | 'ambos';
  procesoNombre: string | null;
  results: DiagnosticResult[];
  diagnosticHtml: string;
}

function renderResultsTableHtml(results: DiagnosticResult[], procesoNombre: string | null): string {
  let html = '';
  for (const r of results) {
    const title = r.type === 'empresa' ? 'Madurez de Empresa' : `Madurez de Proceso${procesoNombre ? ` · ${procesoNombre}` : ''}`;
    html += `
      <div style="margin-top:24px;padding:20px;background:linear-gradient(135deg,#1E3A8A,#1E5BFF);color:#fff;border-radius:12px;">
        <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.1em;opacity:0.85;margin-bottom:6px;">${escapeHtml(title)}</div>
        <div style="font-size:48px;font-weight:600;line-height:1;margin-bottom:6px;">${escapeHtml(r.overallLabel)}</div>
        <div style="font-size:13px;opacity:0.85;">${r.overallLevel.toFixed(2)} / 4.0</div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-top:16px;">
        <thead>
          <tr><th style="text-align:left;padding:8px 0;color:#666;font-size:12px;border-bottom:1px solid #eee;">Categoría / Dimensión</th><th style="text-align:right;padding:8px 0;color:#666;font-size:12px;border-bottom:1px solid #eee;">Nivel</th></tr>
        </thead>
        <tbody>`;
    for (const d of r.dimensions) {
      const pct = Math.min(100, (d.level / 4) * 100);
      html += `
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#333;border-bottom:1px solid #f5f5f5;">
            <div style="font-size:11px;color:#888;">${escapeHtml(d.category)}</div>
            <div>${escapeHtml(d.dimension)}</div>
          </td>
          <td style="padding:8px 0;font-size:13px;color:#1E5BFF;font-weight:600;text-align:right;border-bottom:1px solid #f5f5f5;white-space:nowrap;">
            <span style="display:inline-block;width:60px;height:6px;background:#eef;border-radius:999px;margin-right:8px;vertical-align:middle;overflow:hidden;">
              <span style="display:block;height:100%;width:${pct}%;background:linear-gradient(90deg,#29C9D6,#1E5BFF);"></span>
            </span>
            ${escapeHtml(d.levelLabel)}
          </td>
        </tr>`;
    }
    html += '</tbody></table>';
  }
  return html;
}

export async function sendDiagnosticoLeadNotification(data: DiagnosticEmailData) {
  if (!resendApiKey) {
    console.warn('[email] RESEND_API_KEY not set, skipping diagnostico notification');
    return;
  }

  try {
    const resend = new Resend(resendApiKey);
    const summary = data.results
      .map(r => `${r.type === 'empresa' ? 'Empresa' : 'Proceso'}: ${r.overallLabel} (${r.overallLevel.toFixed(2)})`)
      .join(' · ');

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:680px;margin:0 auto;padding:20px;">
        <div style="background:linear-gradient(135deg,#1E3A8A,#1E5BFF);color:#fff;padding:24px;border-radius:12px 12px 0 0;">
          <h1 style="margin:0;font-size:22px;">🧭 Nuevo lead vía Diagnóstico PEMM</h1>
          <p style="margin:6px 0 0;opacity:0.85;font-size:14px;">${escapeHtml(summary)}</p>
        </div>
        <div style="background:#fff;border:1px solid #eee;border-top:none;padding:24px;border-radius:0 0 12px 12px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px 0;color:#666;width:140px;">Empresa</td><td style="padding:8px 0;font-weight:600;">${escapeHtml(data.lead.empresa)}</td></tr>
            <tr><td style="padding:8px 0;color:#666;">Nombre</td><td style="padding:8px 0;">${escapeHtml(data.lead.nombre)}</td></tr>
            <tr><td style="padding:8px 0;color:#666;">Email</td><td style="padding:8px 0;"><a href="mailto:${escapeHtml(data.lead.email)}" style="color:#1E5BFF;">${escapeHtml(data.lead.email)}</a></td></tr>
            ${data.lead.cargo ? `<tr><td style="padding:8px 0;color:#666;">Cargo</td><td style="padding:8px 0;">${escapeHtml(data.lead.cargo)}</td></tr>` : ''}
            ${data.lead.telefono ? `<tr><td style="padding:8px 0;color:#666;">WhatsApp</td><td style="padding:8px 0;"><a href="https://wa.me/${escapeHtml(data.lead.telefono.replace(/\D/g, ''))}" style="color:#1E5BFF;">${escapeHtml(data.lead.telefono)}</a></td></tr>` : ''}
            <tr><td style="padding:8px 0;color:#666;">Modalidad</td><td style="padding:8px 0;">${data.mode === 'express' ? 'Express' : 'Completo'}</td></tr>
            ${data.procesoNombre ? `<tr><td style="padding:8px 0;color:#666;">Proceso evaluado</td><td style="padding:8px 0;">${escapeHtml(data.procesoNombre)}</td></tr>` : ''}
          </table>

          ${renderResultsTableHtml(data.results, data.procesoNombre)}

          <div style="margin-top:24px;padding-top:18px;border-top:1px solid #eee;">
            <div style="color:#666;font-size:13px;margin-bottom:8px;">Análisis generado por IA:</div>
            <div style="background:#faf7f0;padding:16px;border-radius:8px;border-left:3px solid #1E5BFF;font-size:14px;line-height:1.6;color:#333;">${data.diagnosticHtml}</div>
          </div>
        </div>
        <p style="text-align:center;color:#999;font-size:12px;margin-top:16px;">Recibido vía Procesos 360 · ${new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' })}</p>
      </div>
    `;

    await resend.emails.send({
      from: fromAddress,
      to: notificationEmail,
      replyTo: data.lead.email,
      subject: `🧭 Diagnóstico: ${data.lead.empresa} (${summary})`,
      html,
    });
  } catch (err: any) {
    console.error('[email] Diagnostico notification failed:', err.message);
  }
}

export async function sendDiagnosticoReportToLead(data: DiagnosticReportData) {
  if (!resendApiKey) {
    console.warn('[email] RESEND_API_KEY not set, skipping diagnostico report');
    return;
  }

  try {
    const resend = new Resend(resendApiKey);

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:680px;margin:0 auto;padding:20px;background:#f7faff;">
        <div style="background:linear-gradient(135deg,#1E3A8A,#1E5BFF);color:#fff;padding:32px 28px;border-radius:14px 14px 0 0;text-align:center;">
          <div style="font-size:13px;text-transform:uppercase;letter-spacing:0.15em;opacity:0.85;margin-bottom:8px;">Diagnóstico de Madurez</div>
          <h1 style="margin:0;font-size:26px;">Tu reporte personalizado</h1>
          <p style="margin:10px 0 0;opacity:0.85;font-size:14px;">${escapeHtml(data.lead.empresa)}</p>
        </div>
        <div style="background:#fff;border:1px solid #eee;border-top:none;padding:28px;border-radius:0 0 14px 14px;">
          <p style="margin:0 0 18px;font-size:15px;color:#333;line-height:1.6;">
            Hola <strong>${escapeHtml(data.lead.nombre.split(' ')[0])}</strong>, gracias por completar el diagnóstico. Aquí está tu reporte basado en el modelo PEMM.
          </p>

          ${renderResultsTableHtml(data.results, data.procesoNombre)}

          <div style="margin-top:32px;padding-top:24px;border-top:1px solid #eee;">
            <h2 style="font-size:18px;color:#1E5BFF;margin:0 0 16px;">Análisis y recomendaciones</h2>
            <div style="font-size:14px;line-height:1.7;color:#333;">${data.diagnosticHtml}</div>
          </div>

          <div style="margin-top:32px;padding:24px;background:linear-gradient(135deg,#EAF1FB,#F5F8FD);border-radius:12px;text-align:center;">
            <h3 style="margin:0 0 8px;font-size:17px;color:#0A1F4A;">¿Quieres que te ayudemos a implementarlo?</h3>
            <p style="margin:0 0 16px;font-size:13px;color:#666;line-height:1.6;">Una llamada de 30 min sin compromiso.</p>
            <a href="https://wa.me/56997076130?text=Hola,%20completé%20el%20diagnóstico%20PEMM%20y%20me%20gustaría%20agendar%20una%20llamada" style="display:inline-block;background:#1E5BFF;color:#fff;padding:12px 28px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;">Agendar llamada por WhatsApp</a>
          </div>
        </div>
        <p style="text-align:center;color:#999;font-size:11px;margin-top:16px;line-height:1.5;">Procesos 360 · Santiago, Chile<br/>contacto@procesos360.cl · +56 9 9707 6130</p>
      </div>
    `;

    await resend.emails.send({
      from: fromAddress,
      to: data.lead.email,
      replyTo: notificationEmail,
      subject: `Tu diagnóstico de madurez de procesos · ${data.lead.empresa}`,
      html,
    });
  } catch (err: any) {
    console.error('[email] Diagnostico report failed:', err.message);
  }
}
