/**
 * Convert any string to a URL-safe slug.
 * e.g. "WePadl 2025!" → "wepadl-2025"
 *      "Court 7"      → "court-7"
 *      "Lapangan VIP" → "lapangan-vip"
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')   // remove special chars
    .replace(/\s+/g, '-')            // spaces → hyphens
    .replace(/-+/g, '-')             // collapse multiple hyphens
    .replace(/^-|-$/g, '');          // trim leading/trailing hyphens
}
