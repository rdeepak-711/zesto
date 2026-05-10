import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { sendWhatsApp } from '@/lib/twilio'

const OTP_TTL_MS = 10 * 60 * 1000 // 10 minutes

export function generateOtp(): string {
  return String(crypto.randomInt(100000, 999999))
}

export async function sendOtp(phone: string): Promise<void> {
  const code = generateOtp()
  const codeHash = await bcrypt.hash(code, 10)
  const expiresAt = new Date(Date.now() + OTP_TTL_MS)

  await db.otpSession.create({
    data: { phone, codeHash, expiresAt },
  })

  await sendWhatsApp(phone, `Your Zesto verification code: *${code}*\nExpires in 10 minutes.`)
}

export async function verifyOtp(phone: string, code: string): Promise<{ valid: boolean; debug?: object }> {
  const sessions = await db.otpSession.findMany({
    where: { phone, used: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  if (sessions.length === 0) {
    return { valid: false, debug: { reason: 'no_sessions', phone } }
  }

  for (const session of sessions) {
    const match = await bcrypt.compare(code, session.codeHash)
    if (match) {
      await db.otpSession.update({ where: { id: session.id }, data: { used: true } })
      return { valid: true }
    }
  }

  return { valid: false, debug: { reason: 'no_match', sessionCount: sessions.length, phone, codeLen: code.length } }
}
