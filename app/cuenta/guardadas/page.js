'use client';
// Guardadas inside the account — the one place a signed-in person sees their saves,
// including the ones they made before logging in (moved in by /api/account/saved).
import SavedList from '@/components/SavedList';

export default function SavedPage() {
  return <SavedList />;
}
