import { prisma } from './prisma';

export interface TelegramConfig {
  botToken?: string | null;
  chatId?: string | null;
}

/**
 * Retrieves Telegram credentials from database settings or environment variables
 */
export async function getTelegramCredentials(): Promise<{ botToken: string; chatId: string } | null> {
  const settings = await prisma.accountSettings.findUnique({
    where: { id: 'default' },
  });

  const botToken = settings?.telegramBotToken?.trim() || process.env.TELEGRAM_BOT_TOKEN?.trim() || '';
  const chatId = settings?.telegramChatId?.trim() || process.env.TELEGRAM_CHAT_ID?.trim() || '';

  if (!botToken || !chatId) {
    return null;
  }

  return { botToken, chatId };
}

/**
 * Send raw HTML message to Telegram Bot
 */
export async function sendTelegramMessage(
  htmlText: string,
  logMeta?: { type: 'BRIEFING' | 'ALERT' | 'MANUAL_TEST' | 'TRADE_CARD'; ticker?: string }
): Promise<{ success: boolean; messageId?: number; error?: string }> {
  const creds = await getTelegramCredentials();

  if (!creds) {
    const errorMsg = 'Credenziali Telegram non configurate (imposta Bot Token e Chat ID nelle Impostazioni)';
    if (logMeta) {
      await prisma.telegramLog.create({
        data: {
          type: logMeta.type,
          ticker: logMeta.ticker,
          message: htmlText.slice(0, 500),
          status: 'FAILED',
          error: errorMsg,
        },
      });
    }
    return { success: false, error: errorMsg };
  }

  try {
    const url = `https://api.telegram.org/bot${creds.botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: creds.chatId,
        text: htmlText,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      const err = data.description || `HTTP ${response.status}`;
      if (logMeta) {
        await prisma.telegramLog.create({
          data: {
            type: logMeta.type,
            ticker: logMeta.ticker,
            message: htmlText.slice(0, 500),
            status: 'FAILED',
            error: err,
          },
        });
      }
      return { success: false, error: err };
    }

    if (logMeta) {
      await prisma.telegramLog.create({
        data: {
          type: logMeta.type,
          ticker: logMeta.ticker,
          message: htmlText.slice(0, 500),
          status: 'SENT',
        },
      });
    }

    return { success: true, messageId: data.result?.message_id };
  } catch (error: any) {
    const err = error?.message || 'Errore di connessione Telegram';
    if (logMeta) {
      await prisma.telegramLog.create({
        data: {
          type: logMeta.type,
          ticker: logMeta.ticker,
          message: htmlText.slice(0, 500),
          status: 'FAILED',
          error: err,
        },
      });
    }
    return { success: false, error: err };
  }
}

/**
 * Format and send the Revolut Action Card
 */
export async function sendRevolutActionCardTelegram(analysis: {
  ticker: string;
  verdict: string;
  convictionScore: number;
  thesisSummary: string;
  revolutExecutionPlan: any;
}): Promise<{ success: boolean; error?: string }> {
  const p = typeof analysis.revolutExecutionPlan === 'string'
    ? JSON.parse(analysis.revolutExecutionPlan)
    : analysis.revolutExecutionPlan;

  const isBuy = analysis.verdict.includes('COMPRA');
  const verdictEmoji = isBuy ? '🟢' : analysis.verdict.includes('VENDI') ? '🔴' : '🟡';

  const message = `
${verdictEmoji} <b>REVOLUT ACTION CARD: ${analysis.ticker}</b>
━━━━━━━━━━━━━━━━━━━━
🎯 <b>Verdetto:</b> <code>${analysis.verdict}</code>
⭐️ <b>Conviction Score:</b> <b>${analysis.convictionScore}/100</b>
📋 <b>Tipo Ordine Revolut:</b> <code>${p.orderType || 'Ordine Limite'}</code>

💡 <b>Tesi Flash:</b>
<i>${analysis.thesisSummary}</i>

📊 <b>PARAMETRI COPIA REVOLUT:</b>
• Prezzo Ingresso: <code>${p.idealEntryPriceUSD ? `$${p.idealEntryPriceUSD}` : 'A Mercato'}</code>
• Pareggio (Break-Even): <code>$${p.breakEvenPriceUSD}</code>
• Stop Loss: <code>$${p.stopLossPriceUSD}</code>
• Take Profit 1: <code>$${p.takeProfit1USD}</code>
• Take Profit 2: <code>$${p.takeProfit2USD || '-'}</code>
• Rischio/Rendimento: <b>${p.riskRewardRatio || '1 : 2.5'}</b>

💰 <b>GESTIONE CAPITALE REVOLUT:</b>
• Euro da Investire: <code>${p.recommendedInvestmentEUR}€</code>
• Azioni Frazionate: <code>${p.fractionalSharesToBuy}</code>
• Max Perdita a Stop: <code>-${p.maxNetLossAtStopEUR}€</code>
• Guadagno Netto TP1: <code>+${p.netProfitAtTP1EUR}€</code>

${p.timingWarning ? `⚠️ <i>${p.timingWarning}</i>\n` : ''}
━━━━━━━━━━━━━━━━━━━━
<i>📱 Clicca sui numeri monospazio per copiarli direttamente nell'app Revolut</i>
  `.trim();

  return sendTelegramMessage(message, { type: 'TRADE_CARD', ticker: analysis.ticker });
}

/**
 * Format and send urgent portfolio alert
 */
export async function sendUrgentPortfolioAlertTelegram(params: {
  ticker: string;
  verdict: string;
  currentPrice: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  reason: string;
}): Promise<{ success: boolean; error?: string }> {
  const message = `
🚨 <b>ALLARME URGENTE PORTAFOGLIO REVOLUT!</b>
━━━━━━━━━━━━━━━━━━━━
⚠️ Titolo: <b>${params.ticker}</b>
⚡️ Azione Richiesta: <code>${params.verdict}</code>
💵 Prezzo Attuale: <code>$${params.currentPrice}</code>
${params.stopLossPrice ? `🛑 Stop Loss di Riferimento: <code>$${params.stopLossPrice}</code>\n` : ''}
${params.takeProfitPrice ? `🎯 Take Profit di Riferimento: <code>$${params.takeProfitPrice}</code>\n` : ''}

<b>Motivazione:</b>
${params.reason}

━━━━━━━━━━━━━━━━━━━━
<i>Apri immediatamente l'app Revolut per proteggere il capitale o bloccare i profitti.</i>
  `.trim();

  return sendTelegramMessage(message, { type: 'ALERT', ticker: params.ticker });
}

/**
 * Format and send scheduled Daily Briefing
 */
export async function sendDailyBriefingTelegram(params: {
  timeLabel: string; // e.g. "08:30" or "15:00"
  geopoliticalSentiment: string;
  geopoliticalSummary: string;
  keyRisks: string[];
  topOpportunities: Array<{
    ticker: string;
    verdict: string;
    convictionScore: number;
    recommendedInvestmentEUR: number;
    fractionalSharesToBuy: number;
    entryPriceUSD: number;
  }>;
  portfolioAlerts: Array<{ ticker: string; message: string }>;
}): Promise<{ success: boolean; error?: string }> {
  const oppsList =
    params.topOpportunities.length > 0
      ? params.topOpportunities
          .map(
            (o) =>
              `• <b>${o.ticker}</b> (${o.convictionScore}/100) - <code>${o.verdict}</code>\n  Ingresso: <code>$${o.entryPriceUSD}</code> | Investimento: <code>${o.recommendedInvestmentEUR}€</code> | Azioni: <code>${o.fractionalSharesToBuy}</code>`
          )
          .join('\n\n')
      : '<i>Nessuna operazione con Conviction Score >= 75 in questa scansione.</i>';

  const alertsList =
    params.portfolioAlerts.length > 0
      ? params.portfolioAlerts.map((a) => `⚠️ <b>${a.ticker}</b>: ${a.message}`).join('\n')
      : '✅ Tutti i titoli in portafoglio sono entro i parametri di sicurezza.';

  const message = `
☀️ <b>REPORT AI TRADING REVOLUT - ORE ${params.timeLabel}</b>
━━━━━━━━━━━━━━━━━━━━
🌍 <b>Macro & Geopolitica:</b> <b>${params.geopoliticalSentiment}</b>
${params.geopoliticalSummary.slice(0, 350)}...

🛡 <b>Stato Portafoglio Revolut:</b>
${alertsList}

🔥 <b>Top Opportunità del Momento:</b>
${oppsList}

━━━━━━━━━━━━━━━━━━━━
<i>Accedi alla dashboard per l'analisi tecnica completa e i grafici interattivi.</i>
  `.trim();

  return sendTelegramMessage(message, { type: 'BRIEFING' });
}
