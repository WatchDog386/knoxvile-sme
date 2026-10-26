/**
 * One colour per bar in the 7-day charts (Reports, dashboard). The selected
 * bar shows its colour as diagonal stripes.
 */
export const BAR_COLORS: Array<{ solid: string; light: string }> = [
  { solid: '#2DA043', light: '#6CC17E' }, // green
  { solid: '#3A8F91', light: '#7CC3C4' }, // teal
  { solid: '#3B5BA9', light: '#7F98D6' }, // blue
  { solid: '#7E57C2', light: '#B39DDB' }, // purple
  { solid: '#E23B41', light: '#F08A8E' }, // red
  { solid: '#F08C21', light: '#F6B46B' }, // orange
  { solid: '#D4A017', light: '#E9C85E' }, // gold
];

export function barColor(index: number) {
  return BAR_COLORS[index % BAR_COLORS.length];
}

export function barStripes(index: number): string {
  const c = barColor(index);
  return `repeating-linear-gradient(135deg, ${c.solid} 0 5px, ${c.light} 5px 10px)`;
}
