// One-shot "a new account was just created" signal for sign-ups that finish on the
// server (Google OAuth callback), where no client code runs at the moment of signup.
// The callback sets this short-lived readable cookie; the next page load reads it,
// deletes it and fires user_signed_up once.
export const SIGNUP_COOKIE = 'cl_signup';

// Returns the sign-up method ('google') and clears the cookie, or null.
export function consumeSignupSignal(doc = typeof document !== 'undefined' ? document : null) {
  if (!doc) return null;
  const m = String(doc.cookie || '').match(new RegExp(`(?:^|;\\s*)${SIGNUP_COOKIE}=([^;]*)`));
  if (!m) return null;
  doc.cookie = `${SIGNUP_COOKIE}=; Max-Age=0; path=/`;
  const method = decodeURIComponent(m[1]);
  return /^[a-z_]{1,20}$/.test(method) ? method : null;
}
