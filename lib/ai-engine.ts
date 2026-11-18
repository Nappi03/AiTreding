import { GoogleGenAI, Type } from '@google/genai';
import { prisma } from './prisma';
import { getLiveEurUsdRate, getStockQuote, StockQuote } from './market-data';
import { calculateStockIndicators, CalculatedIndicators } from './technical-indicators';
import { fetchCompanyBreakingNews, fetchGlobalMacroNews } from './news-service';
import {
  calculateRevolutPositionSizing,
  isWeekendFxMarkupActive,
  getMarketTradingHoursStatus,
} from './revolut-engine';
import { sendRevolutActionCardTelegram, sendUrgentPortfolioAlertTelegram } from './telegram-service';

/**
 * Retrieve Gemini API Key from SQLite settings or process.env
 */
export async function getGeminiApiKey(): Promise<string | null> {
  const settings = await prisma.accountSettings.findUnique({
    where: { id: 'default' },
  });

  const key = settings?.geminiApiKey?.trim() || process.env.GEMINI_API_KEY?.trim() || '';
  return key.length > 0 ? key : null;
}

export function createGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({ apiKey });
}

// ==============================================================================
// LIVELO 1: Global Geopolitical Daily Brief (gemini-2.5-pro + googleSearch)
// ==============================================================================

export interface GeopoliticalReport {
  date: string;
  title: string;
  summary: string;
  keyRisks: string[];
  marketSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'HIGH_VOLATILITY';
  sources?: string[];
}

export async function getOrGenerateGeopoliticalBrief(forceRefresh = false): Promise<GeopoliticalReport> {
  const today = new Date().toISOString().split('T')[0];

  if (!forceRefresh) {
    const existing = await prisma.geopoliticalBrief.findUnique({
      where: { date: today },
    });
    if (existing) {
      return {
        date: existing.date,
        title: existing.title,
        summary: existing.summary,
        keyRisks: JSON.parse(existing.keyRisks || '[]'),
        marketSentiment: existing.marketSentiment as any,
        sources: existing.sources ? JSON.parse(existing.sources) : [],
      };
    }
  }

  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Chiave API Gemini mancante. Configurala in Impostazioni o nel file .env (GEMINI_API_KEY).');
  }

  const ai = createGeminiClient(apiKey);
  const macroRss = await fetchGlobalMacroNews();
  const rssContext = macroRss.map((m) => `- [${m.source}] ${m.title}`).join('\n');

  const prompt = `
Sei il Chief Global Macro & Geopolitical Strategist di un Hedge Fund quantitativo.
Data attuale: ${today}.

Ultime notizie finanziarie e macroeconomiche rilevate via RSS:
${rssContext}

Compito:
Usa Google Search per raccogliere le notizie più critiche delle ultime 24 ore a livello globale e redigi il "Master Report Geopolitico e Macroeconomico Giornaliero" per orientare le decisioni di trading su azioni quotate a Wall Street.

Focalizzati su:
1. Guerre e focolai geopolitici (Medio Oriente, Mar Rosso/Stretto di Hormuz, Ucraina).
2. Tensioni USA-Cina-Taiwan, dazi commerciali e guerra tecnologica.
3. Banche Centrali (FED, BCE), tassi d'interesse, inflazione e rendimenti dei Treasury USA.
4. Supply chain globale dei semiconduttori (Nvidia, TSMC, ASML) e colli di bottiglia AI.
5. Mercato energetico (Petrolio Brent/WTI, Gas naturale).

Restituisci la risposta ESCLUSIVAMENTE in formato JSON con la seguente struttura:
{
  "title": "Titolo d'impatto sul quadro macroeconomico di oggi",
  "summary": "Analisi approfondita, dettagliata e lucida in lingua italiana (3-4 paragrafi ben strutturati con impatti pratici per gli investitori)",
  "keyRisks": [
    "Rischio 1: ...",
    "Rischio 2: ...",
    "Rischio 3: ...",
    "Rischio 4: ..."
  ],
  "marketSentiment": "BULLISH" | "BEARISH" | "NEUTRAL" | "HIGH_VOLATILITY",
  "sources": ["Fonte 1", "Fonte 2"]
}
  `.trim();

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: 'application/json',
    },
  });

  const text = response.text || '{}';
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    // Clean potential markdown wrap if any
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    parsed = JSON.parse(cleaned);
  }

  const report: GeopoliticalReport = {
    date: today,
    title: parsed.title || `Quadro Geopolitico Globale - ${today}`,
    summary: parsed.summary || 'Analisi macroeconomica generata.',
    keyRisks: Array.isArray(parsed.keyRisks) ? parsed.keyRisks : ['Volatilità tassi', 'Tensioni geopolitiche'],
    marketSentiment: parsed.marketSentiment || 'NEUTRAL',
    sources: Array.isArray(parsed.sources) ? parsed.sources : ['Google Search Grounding', 'Reuters', 'CNBC'],
  };

  await prisma.geopoliticalBrief.upsert({
    where: { date: today },
    update: {
      title: report.title,
      summary: report.summary,
      keyRisks: JSON.stringify(report.keyRisks),
      marketSentiment: report.marketSentiment,
      sources: JSON.stringify(report.sources),
    },
    create: {
      date: today,
      title: report.title,
      summary: report.summary,
      keyRisks: JSON.stringify(report.keyRisks),
      marketSentiment: report.marketSentiment,
      sources: JSON.stringify(report.sources),
    },
  });

  return report;
}

// ==============================================================================
// LIVELLO 2: Fast Market Triage (gemini-2.5-flash)
// ==============================================================================

export interface TriageResult {
  ticker: string;
  priorityScore: number; // 0 - 100
  catalystSummary: string;
  technicalTrend: string;
  currentPrice: number;
}

export async function runFastWatchlistTriage(
  tickers?: string[]
): Promise<TriageResult[]> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Chiave API Gemini mancante. Configurala in Impostazioni.');
  }

  // Load watchlist from database if tickers not specified
  let targetTickers = tickers;
  if (!targetTickers || targetTickers.length === 0) {
    const dbWatchlist = await prisma.watchlist.findMany({
      select: { ticker: true },
    });
    targetTickers = dbWatchlist.map((w) => w.ticker);
  }

  if (targetTickers.length === 0) {
    return [];
  }

  const ai = createGeminiClient(apiKey);
  const triageData: Array<{
    ticker: string;
    quote: StockQuote;
    indicators: CalculatedIndicators;
    newsHeadlines: string[];
  }> = [];

  // 1. Compute local technical indicators and collect news
  for (const t of targetTickers) {
    try {
      const quote = await getStockQuote(t);
      const { indicators } = await calculateStockIndicators(t);
      const news = await fetchCompanyBreakingNews(t, quote.name);
      triageData.push({
        ticker: t,
        quote,
        indicators,
        newsHeadlines: news.slice(0, 4).map((n) => n.title),
      });
    } catch (err: any) {
      console.warn(`Skipping ${t} during triage: ${err.message}`);
    }
  }

  if (triageData.length === 0) {
    return [];
  }

  // Build condensed prompt for gemini-2.5-flash
  const summaryForFlash = triageData.map((d) => ({
    ticker: d.ticker,
    name: d.quote.name,
    price: d.quote.currentPrice,
    changePercent: d.quote.changePercent,
    trend: d.indicators.trend,
    rsi: d.indicators.rsi14,
    macdHist: d.indicators.macd?.histogram,
    signals: d.indicators.technicalSignals,
    news: d.newsHeadlines,
  }));

  const prompt = `
Sei un Quant Market Screener ad alta velocità.
Valuta questi titoli azionari e assegna a ciascuno un 'priorityScore' da 0 a 100 che indichi l'urgenza di approfondimento oggi.
Criteri punteggio:
- 80-100: Grandi catalizzatori in corso, breakout tecnico imminente, forte ipervenduto con rimbalzo o allarme critico.
- 50-79: Setup interessante, trend consolidato ma senza emergenza immediata.
- 0-49: Mercato laterale, no catalizzatori freschi.

Dati dei titoli:
${JSON.stringify(summaryForFlash, null, 2)}

Restituisci un JSON con un array di oggetti:
[
  {
    "ticker": "NVDA",
    "priorityScore": 88,
    "catalystSummary": "Breve frase in italiano con il fattore scatenante (tecnico o fondamentale)"
  }
]
  `.trim();

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
    },
  });

  let parsed: Array<{ ticker: string; priorityScore: number; catalystSummary: string }> = [];
  try {
    parsed = JSON.parse(response.text || '[]');
  } catch (err) {
    const cleaned = (response.text || '').replace(/```json/g, '').replace(/```/g, '').trim();
    parsed = JSON.parse(cleaned);
  }

  const results: TriageResult[] = [];

  for (const item of triageData) {
    const flashEval = parsed.find((p) => p.ticker.toUpperCase() === item.ticker.toUpperCase());
    const score = flashEval?.priorityScore ?? 50;
    const catalyst = flashEval?.catalystSummary ?? 'Monitoraggio tecnico regolare';

    // Update SQLite Watchlist
    await prisma.watchlist.updateMany({
      where: { ticker: item.ticker },
      data: {
        priorityScore: score,
        triageSummary: catalyst,
        lastTriageAt: new Date(),
      },
    });

    results.push({
      ticker: item.ticker,
      priorityScore: score,
      catalystSummary: catalyst,
      technicalTrend: item.indicators.trend,
      currentPrice: item.quote.currentPrice,
    });
  }

  // Sort by priorityScore descending
  results.sort((a, b) => b.priorityScore - a.priorityScore);
  return results;
}

// ==============================================================================
// LIVELLO 3: Deep Hedge-Fund Analysis (gemini-2.5-pro + thinkingConfig: 32768)
// ==============================================================================

export interface DeepAnalysisOutput {
  id?: string;
  ticker: string;
  date: string;
  verdict:
    | 'COMPRA ORA'
    | 'ORDINE LIMITE (COMPRA SUL RIBASSO)'
    | 'MANTIENI (HOLD)'
    | 'PRENDI PROFITTO PARZIALE'
    | 'VENDI TUTTO';
  convictionScore: number;
  worthUsingRevolutSlot: boolean;
  thesisSummary: string;
  geopoliticalAndMacroAnalysis: string;
  companyCatalysts: string;
  technicalConfluence: string;
  revolutExecutionPlan: {
    orderType: 'Ordine di Mercato' | 'Ordine Limite (Limit Order)' | 'Stop Order';
    idealEntryPriceUSD: number;
    breakEvenPriceUSD: number;
    stopLossPriceUSD: number;
    takeProfit1USD: number;
    takeProfit2USD: number;
    riskRewardRatio: string;
    recommendedInvestmentEUR: number;
    fractionalSharesToBuy: number;
    netProfitAtTP1EUR: number;
    maxNetLossAtStopEUR: number;
    timingWarning: string;
  };
  rawIndicators: CalculatedIndicators;
}

export async function runDeepHedgeFundAnalysis(ticker: string): Promise<DeepAnalysisOutput> {
  const symbol = ticker.toUpperCase();
  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Chiave API Gemini mancante. Inseriscila nella pagina Impostazioni.');
  }

  // 1. Get today's geopolitical master brief (cached on SQLite)
  const geoBrief = await getOrGenerateGeopoliticalBrief();

  // 2. Fetch live market quote, EUR/USD FX rate and technical indicators
  const quote = await getStockQuote(symbol);
  const eurUsdRate = await getLiveEurUsdRate();
  const { candles, indicators } = await calculateStockIndicators(symbol);
  const companyNews = await fetchCompanyBreakingNews(symbol, quote.name);

  // 3. Get Account & Revolut settings
  const settings = await prisma.accountSettings.findUnique({
    where: { id: 'default' },
  });
  const liquidityEur = settings?.availableLiquidityEur ?? 10000;
  const riskPercentage = settings?.riskPercentage ?? 1.5;
  const revolutPlan = settings?.revolutPlan ?? 'Premium';
  const freeTradesRemaining = settings?.freeTradesRemaining ?? 5;

  // 4. Mathematical baseline position sizing
  const mathSizing = calculateRevolutPositionSizing({
    liquidityEur,
    riskPercentage,
    entryPriceUSD: quote.currentPrice,
    stopLossPriceUSD: indicators.suggestedStopLossUSD,
    takeProfit1USD: indicators.suggestedTakeProfit1USD,
    takeProfit2USD: indicators.suggestedTakeProfit2USD,
    eurUsdRate,
    planName: revolutPlan,
    freeTradesRemaining,
  });

  // 5. Query gemini-2.5-pro with thinking budget 32768 & Google Search
  const ai = createGeminiClient(apiKey);

  const prompt = `
Sei il Senior Portfolio Manager & Quantitative Risk Architect di un Hedge Fund globale di prima fascia.
Devi analizzare in profondità il titolo **${symbol}** (${quote.name}) per un investitore privato che esegue le operazioni MANUALMENTE sull'applicazione **Revolut** (Piano: ${revolutPlan}).

NON inventare numeri casuali: calibra l'analisi sui calcoli matematici oggettivi forniti di seguito.

=== CONTESTO MACRO & GEOPOLITICO ODIERNO (MASTER BRIEFING) ===
Titolo: ${geoBrief.title}
Sentiment Globale: ${geoBrief.marketSentiment}
Sintesi Geopolitica: ${geoBrief.summary}
Fattori di Rischio Chiave: ${geoBrief.keyRisks.join(' | ')}

=== DATI DI MERCATO & TECNICI OGGETTIVI ===
Ticker: ${symbol} (${quote.name})
Prezzo Attuale: $${quote.currentPrice} (${quote.change >= 0 ? '+' : ''}${quote.changePercent}%)
Cambio EUR/USD Live: ${eurUsdRate}
Massimo 52 Settimane: $${quote.fiftyTwoWeekHigh} | Minimo 52 Settimane: $${quote.fiftyTwoWeekLow}
P/E Ratio: ${quote.peRatio || 'N/A'} | Volumi Giornalieri: ${quote.volume}

=== INDICATORI MATEMATICI CALCOLATI ===
- Trend Primario: ${indicators.trend}
- RSI (14): ${indicators.rsi14}
- SMA 20: $${indicators.sma20} | SMA 50: $${indicators.sma50} | EMA 200: $${indicators.ema200}
- MACD Histogram: ${indicators.macd?.histogram ?? 'N/A'} (MACD: ${indicators.macd?.macd}, Signal: ${indicators.macd?.signal})
- Bande di Bollinger: Inferiore $${indicators.bollingerBands?.lower}, Media $${indicators.bollingerBands?.middle}, Superiore $${indicators.bollingerBands?.upper} (Bandwidth: ${indicators.bollingerBands?.bandwidth}%)
- ATR 14: $${indicators.atr14}
- Supporto Tecnico Dinamico: $${indicators.supportLevelUSD}
- Resistenza Tecnica Dinamica: $${indicators.resistanceLevelUSD}
- Stop Loss Matematico (Base ATR/Supporti): $${indicators.suggestedStopLossUSD}
- Take Profit 1 Target: $${indicators.suggestedTakeProfit1USD}
- Take Profit 2 Target: $${indicators.suggestedTakeProfit2USD}
- Segnali Tecnici Rilevati: ${indicators.technicalSignals.join('; ')}

=== PARAMETRI CONTO REVOLUT & RISK MANAGEMENT ===
- Liquidità Disponibile: ${liquidityEur} EUR
- Rischio Massimo per Operazione: ${riskPercentage}% (Max perdita consentita: ${(liquidityEur * (riskPercentage / 100)).toFixed(2)} EUR)
- Piano Revolut: ${revolutPlan}
- Trade Gratuiti Residui nel mese: ${freeTradesRemaining}
- Calcolo Preliminare Baseline:
  * Azioni frazionate: ${mathSizing.fractionalShares}
  * Investimento consigliato: ${mathSizing.recommendedInvestmentEUR} EUR
  * Prezzo di pareggio calcolato (incluse commissioni): $${mathSizing.breakEvenPriceUSD}
  * Rischio/Rendimento: ${mathSizing.riskRewardRatio}

=== RECENTI NOTIZIE AZIENDALI ===
${companyNews.map((n) => `- [${n.source}] ${n.title}`).join('\n') || 'Nessuna breaking news recente specifica.'}

COMPITO:
Usa Google Search per cercare notizie dell'ultima ora su "${symbol} stock news earnings issues" (es. problemi ai server Nvidia, cause antitrust, trimestrali, downgrade/upgrade di analisti).
Esegui un ragionamento approfondito (deep hedge fund thinking) e restituisci la scheda operativa ESATTAMENTE in formato JSON con questi campi:

{
  "verdict": "COMPRA ORA" | "ORDINE LIMITE (COMPRA SUL RIBASSO)" | "MANTIENI (HOLD)" | "PRENDI PROFITTO PARZIALE" | "VENDI TUTTO",
  "convictionScore": 0-100,
  "worthUsingRevolutSlot": boolean,
  "thesisSummary": "Spiegazione chiara, autorevole e diretta in italiano del perché comprare o vendere adesso",
  "geopoliticalAndMacroAnalysis": "Impatto concreto del quadro geopolitico e macroeconomico odierno sul modello di business e sui margini del titolo",
  "companyCatalysts": "Analisi delle notizie specifiche dell'azienda, annunci recenti, catena di fornitura ed earnings",
  "technicalConfluence": "Lettura integrata dei calcoli matematici (RSI, Medie Mobili, Volumi, Bande di Bollinger e ATR)",
  "revolutExecutionPlan": {
    "orderType": "Ordine di Mercato" | "Ordine Limite (Limit Order)" | "Stop Order",
    "idealEntryPriceUSD": number,
    "breakEvenPriceUSD": number,
    "stopLossPriceUSD": number,
    "takeProfit1USD": number,
    "takeProfit2USD": number,
    "riskRewardRatio": "1 : X.X",
    "recommendedInvestmentEUR": number,
    "fractionalSharesToBuy": number,
    "netProfitAtTP1EUR": number,
    "maxNetLossAtStopEUR": number,
    "timingWarning": "Avviso sugli orari dei mercati e cambio valuta Revolut"
  }
}
  `.trim();

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: prompt,
    config: {
      thinkingConfig: {
        thinkingBudget: 32768,
      },
      tools: [{ googleSearch: {} }],
      responseMimeType: 'application/json',
    },
  });

  const rawText = response.text || '{}';
  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    parsed = JSON.parse(cleaned);
  }

  // Refine and validate execution plan with actual mathematical formulas
  const entryUSD = parsed.revolutExecutionPlan?.idealEntryPriceUSD || quote.currentPrice;
  const slUSD = parsed.revolutExecutionPlan?.stopLossPriceUSD || indicators.suggestedStopLossUSD;
  const tp1USD = parsed.revolutExecutionPlan?.takeProfit1USD || indicators.suggestedTakeProfit1USD;
  const tp2USD = parsed.revolutExecutionPlan?.takeProfit2USD || indicators.suggestedTakeProfit2USD;

  // Run sizing based on Gemini's entry/SL levels to ensure strict adherence to Revolut math
  const calibratedSizing = calculateRevolutPositionSizing({
    liquidityEur,
    riskPercentage,
    entryPriceUSD: entryUSD,
    stopLossPriceUSD: slUSD,
    takeProfit1USD: tp1USD,
    takeProfit2USD: tp2USD,
    eurUsdRate,
    planName: revolutPlan,
    freeTradesRemaining,
  });

  const finalPlan = {
    orderType: parsed.revolutExecutionPlan?.orderType || 'Ordine Limite (Limit Order)',
    idealEntryPriceUSD: parseFloat(entryUSD.toFixed(2)),
    breakEvenPriceUSD: calibratedSizing.breakEvenPriceUSD,
    stopLossPriceUSD: parseFloat(slUSD.toFixed(2)),
    takeProfit1USD: parseFloat(tp1USD.toFixed(2)),
    takeProfit2USD: parseFloat(tp2USD.toFixed(2)),
    riskRewardRatio: calibratedSizing.riskRewardRatio,
    recommendedInvestmentEUR: calibratedSizing.recommendedInvestmentEUR,
    fractionalSharesToBuy: calibratedSizing.fractionalShares,
    netProfitAtTP1EUR: calibratedSizing.netProfitTP1EUR,
    maxNetLossAtStopEUR: calibratedSizing.maxNetLossEUR,
    timingWarning: parsed.revolutExecutionPlan?.timingWarning || calibratedSizing.timingWarning,
  };

  const today = new Date().toISOString().split('T')[0];

  const analysisOutput: DeepAnalysisOutput = {
    ticker: symbol,
    date: today,
    verdict: parsed.verdict || 'MANTIENI (HOLD)',
    convictionScore: Math.min(100, Math.max(0, parsed.convictionScore ?? 70)),
    worthUsingRevolutSlot: parsed.worthUsingRevolutSlot ?? calibratedSizing.worthUsingSlot,
    thesisSummary: parsed.thesisSummary || `Analisi tecnica e fondamentale di ${symbol}.`,
    geopoliticalAndMacroAnalysis: parsed.geopoliticalAndMacroAnalysis || 'Quadro macroeconomico valutato.',
    companyCatalysts: parsed.companyCatalysts || 'Catalizzatori aziendali analizzati.',
    technicalConfluence: parsed.technicalConfluence || 'Confluenza tecnica calcolata.',
    revolutExecutionPlan: finalPlan,
    rawIndicators: indicators,
  };

  // Save to SQLite
  const savedRecord = await prisma.aiAnalysis.create({
    data: {
      ticker: symbol,
      date: today,
      verdict: analysisOutput.verdict,
      convictionScore: analysisOutput.convictionScore,
      worthUsingRevolutSlot: analysisOutput.worthUsingRevolutSlot,
      thesisSummary: analysisOutput.thesisSummary,
      geopoliticalAndMacroAnalysis: analysisOutput.geopoliticalAndMacroAnalysis,
      companyCatalysts: analysisOutput.companyCatalysts,
      technicalConfluence: analysisOutput.technicalConfluence,
      revolutExecutionPlan: JSON.stringify(finalPlan),
      rawIndicators: JSON.stringify(indicators),
    },
  });

  analysisOutput.id = savedRecord.id;

  // Check if ticker is in portfolio to evaluate alerts
  const ownedPosition = await prisma.portfolioPosition.findUnique({
    where: { ticker: symbol },
  });

  // Automated Telegram alert dispatch:
  // 1. High conviction buy opportunity (convictionScore >= 75)
  if (
    (analysisOutput.verdict === 'COMPRA ORA' || analysisOutput.verdict.includes('COMPRA')) &&
    analysisOutput.convictionScore >= 75
  ) {
    sendRevolutActionCardTelegram(analysisOutput).catch((e) =>
      console.warn('Auto Telegram Action Card failed:', e?.message)
    );
  }

  // 2. Urgent sell alert on owned portfolio stock
  if (
    ownedPosition &&
    (analysisOutput.verdict === 'VENDI TUTTO' || analysisOutput.verdict === 'PRENDI PROFITTO PARZIALE')
  ) {
    sendUrgentPortfolioAlertTelegram({
      ticker: symbol,
      verdict: analysisOutput.verdict,
      currentPrice: quote.currentPrice,
      stopLossPrice: finalPlan.stopLossPriceUSD,
      takeProfitPrice: finalPlan.takeProfit1USD,
      reason: analysisOutput.thesisSummary,
    }).catch((e) => console.warn('Auto Telegram Urgent Alert failed:', e?.message));
  }

  return analysisOutput;
}
