import { COUNTRY_CODE } from '@/lib/country';

// TEMPORARY diagnostic: reports what the RUNNING container sees for country
// resolution. No secrets are exposed — only the country code, the public site
// URL, and the (non-secret) hostname of the DB so we can confirm the right one.
// Remove once the deployment country is verified.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  let dbHost = null;
  try {
    dbHost = process.env.AIROBASE_URL ? new URL(process.env.AIROBASE_URL).host : null;
  } catch {
    dbHost = 'unparseable';
  }

  return Response.json({
    resolved_COUNTRY_CODE: COUNTRY_CODE,
    raw_process_env: {
      COUNTRY: process.env.COUNTRY ?? null,
      NEXT_PUBLIC_COUNTRY: process.env.NEXT_PUBLIC_COUNTRY ?? null,
      APP_PUBLIC_URL: process.env.APP_PUBLIC_URL ?? null,
    },
    db_host: dbHost,
    note: 'temporary debug endpoint — safe to remove',
  });
}
