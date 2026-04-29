/**
 * Lógica de scoring PEMM.
 * - Express: una respuesta por dimensión, escala 1-4 (nivel directo).
 * - Completo: cuatro afirmaciones por dimensión, cada una calificada V/A/N
 *   (Verde = Largely True, Amarillo = Somewhat True, Rojo = Largely False).
 *
 * Mapeo V/A/N → score numérico: V=1.0, A=0.5, N=0.0
 * Nivel de dimensión (completo) = suma de las 4 afirmaciones (rango 0-4),
 * que coincide con el nivel PEMM esperado.
 */

import pemmData from '../data/pemm.json';

export type Rating = 'V' | 'A' | 'N';
export type Mode = 'express' | 'completo';
export type Type = 'empresa' | 'proceso' | 'ambos';

export interface DimensionDef {
  category: string;
  dimension: string;
  statements: { L1: string; L2: string; L3: string; L4: string };
}

export const empresaDimensions: DimensionDef[] = pemmData.empresa as DimensionDef[];
export const procesoDimensions: DimensionDef[] = pemmData.proceso as DimensionDef[];

export interface DimensionScore {
  category: string;
  dimension: string;
  level: number; // 0..4 con decimales
  levelLabel: string; // "E-1" | "E-2" | "E-3" | "E-4" | "E-0"
}

export interface AssessmentResult {
  type: 'empresa' | 'proceso';
  mode: Mode;
  dimensions: DimensionScore[];
  categoryAverages: { category: string; level: number }[];
  overallLevel: number;
  overallLabel: string; // "E-X" o "P-X"
}

const ratingScore: Record<Rating, number> = { V: 1.0, A: 0.5, N: 0.0 };

function levelLabel(prefix: 'E' | 'P', level: number): string {
  // Round to nearest integer for label, clamp 0..4
  const n = Math.max(0, Math.min(4, Math.round(level)));
  return `${prefix}-${n}`;
}

/**
 * Express: answers is a record of dimensionId → 1..4
 */
export function scoreExpress(
  type: 'empresa' | 'proceso',
  answers: Record<string, number>
): AssessmentResult {
  const dims = type === 'empresa' ? empresaDimensions : procesoDimensions;
  const prefix = type === 'empresa' ? 'E' : 'P';

  const dimensions: DimensionScore[] = dims.map(d => {
    const id = dimensionId(d);
    const lvl = answers[id] ?? 0;
    return {
      category: d.category,
      dimension: d.dimension,
      level: lvl,
      levelLabel: levelLabel(prefix, lvl),
    };
  });

  return finalize(type, 'express', dimensions);
}

/**
 * Completo: answers is a record of dimensionId → { L1: Rating, L2: Rating, L3: Rating, L4: Rating }
 */
export function scoreCompleto(
  type: 'empresa' | 'proceso',
  answers: Record<string, { L1: Rating; L2: Rating; L3: Rating; L4: Rating }>
): AssessmentResult {
  const dims = type === 'empresa' ? empresaDimensions : procesoDimensions;
  const prefix = type === 'empresa' ? 'E' : 'P';

  const dimensions: DimensionScore[] = dims.map(d => {
    const id = dimensionId(d);
    const a = answers[id];
    let lvl = 0;
    if (a) {
      lvl = ratingScore[a.L1] + ratingScore[a.L2] + ratingScore[a.L3] + ratingScore[a.L4];
    }
    return {
      category: d.category,
      dimension: d.dimension,
      level: lvl,
      levelLabel: levelLabel(prefix, lvl),
    };
  });

  return finalize(type, 'completo', dimensions);
}

function finalize(type: 'empresa' | 'proceso', mode: Mode, dimensions: DimensionScore[]): AssessmentResult {
  const prefix = type === 'empresa' ? 'E' : 'P';

  // Average per category
  const cats = new Map<string, number[]>();
  for (const d of dimensions) {
    if (!cats.has(d.category)) cats.set(d.category, []);
    cats.get(d.category)!.push(d.level);
  }
  const categoryAverages = Array.from(cats.entries()).map(([category, levels]) => ({
    category,
    level: avg(levels),
  }));

  // Overall = avg of all dimensions (not weighted by category)
  const overallLevel = avg(dimensions.map(d => d.level));
  const overallLabel = levelLabel(prefix, overallLevel);

  return { type, mode, dimensions, categoryAverages, overallLevel, overallLabel };
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/**
 * dimensionId — normaliza category+dimension a un id estable para usar en formularios.
 */
export function dimensionId(d: { category: string; dimension: string }): string {
  return slugify(d.category) + '__' + slugify(d.dimension);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
