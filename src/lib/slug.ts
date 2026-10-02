/**
 * Login handling: users type their team name; it is normalised (case, accents and punctuation
 * ignored) into a slug, which maps to an internal email address used only by Supabase Auth.
 * Must stay dependency-free: it is also imported by the Node scripts in /scripts.
 */

export const EMAIL_DOMAIN = 'fanta.invalid'

export function teamSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export function teamEmail(name: string, domain: string = EMAIL_DOMAIN): string {
  return `${teamSlug(name)}@${domain}`
}
