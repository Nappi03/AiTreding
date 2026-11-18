import { NextResponse } from 'next/server';
import { sendTelegramMessage } from '@/lib/telegram-service';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const customText = body.text;

    const testMessage =
      customText ||
      `
🤖 <b>TEST BOT TELEGRAM - AI TRADING ANALYST</b>
━━━━━━━━━━━━━━━━━━━━
✅ <b>Connessione riuscita con successo!</b>
Il tuo Private Trading Analyst è pronto a inviarti notifiche urgenti di vendita e le migliori schede operative "Copia su Revolut".

🕒 <i>${new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}</i>
      `.trim();

    const result = await sendTelegramMessage(testMessage, { type: 'MANUAL_TEST' });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
