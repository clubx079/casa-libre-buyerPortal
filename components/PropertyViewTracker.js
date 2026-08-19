'use client';
// Fires a single property_viewed event when a property detail page mounts.
// Rendered by the (server-component) property page, which passes the event
// properties in.
import { useEffect, useRef } from 'react';
import { track } from '@/lib/analytics';

export default function PropertyViewTracker({ property }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !property?.property_id) return;
    done.current = true;
    track('property_viewed', property);
  }, [property]);
  return null;
}
