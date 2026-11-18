import YahooFinance from 'yahoo-finance2';

// In yahoo-finance2 v4+, YahooFinance must be instantiated:
const YFClass = (YahooFinance as any).default || YahooFinance;
const yf =
  typeof YFClass === 'function'
    ? new YFClass({ suppressNotices: ['yahooSurvey', 'ripHistorical'] })
    : YahooFinance;

// Short-term caches (in-memory) to prevent rate limits and ensure instant UI loads
let cachedEurUsd: { rate: number; timestamp: number } | null = null;
const quoteCache: Map<string, { quote: StockQuote; timestamp: number }> = new Map();

export async function getLiveEurUsdRate(): Promise<number> {
  const now = Date.now();
  if (cachedEurUsd && now - cachedEurUsd.timestamp < 3 * 60 * 1000) {
    return cachedEurUsd.rate;
  }

  try {
    const result = (await yf.quote('EURUSD=X')) as any;
    const price = result?.regularMarketPrice || result?.ask || result?.bid;
    if (price && typeof price === 'number') {
      cachedEurUsd = {
        rate: price,
        timestamp: now,
      };
      return price;
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
  const symbol = ticker.toUpperCase().trim();
  const now = Date.now();

  // Return cached quote if fresh (under 45 seconds)
  const cached = quoteCache.get(symbol);
  if (cached && now - cached.timestamp < 45 * 1000) {
    return cached.quote;
  }

  try {
    const quote = (await yf.quote(symbol)) as any;
    const previousClose = quote?.regularMarketPreviousClose || quote?.previousClose || 0;
    
    // Determine the most accurate live price
    let currentPrice =
      quote?.regularMarketPrice ||
      quote?.postMarketPrice ||
      quote?.preMarketPrice ||
      previousClose ||
      0;

    const change = quote?.regularMarketChange ?? (previousClose ? currentPrice - previousClose : 0);
    const changePercent = quote?.regularMarketChangePercent ?? (previousClose && previousClose > 0 ? (change / previousClose) * 100 : 0);

    const stockQuote: StockQuote = {
      ticker: symbol,
      name: quote?.shortName || quote?.longName || symbol,
      currency: quote?.currency || 'USD',
      currentPrice: parseFloat(currentPrice.toFixed(2)),
      change: parseFloat(change.toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(2)),
      dayHigh: quote?.regularMarketDayHigh || currentPrice,
      dayLow: quote?.regularMarketDayLow || currentPrice,
      open: quote?.regularMarketOpen || currentPrice,
      previousClose: parseFloat(previousClose.toFixed(2)),
      volume: quote?.regularMarketVolume || quote?.volume || 0,
      marketCap: quote?.marketCap,
      peRatio: quote?.trailingPE,
      fiftyTwoWeekHigh: quote?.fiftyTwoWeekHigh || currentPrice,
      fiftyTwoWeekLow: quote?.fiftyTwoWeekLow || currentPrice,
      updatedAt: new Date().toISOString(),
    };

    quoteCache.set(symbol, { quote: stockQuote, timestamp: now });
    return stockQuote;
  } catch (err: any) {
    console.error(`Error fetching quote for ${symbol}:`, err?.message || err);
    
    // If we have any cached version (even stale), return it rather than failing
    if (cached) {
      return cached.quote;
    }

    throw new Error(`Impossibile recuperare quotazione per ${symbol}: ${err?.message}`);
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

    const history = (await yf.historical(ticker, {
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
        open: parseFloat((candle.open ?? candle.close).toFixed(2)),
        high: parseFloat((candle.high ?? candle.close).toFixed(2)),
        low: parseFloat((candle.low ?? candle.close).toFixed(2)),
        close: parseFloat(candle.close.toFixed(2)),
        volume: candle.volume || 0,
      };
    });
  } catch (error: any) {
    console.error(`Failed to fetch history for ${ticker}:`, error?.message);
    throw error;
  }
}
