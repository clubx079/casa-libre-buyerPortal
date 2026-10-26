// Automation emails / WhatsApps go out only in the daytime, in the country's own time
// zone: the Admin Manager found that messages sent at night got no clicks. The hourly
// automations cron passes `quiet: true` in the frame outside the window; sendOnce then
// holds the message (nothing is claimed or counted as failed) and the first daytime run
// sends it — every automation picks up whoever is due on each run. Pure.
export const SEND_FROM_HOUR = 9;    // 09:00 local
export const SEND_UNTIL_HOUR = 19;  // until 19:00 local
const ZONE = { py: 'America/Asuncion', bo: 'America/La_Paz', uy: 'America/Montevideo', ve: 'America/Caracas', sv: 'America/El_Salvador' };

export function localHour(now = new Date(), country = 'py') {
  const h = new Intl.DateTimeFormat('en-US', { timeZone: ZONE[country] || ZONE.py, hour: 'numeric', hourCycle: 'h23' }).format(now);
  return Number(h) % 24;
}

export const inSendWindow = (now = new Date(), country = 'py') => {
  const h = localHour(now, country);
  return h >= SEND_FROM_HOUR && h < SEND_UNTIL_HOUR;
};
