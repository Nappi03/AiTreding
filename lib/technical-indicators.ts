import { SMA, EMA, RSI, MACD, BollingerBands, ATR } from 'technicalindicators';
import { getHistoricalCandles, HistoricalCandle } from './market-data';

export interface CalculatedIndicators {
  currentPrice: number;
  sma20: number | null;
  sma50: number | null;
  ema200: number | null;
  rsi14: number | null;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
  } | null;
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
    bandwidth: number;
  } | null;
  atr14: number;
  supportLevelUSD: number;
  resistanceLevelUSD: number;
  suggestedStopLossUSD: number;
  suggestedTakeProfit1USD: number;
  suggestedTakeProfit2USD: number;
  trend: 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG_BEARISH';
  technicalSignals: string[];
}

export async function calculateStockIndicators(
  ticker: string,
  candles?: HistoricalCandle[]
): Promise<{ candles: HistoricalCandle[]; indicators: CalculatedIndicators }> {
  const history = candles || (await getHistoricalCandles(ticker, 250));

  if (history.length < 30) {
    throw new Error(`Dati storici insufficienti per ${ticker} (trovati solo ${history.length} giorni)`);
  }

  const closes = history.map((c) => c.close);
  const highs = history.map((c) => c.high);
  const lows = history.map((c) => c.low);
  const currentPrice = closes[closes.length - 1];

  // 1. SMA 20
  const sma20Array = SMA.calculate({ period: 20, values: closes });
  const sma20 = sma20Array.length > 0 ? parseFloat(sma20Array[sma20Array.length - 1].toFixed(2)) : null;

  // 2. SMA 50
  const sma50Array = SMA.calculate({ period: 50, values: closes });
  const sma50 = sma50Array.length > 0 ? parseFloat(sma50Array[sma50Array.length - 1].toFixed(2)) : null;

  // 3. EMA 200 (se ci sono abbastanza candele, altrimenti usiamo il massimo disponibile)
  const emaPeriod = closes.length >= 200 ? 200 : Math.min(closes.length, 100);
  const ema200Array = EMA.calculate({ period: emaPeriod, values: closes });
  const ema200 = ema200Array.length > 0 ? parseFloat(ema200Array[ema200Array.length - 1].toFixed(2)) : null;

  // 4. RSI (14)
  const rsiArray = RSI.calculate({ period: 14, values: closes });
  const rsi14 = rsiArray.length > 0 ? parseFloat(rsiArray[rsiArray.length - 1].toFixed(1)) : null;

  // 5. MACD (12, 26, 9)
  const macdArray = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });
  const latestMacd = macdArray.length > 0 ? macdArray[macdArray.length - 1] : null;
  const macd = latestMacd
    ? {
        macd: parseFloat((latestMacd.MACD || 0).toFixed(2)),
        signal: parseFloat((latestMacd.signal || 0).toFixed(2)),
        histogram: parseFloat((latestMacd.histogram || 0).toFixed(2)),
      }
    : null;

  // 6. Bollinger Bands (20, 2)
  const bbArray = BollingerBands.calculate({ period: 20, stdDev: 2, values: closes });
  const latestBb = bbArray.length > 0 ? bbArray[bbArray.length - 1] : null;
  const bollingerBands = latestBb
    ? {
        upper: parseFloat(latestBb.upper.toFixed(2)),
        middle: parseFloat(latestBb.middle.toFixed(2)),
        lower: parseFloat(latestBb.lower.toFixed(2)),
        bandwidth: parseFloat((((latestBb.upper - latestBb.lower) / latestBb.middle) * 100).toFixed(2)),
      }
    : null;

  // 7. ATR (14)
  const atrArray = ATR.calculate({ period: 14, high: highs, low: lows, close: closes });
  const atr14 = atrArray.length > 0 ? parseFloat(atrArray[atrArray.length - 1].toFixed(2)) : currentPrice * 0.03;

  // 8. Support & Resistance (Swing high/low recenti negli ultimi 40 giorni)
  const recentDays = Math.min(40, history.length);
  const recentCandles = history.slice(-recentDays);
  const recentMinLow = Math.min(...recentCandles.map((c) => c.low));
  const recentMaxHigh = Math.max(...recentCandles.map((c) => c.high));

  // Dynamic Support: nearest support below current price
  let supportLevelUSD = recentMinLow;
  if (sma50 && sma50 < currentPrice && sma50 > supportLevelUSD) {
    supportLevelUSD = sma50;
  }
  if (bollingerBands && bollingerBands.lower < currentPrice && bollingerBands.lower > supportLevelUSD) {
    supportLevelUSD = bollingerBands.lower;
  }
  supportLevelUSD = parseFloat(supportLevelUSD.toFixed(2));

  // Dynamic Resistance
  let resistanceLevelUSD = recentMaxHigh;
  if (bollingerBands && bollingerBands.upper > currentPrice) {
    resistanceLevelUSD = Math.max(resistanceLevelUSD, bollingerBands.upper);
  }
  resistanceLevelUSD = parseFloat(resistanceLevelUSD.toFixed(2));

  // Objective technical Stop Loss:
  // Nearest support floor minus 0.5 * ATR, or currentPrice - 2 * ATR
  const atrStopDistance = atr14 * 2.0;
  const candidateStop = currentPrice - atrStopDistance;
  const supportStop = supportLevelUSD - atr14 * 0.5;
  const suggestedStopLossUSD = parseFloat(
    Math.max(currentPrice * 0.75, Math.min(candidateStop, supportStop)).toFixed(2)
  );

  // Take Profit Targets
  const suggestedTakeProfit1USD = parseFloat((currentPrice + atr14 * 2.5).toFixed(2));
  const suggestedTakeProfit2USD = parseFloat((currentPrice + atr14 * 4.0).toFixed(2));

  // Trend determination & Technical signals
  const technicalSignals: string[] = [];
  let bullishPoints = 0;

  if (sma20 && currentPrice > sma20) {
    bullishPoints += 1;
    technicalSignals.push(`Prezzo sopra SMA 20 ($${sma20})`);
  } else if (sma20) {
    bullishPoints -= 1;
    technicalSignals.push(`Prezzo sotto SMA 20 ($${sma20})`);
  }

  if (sma50 && currentPrice > sma50) {
    bullishPoints += 1;
    technicalSignals.push(`Trend primario sopra SMA 50 ($${sma50})`);
  } else if (sma50) {
    bullishPoints -= 1;
  }

  if (ema200 && currentPrice > ema200) {
    bullishPoints += 2;
    technicalSignals.push(`Macro-trend sopra EMA 200 ($${ema200})`);
  } else if (ema200) {
    bullishPoints -= 2;
    technicalSignals.push(`Macro-trend sotto EMA 200 ($${ema200})`);
  }

  if (rsi14 !== null) {
    if (rsi14 < 32) {
      bullishPoints += 2;
      technicalSignals.push(`RSI(14) in forte ipervenduto (${rsi14}) - Possibile rimbalzo tecnico`);
    } else if (rsi14 > 72) {
      bullishPoints -= 2;
      technicalSignals.push(`RSI(14) in ipercomprato (${rsi14}) - Rischio ritracciamento`);
    } else {
      technicalSignals.push(`RSI(14) neutrale/sano (${rsi14})`);
    }
  }

  if (macd && macd.histogram > 0) {
    bullishPoints += 1;
    technicalSignals.push(`Istogramma MACD positivo (+${macd.histogram})`);
  } else if (macd) {
    bullishPoints -= 1;
    technicalSignals.push(`Istogramma MACD negativo (${macd.histogram})`);
  }

  let trend: 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG_BEARISH' = 'NEUTRAL';
  if (bullishPoints >= 4) trend = 'STRONG_BULLISH';
  else if (bullishPoints >= 1) trend = 'BULLISH';
  else if (bullishPoints <= -4) trend = 'STRONG_BEARISH';
  else if (bullishPoints <= -1) trend = 'BEARISH';

  const indicators: CalculatedIndicators = {
    currentPrice,
    sma20,
    sma50,
    ema200,
    rsi14,
    macd,
    bollingerBands,
    atr14,
    supportLevelUSD,
    resistanceLevelUSD,
    suggestedStopLossUSD,
    suggestedTakeProfit1USD,
    suggestedTakeProfit2USD,
    trend,
    technicalSignals,
  };

  return { candles: history, indicators };
}
