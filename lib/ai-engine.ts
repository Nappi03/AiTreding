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

/**
 * Robust helper that cascades through available high-performance models:
 * gemini-4-hydrogen -> gemini-3.8-flash -> gemini-3.7-flash -> gemini-3.5-flash-lite -> gemini-3.1-flash-lite
 * If a model is unavailable (503 high demand), deprecated (404), or search quota is hit (429),
 * it seamlessly and instantly tries the next model in the cascade without failing.
 */
async function generateContentWithFallback(
  ai: GoogleGenAI,
  options: {
    models?: string[];
    preferredModel?: string;
    fallbackModel?: string;
    prompt: string;
    useSearch?: boolean;
    thinkingBudget?: number;
  }
): Promise<string> {
  const defaultCascade = [
    'gemini-4-hydrogen',
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
  ];

  const modelsToTry: string[] = options.models || [
    ...(options.preferredModel ? [options.preferredModel] : []),
    ...(options.fallbackModel ? [options.fallbackModel] : []),
    ...defaultCascade,
  ].filter((v, i, a) => a.indexOf(v) === i);

  let lastError: any = null;

  for (const model of modelsToTry) {
    // Attempt 1: with search if requested
    if (options.useSearch) {
      try {
        const config: any = { responseMimeType: 'application/json', tools: [{ googleSearch: {} }] };
        const res = await ai.models.generateContent({ model, contents: options.prompt, config });
        if (res.text) return res.text;
      } catch (err: any) {
        lastError = err;
        console.warn(`[AI Engine] ${model} con Google Search non riuscito (${err.status || err.message}). Riprovo senza search...`);
      }
    }

    // Attempt 2: robust JSON generation without search tool (avoids 429 search quota)
    try {
      const config: any = { responseMimeType: 'application/json' };
      const res = await ai.models.generateContent({ model, contents: options.prompt, config });
      if (res.text) return res.text;
    } catch (err: any) {
      lastError = err;
      console.warn(`[AI Engine] ${model} non disponibile (${err.status || err.message}). Tento modello successivo...`);
    }
  }

  throw lastError || new Error('Tutti i modelli AI disponibili sono attualmente occupati o non raggiungibili.');
}

// ==============================================================================
// LIVELLO 1: Cosa Succede nel Mondo Oggi (Notizie & Economia)
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
Sei un consulente finanziario ed economico di fiducia.
Il tuo compito è spiegare a un amico intelligente (che NON è un esperto di finanza) cosa sta succedendo nel mondo oggi (${today}) e come queste notizie impattano i suoi investimenti azionari.

REGOLA TASSATIVA SUL LINGUAGGIO (MASSIMA PRIORITÀ):
- Scrivi in italiano limpido, semplice, diretto e amichevole.
- È ASSOLUTAMENTE VIETATO usare gergo tecnico o frasi da Wall Street non spiegate (NON usare termini come 'repricing del rischio', '5y5y breakeven', 'Equity Risk Premium', 'postura netta long', 'rischio spike sul Brent', 'disancoraggio delle aspettative').
- Spiega sempre CAUSA ED EFFETTO in modo pratico: per ogni notizia, chiarisci concretamente cosa succede e perché fa salire o scendere i mercati. Esempio pratico: se c'è tensione in Medio Oriente o nel Mar Rosso, spiega che le navi mercantili devono fare percorsi più lunghi, i costi di trasporto salgono, il petrolio costa di più e questo fa aumentare le spese per le aziende, riducendo i loro profitti.

Ultime notizie catturate dai feed RSS:
${rssContext}

Focalizzati su:
1. Guerre e tensioni geopolitiche (Medio Oriente, Mar Rosso, Ucraina) e impatto sui costi di petrolio e trasporti.
2. Rapporti e dazi tra USA, Cina ed Europa: come impattano le vendite delle grandi aziende tecnologiche.
3. Decisioni delle Banche Centrali (FED americana e BCE europea) sui tassi d'interesse: se il denaro costa di più o di meno.
4. Chip e intelligenza artificiale: novità importanti su componenti e server (Nvidia, TSMC, ASML).
5. Energia e materie prime: petrolio e gas naturale.

Restituisci la risposta ESCLUSIVAMENTE in formato JSON con questa struttura:
{
  "title": "Titolo chiaro e comprensibile sul clima dei mercati oggi",
  "summary": "Spiegazione approfondita, fluida e chiara (3-4 paragrafi ben separati). Spiega con semplicità cosa sta succedendo e perché un investitore comune dovrebbe stare attento o approfittarne.",
  "keyRisks": [
    "Fattore da tenere d'occhio 1 (spiegato in modo semplice e concreto)...",
    "Fattore da tenere d'occhio 2...",
    "Fattore da tenere d'occhio 3...",
    "Fattore da tenere d'occhio 4..."
  ],
  "marketSentiment": "BULLISH" | "BEARISH" | "NEUTRAL" | "HIGH_VOLATILITY",
  "sources": ["Google Search Grounding", "Reuters", "CNBC"]
}
  `.trim();

  const text = await generateContentWithFallback(ai, {
    preferredModel: 'gemini-4-hydrogen',
    prompt,
    useSearch: true,
  });

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    parsed = JSON.parse(cleaned);
  }

  const report: GeopoliticalReport = {
    date: today,
    title: parsed.title || `Cosa Succede nel Mondo Oggi - ${today}`,
    summary: parsed.summary || 'Quadro economico mondiale elaborato.',
    keyRisks: Array.isArray(parsed.keyRisks) ? parsed.keyRisks : ['Tassi di interesse e inflazione', 'Tensioni geopolitiche'],
    marketSentiment: parsed.marketSentiment || 'NEUTRAL',
    sources: Array.isArray(parsed.sources) ? parsed.sources : ['Google Search', 'Reuters', 'CNBC'],
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
// LIVELLO 2: Controllo Rapido (gemini-3.8-flash / gemini-2.5-flash)
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

  const summaryForFlash = triageData.map((d) => ({
    ticker: d.ticker,
    name: d.quote.name,
    price: d.quote.currentPrice,
    changePercent: d.quote.changePercent,
    trend: d.indicators.trend,
    rsi: d.indicators.rsi14,
    signals: d.indicators.technicalSignals,
    news: d.newsHeadlines,
  }));

  const prompt = `
Sei un assistente personale che controlla rapidamente i titoli del giorno per un investitore.
Valuta questi titoli azionari e assegna a ciascuno un 'priorityScore' (punteggio di attenzione) da 0 a 100:

Criteri per il punteggio:
- 80-100: Sta succedendo qualcosa di molto rilevante (forte calo o rimbalzo, trimestrale importante, notizia clamorosa o occasione d'oro).
- 50-79: Titolo stabile, trend ordinario senza urgenze.
- 0-49: Giornata noiosa o laterale, niente di interessante.

REGOLA SUL LINGUAGGIO:
In 'catalystSummary' scrivi una singola frase in italiano semplice e colloquiale che spieghi a colpo d'occhio il motivo principale (es. "Forte calo ieri per timori sui dazi, possibile rimbalzo" o "Buoni risultati trimestrali con vendite sopra le attese"). Non usare formule complesse o gergo da sala trading.

Dati dei titoli:
${JSON.stringify(summaryForFlash, null, 2)}

Restituisci un JSON con un array di oggetti:
[
  {
    "ticker": "NVDA",
    "priorityScore": 88,
    "catalystSummary": "Breve frase semplice e chiara in italiano"
  }
]
  `.trim();

  const rawFlashText = await generateContentWithFallback(ai, {
    preferredModel: 'gemini-4-hydrogen',
    prompt,
    useSearch: false,
  });

  let parsed: Array<{ ticker: string; priorityScore: number; catalystSummary: string }> = [];
  try {
    parsed = JSON.parse(rawFlashText);
  } catch (err) {
    const cleaned = rawFlashText.replace(/```json/g, '').replace(/```/g, '').trim();
    parsed = JSON.parse(cleaned);
  }

  const results: TriageResult[] = [];

  for (const item of triageData) {
    const flashEval = parsed.find((p) => p.ticker.toUpperCase() === item.ticker.toUpperCase());
    const score = flashEval?.priorityScore ?? 50;
    const catalyst = flashEval?.catalystSummary ?? 'Situazione regolare di mercato';

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
// LIVELLO 3: Analisi Completa (gemini-2.5-pro / gemini-3.8-flash)
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

export async function runDeepHedgeFundAnalysis(
  ticker: string,
  options?: { skipAutoTelegram?: boolean }
): Promise<DeepAnalysisOutput> {
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

  const ai = createGeminiClient(apiKey);

  const prompt = `
Sei il consulente finanziario privato di fiducia di un utente che investe i propri risparmi tramite l'applicazione **Revolut** (Piano attivo: ${revolutPlan}).
Devi analizzare in profondità il titolo **${symbol}** (${quote.name}) e spiegargli in modo chiaro, amichevole e trasparente cosa fare oggi.

REGOLA TASSATIVA SUL LINGUAGGIO (MASSIMA PRIORITÀ):
- Parla come a un amico intelligente che vuole investire bene ma NON è un trader di professione.
- È ASSOLUTAMENTE VIETATO usare gergo tecnico incomprensibile (MAI usare termini come 'repricing del rischio', '5y5y breakeven', 'Equity Risk Premium', 'beta elevato', 'postura netta long', 'confluenza algoritmica', 'compressione dei multipli').
- Quando citi un indicatore (es. RSI o Medie), spiega sempre cosa vuol dire in pratica (es. "Il titolo è sceso molto negli ultimi giorni ed è a buon prezzo, quindi c'è spazio per un rimbalzo", oppure "Ha corso troppo ultimamente ed è surriscaldato, meglio aspettare che ritracci").
- Spiega sempre:
  1. Cosa sta succedendo all'azienda e nel mondo.
  2. Perché questo fa salire o scendere il prezzo del titolo.
  3. Cosa fare esattamente su Revolut (se comprare, a quale prezzo limite e dove mettere lo Stop Loss di sicurezza).

=== CONTESTO ECONOMICO E NOTIZIE DI OGGI ===
Titolo: ${geoBrief.title}
Clima Generale: ${geoBrief.marketSentiment}
Sintesi: ${geoBrief.summary}
Cosa tenere d'occhio: ${geoBrief.keyRisks.join(' | ')}

=== DATI DI MERCATO ATTUALI ===
Titolo: ${symbol} (${quote.name})
Prezzo Attuale: $${quote.currentPrice} (${quote.change >= 0 ? '+' : ''}${quote.changePercent}%)
Cambio EUR/USD Live: ${eurUsdRate}
Massimo 12 Mesi: $${quote.fiftyTwoWeekHigh} | Minimo 12 Mesi: $${quote.fiftyTwoWeekLow}
P/E (Rapporto Prezzo/Utili): ${quote.peRatio || 'N/A'}

=== LIVELLI TECNICI MATEMATICI ===
- Trend Principale: ${indicators.trend}
- RSI (14): ${indicators.rsi14} (Sotto 30 = titolo svenduto/a sconto; Sopra 70 = comprato troppo/caro)
- Prezzo Medio 20 Giorni: $${indicators.sma20} | 50 Giorni: $${indicators.sma50} | 200 Giorni: $${indicators.ema200}
- Volatilità Media Giornaliera (ATR 14): $${indicators.atr14}
- Pavimento di Supporto (dove il prezzo tende a rimbalzare): $${indicators.supportLevelUSD}
- Tetto di Resistenza (dove il prezzo fatica a salire): $${indicators.resistanceLevelUSD}
- Stop Loss Matematico di Sicurezza: $${indicators.suggestedStopLossUSD}
- Primo Obiettivo di Guadagno (TP1): $${indicators.suggestedTakeProfit1USD}
- Secondo Obiettivo di Guadagno (TP2): $${indicators.suggestedTakeProfit2USD}

=== PARAMETRI CONTO REVOLUT ===
- Liquidità Disponibile: ${liquidityEur} EUR
- Rischio Massimo per Operazione: ${riskPercentage}% (Massima perdita consentita se scatta lo stop: ${(liquidityEur * (riskPercentage / 100)).toFixed(2)} EUR)
- Piano Revolut: ${revolutPlan}
- Trade Gratuiti Rimasti nel mese: ${freeTradesRemaining}
- Calcoli di Base:
  * Numero Azioni Frazionarie: ${mathSizing.fractionalShares}
  * Euro Consigliati da Investire: ${mathSizing.recommendedInvestmentEUR} EUR
  * Prezzo di Pareggio Reale (Break-Even): $${mathSizing.breakEvenPriceUSD}

=== ULTIME NOTIZIE SPECIFICHE SULL'AZIENDA ===
${companyNews.map((n) => `- [${n.source}] ${n.title}`).join('\n') || 'Nessuna breaking news recente specifica.'}

COMPITO:
Usa Google Search per cercare notizie dell'ultima ora su "${symbol} stock news earnings issues" (trimestrali, problemi ai fornitori, cause legali, annunci recenti).
Restituisci la scheda operativa ESATTAMENTE in formato JSON:

{
  "verdict": "COMPRA ORA" | "ORDINE LIMITE (COMPRA SUL RIBASSO)" | "MANTIENI (HOLD)" | "PRENDI PROFITTO PARZIALE" | "VENDI TUTTO",
  "convictionScore": 0-100,
  "worthUsingRevolutSlot": boolean,
  "thesisSummary": "Spiegazione chiara, sincera e diretta in italiano semplice del perché comprare, vendere o aspettare adesso",
  "geopoliticalAndMacroAnalysis": "Cosa succede nel mondo (guerre, dazi, tassi, energia) e come impatta concretamente su questa azienda e sui suoi guadagni futuri",
  "companyCatalysts": "Notizie recenti dell'azienda (nuovi prodotti, utili, clienti, problemi ai server) spiegate in modo facile",
  "technicalConfluence": "Cosa dicono i prezzi e i grafici: se il titolo è salito troppo o sceso tanto, dove si trovano i livelli di supporto e sicurezza",
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
    "timingWarning": "Consiglio pratico sugli orari di mercato e sul cambio valuta Revolut"
  }
}
  `.trim();

  const rawText = await generateContentWithFallback(ai, {
    preferredModel: 'gemini-4-hydrogen',
    prompt,
    useSearch: true,
  });

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
    thesisSummary: parsed.thesisSummary || `Analisi chiara e diretta di ${symbol}.`,
    geopoliticalAndMacroAnalysis: parsed.geopoliticalAndMacroAnalysis || 'Quadro economico valutato.',
    companyCatalysts: parsed.companyCatalysts || 'Novità aziendali analizzate.',
    technicalConfluence: parsed.technicalConfluence || 'Grafici e prezzi valutati.',
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
  // If skipAutoTelegram is false (e.g. manual single-stock analysis)
  if (!options?.skipAutoTelegram) {
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
  }

  return analysisOutput;
}
