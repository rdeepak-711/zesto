/**
 * WhatsApp Cloud API (Meta) sender — replacement for src/lib/twilio.ts
 *
 * DRAFT migration module. Twilio (`twilio.ts`) stays in place until every tenant
 * is moved to its own Cloud API number. `getSender(tenant)` returns a per-tenant
 * descriptor; unmigrated tenants fall back to the platform-wide number/token.
 *
 * Required env:
 *   WA_GRAPH_VERSION   graph API version (default v22.0)
 *   WA_APP_SECRET      Meta App secret — verifies inbound webhook signatures
 *   WA_VERIFY_TOKEN    random string you set in the Meta webhook config (GET challenge)
 *   WA_TOKEN_KEY       64-char hex (32 bytes) — AES key for per-tenant token encryption
 *   WA_PHONE_NUMBER_ID platform fallback phone_number_id (single-number / migration mode)
 *   WA_ACCESS_TOKEN    platform fallback system-user token (long-lived)
 */
import crypto from 'crypto'
import type { Tenant } from '@prisma/client'

const GRAPH = `https://graph.facebook.com/${process.env.WA_GRAPH_VERSION ?? 'v22.0'}`

// ── Per-tenant token encryption (AES-256-GCM) ──────────────────────────────
// Business tokens are sensitive (they can send on the client's behalf). Store
// them encrypted at rest; only decrypt in-process at send time.
function aesKey(): Buffer {
  const k = process.env.WA_TOKEN_KEY
  if (!k) throw new Error('WA_TOKEN_KEY missing (openssl rand -hex 32)')
  return Buffer.from(k, 'hex')
}

export function encryptToken(plain: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey(), iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.')
}

export function decryptToken(blob: string): string {
  const [ivB, tagB, encB] = blob.split('.')
  const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey(), Buffer.from(ivB, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(encB, 'base64')), decipher.final()]).toString('utf8')
}

// ── Sender descriptor ──────────────────────────────────────────────────────
export type WhatsAppSender = {
  phoneNumberId: string
  accessToken: string
  displayNumber: string // for logs / payment-page copy only — NOT used to send
}

type TenantSenderFields = Pick<Tenant, 'phoneNumberId' | 'waAccessTokenEnc' | 'whatsappNumber'>

/**
 * Build the send descriptor for a tenant. A tenant with its own Cloud API number
 * sends from its own phone_number_id + business token; otherwise it falls back to
 * the platform number (single-number mode while you migrate tenant-by-tenant).
 */
export function getSender(tenant: TenantSenderFields): WhatsAppSender {
  if (tenant.phoneNumberId && tenant.waAccessTokenEnc) {
    return {
      phoneNumberId: tenant.phoneNumberId,
      accessToken: decryptToken(tenant.waAccessTokenEnc),
      displayNumber: tenant.whatsappNumber,
    }
  }
  return {
    phoneNumberId: process.env.WA_PHONE_NUMBER_ID!,
    accessToken: process.env.WA_ACCESS_TOKEN!,
    displayNumber: tenant.whatsappNumber,
  }
}

function toMsisdn(to: string): string {
  // Cloud API wants a bare E.164 number with no '+' and no 'whatsapp:' prefix
  return to.replace(/^whatsapp:/, '').replace(/[^\d]/g, '')
}

async function post(sender: WhatsAppSender, payload: Record<string, unknown>) {
  const res = await fetch(`${GRAPH}/${sender.phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sender.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', ...payload }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`WA send failed ${res.status}: ${err}`)
  }
  return res.json()
}

/**
 * Free-form text. ONLY valid inside the 24-hour customer service window
 * (within 24h of the customer's last inbound message). Outside the window this
 * call will be rejected by Meta — use sendTemplate() instead.
 */
export async function sendWhatsApp(to: string, body: string, sender: WhatsAppSender) {
  return post(sender, {
    to: toMsisdn(to),
    type: 'text',
    text: { preview_url: true, body },
  })
}

/**
 * Template message — required to OPEN a conversation or to message a user
 * OUTSIDE the 24h window: owner new-order alerts, re-engagement, "your order is
 * ready" sent a day later, etc. The template must be pre-approved in Meta.
 * `components` carries the body variable values, e.g.:
 *   [{ type: 'body', parameters: [{ type: 'text', text: 'GZ-001' }] }]
 */
export async function sendTemplate(
  to: string,
  template: { name: string; language?: string; components?: unknown[] },
  sender: WhatsAppSender,
) {
  return post(sender, {
    to: toMsisdn(to),
    type: 'template',
    template: {
      name: template.name,
      language: { code: template.language ?? 'en' },
      ...(template.components ? { components: template.components } : {}),
    },
  })
}

// ── Inbound webhook signature (Cloud API) ──────────────────────────────────
// Meta signs the raw JSON body with your App Secret as X-Hub-Signature-256.
export function verifyMetaSignature(rawBody: string, signature256: string | null): boolean {
  if (!signature256) return false
  const expected =
    'sha256=' + crypto.createHmac('sha256', process.env.WA_APP_SECRET!).update(rawBody, 'utf8').digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature256)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// ── Inbound payload parsing helper ─────────────────────────────────────────
export type InboundMessage = {
  phoneNumberId: string // route the tenant by THIS, not the display number
  from: string // customer MSISDN
  text: string
  messageId: string
  type: string
}

/** Extract the first user message from a Cloud API webhook body. Returns null for
 *  status callbacks (delivered/read) and non-message events. */
export function parseInbound(payloadJson: unknown): InboundMessage | null {
  try {
    const value = (payloadJson as { entry?: { changes?: { value?: Record<string, unknown> }[] }[] })
      ?.entry?.[0]?.changes?.[0]?.value as
      | {
          metadata?: { phone_number_id?: string }
          messages?: { from: string; id: string; type: string; text?: { body?: string } }[]
        }
      | undefined
    const msg = value?.messages?.[0]
    if (!msg || !value?.metadata?.phone_number_id) return null
    return {
      phoneNumberId: value.metadata.phone_number_id,
      from: msg.from,
      text: msg.text?.body?.trim() ?? '',
      messageId: msg.id,
      type: msg.type,
    }
  } catch {
    return null
  }
}
