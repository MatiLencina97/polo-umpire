import { timingSafeEqual } from "node:crypto";

export function adminAuthorized(header: string | null) {
  const expected = process.env.FEEDBACK_ADMIN_TOKEN;
  if (!expected || !header?.startsWith("Bearer ")) return false;
  const provided = header.slice("Bearer ".length);
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
