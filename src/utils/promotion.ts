/** A vendor/trainer marketing discount (mirrors backend PromotionDto). Dates are "YYYY-MM-DD". */
export interface Promotion {
  discountPercent: number;
  startsOn?: string | null;
  endsOn?: string | null;
  label?: string | null;
  activeToday?: boolean;
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Same rule the server uses: inside [startsOn, endsOn] (both inclusive, either open). */
export function promotionAppliesOn(p: Promotion | null | undefined, dateIso: string | null | undefined): boolean {
  if (!p || !p.discountPercent || p.discountPercent < 1 || !dateIso) return false;
  if (p.startsOn && dateIso < p.startsOn) return false;
  if (p.endsOn && dateIso > p.endsOn) return false;
  return true;
}

/** Display price after the discount (the server computes the real charge identically). */
export function discountedPrice(price: number | null | undefined, p: Promotion | null | undefined, dateIso: string | null | undefined): number | null {
  if (price == null) return null;
  if (!promotionAppliesOn(p, dateIso)) return price;
  return Math.round(price * (100 - p!.discountPercent)) / 100;
}

/** "20% off · until 31 Oct" style blurb. */
export function promotionBlurb(p: Promotion): string {
  const fmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const parts = [`${p.discountPercent}% off`];
  if (p.startsOn && p.startsOn > todayIso()) parts.push(`from ${fmt(p.startsOn)}`);
  if (p.endsOn) parts.push(`until ${fmt(p.endsOn)}`);
  return parts.join(' · ');
}
