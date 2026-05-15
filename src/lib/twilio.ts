import twilio from 'twilio'

export const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

export async function sendWhatsApp(to: string, body: string, from = process.env.TWILIO_WHATSAPP_NUMBER!) {
  return twilioClient.messages.create({
    from: `whatsapp:${from}`,
    to: `whatsapp:${to}`,
    body,
  })
}
