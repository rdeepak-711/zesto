# Task 05 — Twilio Client + sendWhatsApp Helper

**Phase:** 2 — WhatsApp Bot  
**Goal:** Create a thin Twilio wrapper so all other code calls `sendWhatsApp(to, body)` and never touches the Twilio SDK directly.

**Files created:**
- `src/lib/twilio.ts`
- `tests/bot/twilio.test.ts`

---

- [ ] **Step 1: Write the failing test**

Create `tests/bot/twilio.test.ts`:

```typescript
import { sendWhatsApp } from '@/lib/twilio'

const mockCreate = vi.fn().mockResolvedValue({ sid: 'SM123' })

vi.mock('twilio', () => ({
  default: vi.fn(() => ({
    messages: { create: mockCreate },
  })),
}))

describe('sendWhatsApp', () => {
  beforeEach(() => {
    process.env.TWILIO_ACCOUNT_SID = 'ACtest'
    process.env.TWILIO_AUTH_TOKEN = 'token'
    process.env.TWILIO_WHATSAPP_NUMBER = 'whatsapp:+910000000000'
    mockCreate.mockClear()
  })

  it('calls twilio messages.create with correct params', async () => {
    await sendWhatsApp('+911234567890', 'Hello!')

    expect(mockCreate).toHaveBeenCalledWith({
      from: 'whatsapp:+910000000000',
      to: 'whatsapp:+911234567890',
      body: 'Hello!',
    })
  })

  it('returns the message SID', async () => {
    const sid = await sendWhatsApp('+911234567890', 'Hello!')
    expect(sid).toBe('SM123')
  })

  it('prefixes "whatsapp:" if not already present', async () => {
    await sendWhatsApp('whatsapp:+911234567890', 'Hi')
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'whatsapp:+911234567890' })
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test tests/bot/twilio.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/twilio'`

- [ ] **Step 3: Write `src/lib/twilio.ts`**

```typescript
import TwilioSDK from 'twilio'

function getClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID!
  const authToken = process.env.TWILIO_AUTH_TOKEN!
  return TwilioSDK(accountSid, authToken)
}

function toWhatsAppAddress(phone: string): string {
  return phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`
}

export async function sendWhatsApp(to: string, body: string): Promise<string> {
  const client = getClient()
  const from = process.env.TWILIO_WHATSAPP_NUMBER!
  const message = await client.messages.create({
    from,
    to: toWhatsAppAddress(to),
    body,
  })
  return message.sid
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test tests/bot/twilio.test.ts
```

Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/twilio.ts tests/bot/twilio.test.ts
git commit -m "feat: add Twilio sendWhatsApp helper"
```
