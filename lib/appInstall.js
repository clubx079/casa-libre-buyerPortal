// The app's "I was opened" ping (app/api/mobile/install): was the account created AFTER the app
// was installed (= signed up in the app)? An account created up to 10 minutes before the first
// open still counts (the app's first launch can lag the sign-up screen). Pure — tests/appInstall.test.mjs.
const EARLY_MS = 10 * 60 * 1000;

export function createdInApp(accountCreatedAt, installedAt) {
  const a = Date.parse(accountCreatedAt || ''), i = Date.parse(installedAt || '');
  if (!Number.isFinite(a) || !Number.isFinite(i)) return null;
  return a >= i - EARLY_MS;
}
