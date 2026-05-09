import twilio from 'twilio'

export const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

export const FROM_WHATSAPP = process.env.TWILIO_WHATSAPP_NUMBER!

export async function sendWhatsApp(to: string, body: string) {
  return twilioClient.messages.create({
    from: FROM_WHATSAPP,
    to: `whatsapp:${to}`,
    body,
  })
}
