// Client-safe. Keep this module free of server-only imports so the admin tab can
// import the allowlist without pulling Cloudflare bindings into the browser bundle.
export const SUPER_ADMIN_EMAILS: string[] = [
  "jayjacobs@zibukeafrica.co.za",
  "anjageldenhuys@zibukeafrica.co.za",
  "founder@zibukeafrica.co.za",
];

export function isSuperAdmin(email?: string | null): boolean {
  return SUPER_ADMIN_EMAILS.includes(String(email || "").trim().toLowerCase());
}
