import yahooFinance from 'yahoo-finance2';

// In-memory short-term cache for EUR/USD rate (valid for 5 minutes)
let cachedEurUsd: { rate: number; timestamp: number } | null = null;

export async function getLiveEurUsdRate(): Promise<number> {
  const now = Date.now();
  if (cachedEurUsd && now - cachedEurUsd.timestamp < 5 * 60 * 1000) {
    return cachedEurUsd.rate;
  }

  try {
    const result = (await yahooFinance.quote('EURUSD=X')) as any;
    if (result && result.regularMarketPrice) {
      cachedEurUsd = {
        rate: result.regularMarketPrice,
        timestamp: now,
      };
      return result.regularMarketPrice;
    }
  } catch (error) {
    console.warn('Failed to fetch live EURUSD=X rate, using fallback:', error);
  }

  return cachedEurUsd?.rate || 1.085;
}

export interface StockQuote {
  ticker: string;
  name: string;
  currency: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  open: number;
  previousClose: number;
  volume: number;
  marketCap?: number;
  peRatio?: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  updatedAt: string;
}

export async function getStockQuote(ticker: string): Promise<StockQuote> {
  try {
    const quote = (await yahooFinance.quote(ticker)) as any;
    const currentPrice = quote.regularMarketPrice || quote.postMarketPrice || quote.preMarketPrice || 0;
    const previousClose = quote.regularMarketPreviousClose || currentPrice;
    const change = quote.regularMarketChange ?? (currentPrice - previousClose);
    const changePercent = quote.regularMarketChangePercent ?? (previousClose ? (change / previousClose) * 100 : 0);

    return {
      ticker: ticker.toUpperCase(),
      name: quote.shortName || quote.longName || ticker,
      currency: quote.currency || 'USD',
      currentPrice: parseFloat(currentPrice.toFixed(2)),
      change: parseFloat(change.toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(2)),
      dayHigh: quote.regularMarketDayHigh || currentPrice,
      dayLow: quote.regularMarketDayLow || currentPrice,
      open: quote.regularMarketOpen || currentPrice,
      previousClose: parseFloat(previousClose.toFixed(2)),
      volume: quote.regularMarketVolume || 0,
      marketCap: quote.marketCap,
      peRatio: quote.trailingPE,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh || currentPrice,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow || currentPrice,
      updatedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    console.error(`Error fetching quote for ${ticker}:`, err?.message || err);
    throw new Error(`Impossibile recuperare quotazione per ${ticker}: ${err?.message}`);
  }
}

export interface HistoricalCandle {
  date: string;
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function getHistoricalCandles(ticker: string, days = 200): Promise<HistoricalCandle[]> {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const history = (await yahooFinance.historical(ticker, {
      period1: startDate,
      period2: endDate,
      interval: '1d',
    })) as any[];

    if (!Array.isArray(history) || history.length === 0) {
      throw new Error(`Nessun dato storico disponibile per ${ticker}`);
    }

    return history.map((candle: any) => {
      const d = new Date(candle.date);
      const isoDate = d.toISOString().split('T')[0];
      return {
        date: isoDate,
        time: Math.floor(d.getTime() / 1000),
        open: parseFloat(candle.open.toFixed(2)),
        high: parseFloat(candle.high.toFixed(2)),
        low: parseFloat(candle.low.toFixed(2)),
        close: parseFloat(candle.close.toFixed(2)),
        volume: candle.volume || 0,
      };
    });
  } catch (error: any) {
    console.error(`Failed to fetch history for ${ticker}:`, error?.message);
    throw error;
  }
}
