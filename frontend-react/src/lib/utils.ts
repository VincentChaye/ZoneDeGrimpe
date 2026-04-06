import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Parse a climbing grade like "6a+" into a numeric value for comparison */
export function parseGradeToNumber(grade: string): number {
  if (!grade) return 0;
  const match = grade.match(/^(\d+)([a-cA-C]?)([+]?)/);
  if (!match) return 0;
  const base = parseInt(match[1], 10);
  const letter = (match[2] || 'a').toLowerCase();
  const plus = match[3] === '+' ? 0.25 : 0;
  const letterVal = letter === 'a' ? 0 : letter === 'b' ? 0.33 : 0.66;
  return base + letterVal + plus;
}

/** Get the difficulty level category from a max grade */
export function getGradeLevel(maxGrade: string | null): string {
  if (!maxGrade) return 'medium';
  const n = parseGradeToNumber(maxGrade);
  if (n < 5) return 'easy';
  if (n < 6.5) return 'medium';
  if (n < 7.5) return 'hard';
  if (n < 8.5) return 'expert';
  return 'elite';
}

/** Orientation degrees for compass display */
export const ORIENT_DEG: Record<string, number> = {
  N: 0, NE: 45, E: 90, SE: 135, S: 180, SO: 225, O: 270, NO: 315,
};

/** Spot type metadata — use t('spot.type.X') for translated labels */
export const SPOT_TYPES: Record<string, { key: string; color: string }> = {
  crag: { key: 'spot.type.crag', color: 'type-crag' },
  boulder: { key: 'spot.type.boulder', color: 'type-boulder' },
  indoor: { key: 'spot.type.indoor', color: 'type-indoor' },
  shop: { key: 'spot.type.shop', color: 'type-shop' },
};
