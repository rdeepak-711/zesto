export function parseBookingCommand(body: string): { cmd: string; shortId: string; extra: string } | null {
  const m = body.trim().match(/^(confirm|reschedule|cancel)\s+([A-Z0-9-]+)(?:\s+(.+))?$/i)
  if (!m) return null
  return { cmd: m[1].toLowerCase(), shortId: m[2].toUpperCase(), extra: (m[3] ?? '').trim() }
}
