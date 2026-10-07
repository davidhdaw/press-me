// The staff session token is the only staff state kept in the browser; roles
// are always looked up from the database through it (see api/staff.js).
const KEY = 'staffToken'

export function getStaffToken() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setStaffToken(token) {
  try {
    if (token) localStorage.setItem(KEY, token)
    else localStorage.removeItem(KEY)
  } catch {
    // Storage blocked: the staff member will just need to sign in again
  }
}
