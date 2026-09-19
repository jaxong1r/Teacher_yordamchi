// Supabase Auth requires an email address. Users only ever see/type a
// plain "login" (username), so we map it to a synthetic, non-deliverable
// email under a fixed internal domain. Usernames are stored lowercase.

const USERNAME_DOMAIN = 'sinf.local'

export function usernameToEmail(username: string) {
  return `${username.trim().toLowerCase()}@${USERNAME_DOMAIN}`
}

export function isValidUsername(username: string) {
  return /^[a-z0-9_]{3,20}$/.test(username.trim().toLowerCase())
}
