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
 * Splits text into clean Telegram-compliant chunks (max 3800 characters)
 * splitting only at paragraph breaks (\n\n or \n) to preserve readability and complete sentences.
 */
export function splitTelegramMessage(text: string, maxChunkLength = 3800): string[] {
  if (text.length <= maxChunkLength) return [text];

  const chunks: string[] = [];
  const paragraphs = text.split('\n\n');
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if ((currentChunk + '\n\n' + paragraph).length <= maxChunkLength) {
      currentChunk = currentChunk ? currentChunk + '\n\n' + paragraph : paragraph;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      if (paragraph.length <= maxChunkLength) {
        currentChunk = paragraph;
      } else {
        const lines = paragraph.split('\n');
        for (const line of lines) {
          if ((currentChunk + '\n' + line).length <= maxChunkLength) {
            currentChunk = currentChunk ? currentChunk + '\n' + line : line;
          } else {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = line;
          }
        }
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Send HTML message to Telegram Bot with auto-chunking and anti-duplicate protection
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
          message: htmlText.slice(0, 1000),
          status: 'FAILED',
          error: errorMsg,
        },
      });
    }
    return { success: false, error: errorMsg };
  }

  // Anti-duplicate protection: avoid sending duplicate briefings within 5 minutes
  if (logMeta?.type === 'BRIEFING') {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentBriefing = await prisma.telegramLog.findFirst({
      where: {
        type: 'BRIEFING',
        status: 'SENT',
        createdAt: { gte: fiveMinutesAgo },
      },
    });

    if (recentBriefing) {
      console.log('[TELEGRAM] Doppio invio evitato: briefing già inviato negli ultimi 5 minuti.');
      return { success: true, messageId: -1 };
    }
  }

  // Split message cleanly if it exceeds Telegram limits without cutting sentences
  const chunks = splitTelegramMessage(htmlText, 3800);
  let lastMessageId: number | undefined;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    try {
      const url = `https://api.telegram.org/bot${creds.botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: creds.chatId,
          text: chunk,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        const err = data.description || `HTTP ${response.status}`;
        if (logMeta && i === 0) {
          await prisma.telegramLog.create({
            data: {
              type: logMeta.type,
              ticker: logMeta.ticker,
              message: chunk.slice(0, 1000),
              status: 'FAILED',
              error: err,
            },
          });
        }
        return { success: false, error: err };
      }

      lastMessageId = data.result?.message_id;

      // Small delay between chunks to prevent Telegram flood limits
      if (i < chunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    } catch (error: any) {
      const err = error?.message || 'Errore di connessione Telegram';
      if (logMeta && i === 0) {
        await prisma.telegramLog.create({
          data: {
            type: logMeta.type,
            ticker: logMeta.ticker,
            message: chunk.slice(0, 1000),
            status: 'FAILED',
            error: err,
          },
        });
      }
      return { success: false, error: err };
    }
  }

  if (logMeta) {
    await prisma.telegramLog.create({
      data: {
        type: logMeta.type,
        ticker: logMeta.ticker,
        message: htmlText.slice(0, 1000),
        status: 'SENT',
      },
    });
  }

  return { success: true, messageId: lastMessageId };
}

/**
 * Format and send the Revolut Action Card in clear, simple Italian
 */
export async function sendRevolutActionCardTelegram(analysis: {
  ticker: string;
  verdict: string;
  convictionScore: number;
  thesisSummary: string;
  revolutExecutionPlan: any;
}): Promise<{ success: boolean; error?: string }> {
  const p =
    typeof analysis.revolutExecutionPlan === 'string'
      ? JSON.parse(analysis.revolutExecutionPlan)
      : analysis.revolutExecutionPlan;

  const isBuy = analysis.verdict.includes('COMPRA');
  const verdictEmoji = isBuy ? '🟢' : analysis.verdict.includes('VENDI') ? '🔴' : '🟡';

  const message = `
${verdictEmoji} <b>COSA FARE SU REVOLUT: ${analysis.ticker}</b>
━━━━━━━━━━━━━━━━━━━━
🎯 <b>Consiglio:</b> <code>${analysis.verdict}</code>
⭐️ <b>Affidabilità Consiglio:</b> <b>${analysis.convictionScore}/100</b>
📋 <b>Tipo di Ordine da Scegliere:</b> <code>${p.orderType || 'Ordine Limite'}</code>

💡 <b>Perché fare questa operazione (spiegazione semplice):</b>
${analysis.thesisSummary}

📊 <b>NUMERI DA COPIARE SU REVOLUT:</b>
• Prezzo a cui Comprare: <code>${p.idealEntryPriceUSD ? `$${p.idealEntryPriceUSD}` : 'Prezzo Attuale'}</code>
• Pareggio (Break-Even): <code>$${p.breakEvenPriceUSD}</code> <i>(da qui inizi a guadagnare)</i>
• Stop Loss (Protezione): <code>$${p.stopLossPriceUSD}</code> <i>(se scende qui, vendi per bloccare le perdite)</i>
• Obiettivo di Guadagno (TP1): <code>$${p.takeProfit1USD}</code> <i>(vendi qui per incassare)</i>
${p.takeProfit2USD ? `• Secondo Obiettivo (TP2): <code>$${p.takeProfit2USD}</code>\n` : ''}• Rapporto Rischio/Guadagno: <b>${p.riskRewardRatio || '1 : 2.5'}</b>

💰 <b>QUANTO INVESTIRE (CALCOLO DI SICUREZZA):</b>
• Euro Consigliati da Investire: <code>${p.recommendedInvestmentEUR}€</code>
• Quantità di Azioni da Digitare: <code>${p.fractionalSharesToBuy}</code>
• Massima Perdita se Scatta lo Stop: <code>-${p.maxNetLossAtStopEUR}€</code>
• Guadagno Netto all'Obiettivo: <code>+${p.netProfitAtTP1EUR}€</code>

${p.timingWarning ? `⚠️ <i>${p.timingWarning}</i>\n` : ''}
━━━━━━━━━━━━━━━━━━━━
<i>📱 Suggerimento: tocca i numeri monospazio per copiarli subito nell'app Revolut.</i>
  `.trim();

  return sendTelegramMessage(message, { type: 'TRADE_CARD', ticker: analysis.ticker });
}

/**
 * Format and send urgent portfolio alert in simple Italian
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
🚨 <b>ATTENZIONE: AZIONE RICHIESTA SUL TUO PORTAFOGLIO REVOLUT</b>
━━━━━━━━━━━━━━━━━━━━
Titolo: <b>${params.ticker}</b>
Azione Consigliata: <code>${params.verdict}</code>
Prezzo Attuale: <code>$${params.currentPrice}</code>
${params.stopLossPrice ? `🛑 Stop Loss di Sicurezza: <code>$${params.stopLossPrice}</code>\n` : ''}
${params.takeProfitPrice ? `🎯 Obiettivo di Guadagno: <code>$${params.takeProfitPrice}</code>\n` : ''}

<b>Cosa sta succedendo:</b>
${params.reason}

━━━━━━━━━━━━━━━━━━━━
<i>👉 Apri subito l'app Revolut per verificare il titolo e proteggere il tuo capitale.</i>
  `.trim();

  return sendTelegramMessage(message, { type: 'ALERT', ticker: params.ticker });
}

/**
 * Format and send scheduled Daily Briefing in clear, direct Italian without truncation
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
              `• <b>${o.ticker}</b> (Affidabilità: ${o.convictionScore}/100) - <code>${o.verdict}</code>\n  Prezzo Ingresso: <code>$${o.entryPriceUSD}</code> | Investimento: <code>${o.recommendedInvestmentEUR}€</code> | Azioni: <code>${o.fractionalSharesToBuy}</code>`
          )
          .join('\n\n')
      : '<i>Nessuna nuova operazione consigliata oggi. I mercati non offrono ingressi a basso rischio.</i>';

  const alertsList =
    params.portfolioAlerts.length > 0
      ? params.portfolioAlerts.map((a) => `⚠️ <b>${a.ticker}</b>: ${a.message}`).join('\n')
      : '✅ I titoli nel tuo portafoglio sono tranquilli e lontani dai livelli di allarme.';

  // Determine practical final advice
  let practicalAdvice = '';
  if (params.portfolioAlerts.length > 0) {
    practicalAdvice = `⚠️ <b>Consiglio pratico di oggi:</b> Controlla subito i tuoi titoli su Revolut: ci sono posizioni che richiedono attenzione per proteggere i guadagni o limitare le perdite.`;
  } else if (params.topOpportunities.length > 0) {
    const best = params.topOpportunities[0];
    practicalAdvice = `💡 <b>Consiglio pratico di oggi:</b> C'è un'ottima occasione su <b>${best.ticker}</b>. Se vuoi entrare, copia i numeri indicati sopra impostando un ordine limite sull'app Revolut.`;
  } else {
    practicalAdvice = `💡 <b>Consiglio pratico di oggi:</b> Oggi conviene stare fermi e aspettare. Non ci sono occasioni sicure e forzare un'operazione aumenterebbe solo il rischio.`;
  }

  // Full summary without any artificial slicing!
  const message = `
☀️ <b>AGGIORNAMENTO MERCATI E REVOLUT (ORE ${params.timeLabel})</b>
━━━━━━━━━━━━━━━━━━━━
🌍 <b>Cosa Succede nel Mondo Oggi (Notizie & Economia):</b>
${params.geopoliticalSummary.trim()}

🛡 <b>Stato dei Tuoi Titoli su Revolut:</b>
${alertsList}

🔥 <b>Migliori Occasioni del Giorno:</b>
${oppsList}

━━━━━━━━━━━━━━━━━━━━
${practicalAdvice}
  `.trim();

  return sendTelegramMessage(message, { type: 'BRIEFING' });
}
