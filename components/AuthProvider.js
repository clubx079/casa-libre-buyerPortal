'use client';
// App-wide auth context: loads the current session, hosts the login/signup modal,
// and exposes openAuth()/logout(). openAuth(cb) runs cb after a successful login —
// used to resume an action (e.g. continue to publish) once the user is in.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AuthModal from './AuthModal';
import { identifyUser, resetUser } from '@/lib/analytics';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const onDone = useRef(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((j) => { if (alive) setUser(j.user || null); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // Periodically re-check the session so a user who gets blocked/suspended
  // (or deactivated) mid-session is signed out without a manual refresh.
  useEffect(() => {
    const id = setInterval(() => {
      fetch('/api/auth/me')
        .then((r) => r.json())
        .then((j) => {
          if (!j.user) setUser((prev) => (prev ? null : prev));
        })
        .catch(() => {});
    }, 60000);
    return () => clearInterval(id);
  }, []);

  // Tie PostHog events to the user whenever the session resolves to someone
  // logged in — covers session restore, email/OTP login, and Google OAuth.
  useEffect(() => { if (user?.id) identifyUser(user); }, [user]);

  const openAuth = useCallback((cb) => { onDone.current = typeof cb === 'function' ? cb : null; setOpen(true); }, []);
  const closeAuth = useCallback(() => { onDone.current = null; setOpen(false); }, []);

  const handleAuthed = useCallback((u) => {
    setUser(u);
    setOpen(false);
    const cb = onDone.current; onDone.current = null;
    if (cb) cb(u);
  }, []);

  const logout = useCallback(async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch {}
    setUser(null);
    resetUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, openAuth, closeAuth, logout }}>
      {children}
      {open && <AuthModal onAuthed={handleAuthed} onClose={closeAuth} />}
    </AuthContext.Provider>
  );
}
