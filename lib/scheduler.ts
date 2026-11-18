import cron, { ScheduledTask } from 'node-cron';
import { prisma } from './prisma';
import {
  getOrGenerateGeopoliticalBrief,
  runFastWatchlistTriage,
  runDeepHedgeFundAnalysis,
} from './ai-engine';
import { getStockQuote } from './market-data';
import { sendDailyBriefingTelegram, sendUrgentPortfolioAlertTelegram } from './telegram-service';
import { getMarketTradingHoursStatus } from './revolut-engine';

let scheduledTasks: ScheduledTask[] = [];
let isSchedulerRunning = false;
let isScanRunning = false;
let lastScanTimestamp = 0;

/**
 * Execute the Scheduled Macro & Watchlist Scan with strict anti-duplicate lock
 */
export async function executeScheduledScan(label = 'PROGRAMMATO'): Promise<{
  geopoliticalSentiment: string;
  topOpportunitiesCount: number;
  alertsCount: number;
}> {
  const now = Date.now();

  // Concurrency lock: prevent parallel scans
  if (isScanRunning) {
    console.log(`[SCHEDULER] Scansione già in corso, evito esecuzione duplicata (${label}).`);
    return { geopoliticalSentiment: 'NEUTRAL', topOpportunitiesCount: 0, alertsCount: 0 };
  }

  // Anti-duplicate lock: prevent double trigger within 5 minutes unless manually requested
  if (now - lastScanTimestamp < 5 * 60 * 1000 && label !== 'SCANSIONE MANUALE UI') {
    console.log(`[SCHEDULER] Scansione già eseguita negli ultimi 5 minuti, salto (${label}).`);
    return { geopoliticalSentiment: 'NEUTRAL', topOpportunitiesCount: 0, alertsCount: 0 };
  }

  isScanRunning = true;
  lastScanTimestamp = now;
  console.log(`[SCHEDULER] Avvio scansione programmata (${label})...`);

  try {
    // 1. Generate or retrieve today's Geopolitical Master Brief
    const geoBrief = await getOrGenerateGeopoliticalBrief(true);

    // 2. Run Fast Market Triage on Watchlist
    const triageResults = await runFastWatchlistTriage();

    // 3. Select Top 3 candidates for Deep Analysis and run them in parallel for speed
    const topCandidates = triageResults.slice(0, 3);
    const deepAnalyses: any[] = [];

    const analysesResults = await Promise.all(
      topCandidates.map(async (c) => {
        try {
          console.log(`[SCHEDULER] Analisi approfondita per: ${c.ticker}`);
          return await runDeepHedgeFundAnalysis(c.ticker, { skipAutoTelegram: true });
        } catch (err: any) {
          console.warn(`[SCHEDULER] Errore analisi su ${c.ticker}:`, err?.message);
          return null;
        }
      })
    );

    for (const res of analysesResults) {
      if (res) deepAnalyses.push(res);
    }

    // 4. Check owned portfolio stocks
    const portfolioPositions = await prisma.portfolioPosition.findMany();
    const portfolioAlerts: Array<{ ticker: string; message: string }> = [];

    for (const pos of portfolioPositions) {
      try {
        const quote = await getStockQuote(pos.ticker);

        // Check if Stop Loss or Take Profit touched
        if (pos.stopLossPriceUSD && quote.currentPrice <= pos.stopLossPriceUSD) {
          const alertMsg = `Il prezzo attuale ($${quote.currentPrice}) è sceso sotto lo Stop Loss di sicurezza ($${pos.stopLossPriceUSD}). Conviene chiudere la posizione per bloccare le perdite.`;
          portfolioAlerts.push({ ticker: pos.ticker, message: alertMsg });
          await sendUrgentPortfolioAlertTelegram({
            ticker: pos.ticker,
            verdict: 'VENDI SUBITO (STOP LOSS COLPITO)',
            currentPrice: quote.currentPrice,
            stopLossPrice: pos.stopLossPriceUSD,
            reason: alertMsg,
          });
        } else if (pos.takeProfitPriceUSD && quote.currentPrice >= pos.takeProfitPriceUSD) {
          const alertMsg = `Il prezzo attuale ($${quote.currentPrice}) ha raggiunto il Take Profit prefissato ($${pos.takeProfitPriceUSD}). Ottimo momento per incassare i guadagni.`;
          portfolioAlerts.push({ ticker: pos.ticker, message: alertMsg });
          await sendUrgentPortfolioAlertTelegram({
            ticker: pos.ticker,
            verdict: 'PRENDI PROFITTO (OBIETTIVO RAGGIUNTO)',
            currentPrice: quote.currentPrice,
            takeProfitPrice: pos.takeProfitPriceUSD,
            reason: alertMsg,
          });
        }
      } catch (e: any) {
        console.warn(`[SCHEDULER] Impossibile verificare quotazione per ${pos.ticker}:`, e?.message);
      }
    }

    // 5. Filter top buy opportunities with convictionScore >= 75
    const topBuyOpps = deepAnalyses
      .filter((d) => (d.verdict === 'COMPRA ORA' || d.verdict.includes('COMPRA')) && d.convictionScore >= 75)
      .slice(0, 3)
      .map((d) => ({
        ticker: d.ticker,
        verdict: d.verdict,
        convictionScore: d.convictionScore,
        recommendedInvestmentEUR: d.revolutExecutionPlan?.recommendedInvestmentEUR || 0,
        fractionalSharesToBuy: d.revolutExecutionPlan?.fractionalSharesToBuy || 0,
        entryPriceUSD: d.revolutExecutionPlan?.idealEntryPriceUSD || 0,
      }));

    // 6. Send single comprehensive Telegram briefing (with anti-duplicate protection)
    await sendDailyBriefingTelegram({
      timeLabel: label,
      geopoliticalSentiment: geoBrief.marketSentiment,
      geopoliticalSummary: geoBrief.summary,
      keyRisks: geoBrief.keyRisks,
      topOpportunities: topBuyOpps,
      portfolioAlerts,
    });

    console.log(`[SCHEDULER] Scansione (${label}) completata con successo.`);

    return {
      geopoliticalSentiment: geoBrief.marketSentiment,
      topOpportunitiesCount: topBuyOpps.length,
      alertsCount: portfolioAlerts.length,
    };
  } catch (err: any) {
    console.error(`[SCHEDULER] Errore scansione:`, err?.message);
    throw err;
  } finally {
    isScanRunning = false;
  }
}

/**
 * Hourly Portfolio Safety Check
 */
export async function executeHourlyPortfolioCheck(): Promise<void> {
  const marketStatus = getMarketTradingHoursStatus();
  if (!marketStatus.isOpen && !marketStatus.isPreMarket) {
    return; // Don't spam notifications when markets are totally closed
  }

  const positions = await prisma.portfolioPosition.findMany();
  for (const pos of positions) {
    try {
      const quote = await getStockQuote(pos.ticker);

      // Severe drop check (down > 5% today)
      if (quote.changePercent <= -5.0) {
        await sendUrgentPortfolioAlertTelegram({
          ticker: pos.ticker,
          verdict: 'ATTENZIONE: FORTE CALO ODIERNO',
          currentPrice: quote.currentPrice,
          stopLossPrice: pos.stopLossPriceUSD || undefined,
          reason: `Il titolo sta perdendo il ${quote.changePercent.toFixed(2)}% oggi. Controlla il prezzo e i livelli di sicurezza sull'app Revolut.`,
        });
      }

      // Stop Loss check
      if (pos.stopLossPriceUSD && quote.currentPrice <= pos.stopLossPriceUSD) {
        await sendUrgentPortfolioAlertTelegram({
          ticker: pos.ticker,
          verdict: 'VENDI ORA (STOP LOSS COLPITO)',
          currentPrice: quote.currentPrice,
          stopLossPrice: pos.stopLossPriceUSD,
          reason: `Il prezzo ($${quote.currentPrice}) è sceso sotto lo Stop Loss ($${pos.stopLossPriceUSD}).`,
        });
      }

      // Take Profit check
      if (pos.takeProfitPriceUSD && quote.currentPrice >= pos.takeProfitPriceUSD) {
        await sendUrgentPortfolioAlertTelegram({
          ticker: pos.ticker,
          verdict: 'PRENDI PROFITTO (OBIETTIVO RAGGIUNTO)',
          currentPrice: quote.currentPrice,
          takeProfitPrice: pos.takeProfitPriceUSD,
          reason: `Il prezzo ($${quote.currentPrice}) ha raggiunto il Take Profit prefissato ($${pos.takeProfitPriceUSD}).`,
        });
      }
    } catch (err: any) {
      console.warn(`Hourly check failed for ${pos.ticker}:`, err?.message);
    }
  }
}

/**
 * Initialize or reinitialize node-cron schedules
 */
export async function initScheduler(): Promise<void> {
  // Stop existing cron tasks if any
  for (const task of scheduledTasks) {
    task.stop();
  }
  scheduledTasks = [];

  const settings = await prisma.accountSettings.findUnique({
    where: { id: 'default' },
  });

  if (!settings || !settings.autoScanEnabled) {
    console.log('[SCHEDULER] Auto-scans disabled by settings.');
    isSchedulerRunning = false;
    return;
  }

  const [morningHour, morningMin] = (settings.morningScanTime || '08:30').split(':').map(Number);
  const [afternoonHour, afternoonMin] = (settings.afternoonScanTime || '15:00').split(':').map(Number);

  // 1. Morning Cron (Monday - Friday at specified time)
  // Cron expression: minute hour * * 1-5
  const morningCron = `${morningMin || 30} ${morningHour || 8} * * 1-5`;
  const morningTask = cron.schedule(
    morningCron,
    () => {
      executeScheduledScan('08:30 MATTINA').catch((e) => console.error(e));
    },
    { timezone: 'Europe/Rome' }
  );
  scheduledTasks.push(morningTask);

  // 2. Afternoon Cron (Monday - Friday at specified time, pre-market Wall Street)
  const afternoonCron = `${afternoonMin || 0} ${afternoonHour || 15} * * 1-5`;
  const afternoonTask = cron.schedule(
    afternoonCron,
    () => {
      executeScheduledScan('15:00 PRE-MARKET USA').catch((e) => console.error(e));
    },
    { timezone: 'Europe/Rome' }
  );
  scheduledTasks.push(afternoonTask);

  // 3. Hourly quick safety check (Monday - Friday, 09:00 to 22:00 Rome time)
  const hourlyCron = '15 9-22 * * 1-5';
  const hourlyTask = cron.schedule(
    hourlyCron,
    () => {
      executeHourlyPortfolioCheck().catch((e) => console.error(e));
    },
    { timezone: 'Europe/Rome' }
  );
  scheduledTasks.push(hourlyTask);

  isSchedulerRunning = true;
  console.log(
    `[SCHEDULER] Inizializzati i cron job (Mattina: ${settings.morningScanTime}, Pomeriggio: ${settings.afternoonScanTime}, Monitor orario attivo).`
  );
}

export function isSchedulerActive(): boolean {
  return isSchedulerRunning;
}
