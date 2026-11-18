// Revolut Trading & Risk Management Engine

export interface RevolutPlanConfig {
  name: string;
  monthlyFreeTrades: number;
  commissionRate: number; // e.g. 0.0025 (0.25%)
  minCommissionEur: number; // 1.00 EUR
  custodyFeePercent: number; // 0.12% annual / 12 per month (waived by Revolut in EU since 2023)
}

export const REVOLUT_PLANS: Record<string, RevolutPlanConfig> = {
  Standard: {
    name: 'Standard',
    monthlyFreeTrades: 1,
    commissionRate: 0.0025,
    minCommissionEur: 1.0,
    custodyFeePercent: 0,
  },
  Plus: {
    name: 'Plus',
    monthlyFreeTrades: 3,
    commissionRate: 0.0025,
    minCommissionEur: 1.0,
    custodyFeePercent: 0,
  },
  Premium: {
    name: 'Premium',
    monthlyFreeTrades: 5,
    commissionRate: 0.0025,
    minCommissionEur: 1.0,
    custodyFeePercent: 0,
  },
  Metal: {
    name: 'Metal',
    monthlyFreeTrades: 10,
    commissionRate: 0.0025,
    minCommissionEur: 1.0,
    custodyFeePercent: 0,
  },
  Ultra: {
    name: 'Ultra',
    monthlyFreeTrades: 10,
    commissionRate: 0.0012,
    minCommissionEur: 1.0,
    custodyFeePercent: 0,
  },
};

/**
 * Checks if current UTC time falls in Revolut's weekend FX markup window.
 * FX markets close Friday at 17:00 NY time (22:00 UTC) and open Sunday at 17:00 NY time (22:00 UTC).
 */
export function isWeekendFxMarkupActive(date = new Date()): {
  isWeekend: boolean;
  markupPercent: number;
  warning: string | null;
} {
  const day = date.getUTCDay(); // 0 is Sunday, 5 is Friday, 6 is Saturday
  const hour = date.getUTCHours();

  let isWeekend = false;

  if (day === 6) {
    // Saturday: all day
    isWeekend = true;
  } else if (day === 0) {
    // Sunday: until 22:00 UTC
    isWeekend = hour < 22;
  } else if (day === 5) {
    // Friday: after 22:00 UTC
    isWeekend = hour >= 22;
  }

  return {
    isWeekend,
    markupPercent: isWeekend ? 1.0 : 0.0,
    warning: isWeekend
      ? "Weekend FX Markup attivo (+1% sul cambio valuta EUR/USD). Evita conversioni di valuta prima di domenica alle 23:00 italiane."
      : null,
  };
}

/**
 * Returns current US stock market status (Wall Street NYSE/NASDAQ)
 * Regular trading hours: 09:30 - 16:00 US Eastern (15:30 - 22:00 Italian time CET)
 */
export function getMarketTradingHoursStatus(date = new Date()): {
  isOpen: boolean;
  message: string;
  isPreMarket: boolean;
} {
  // Convert current time to Italy CET / CEST
  const itTimeStr = date.toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour12: false });
  const [hours, minutes] = itTimeStr.split(':').map(Number);
  const itDay = date.getDay(); // 0 Sunday, 6 Saturday

  if (itDay === 0 || itDay === 6) {
    return {
      isOpen: false,
      message: 'Mercati USA chiusi (Weekend). Riapertura lunedì alle 15:30.',
      isPreMarket: false,
    };
  }

  const currentMinutes = hours * 60 + minutes;
  const marketOpenMinutes = 15 * 60 + 30; // 15:30
  const marketCloseMinutes = 22 * 60; // 22:00
  const preMarketStartMinutes = 10 * 60; // 10:00

  if (currentMinutes >= marketOpenMinutes && currentMinutes < marketCloseMinutes) {
    return {
      isOpen: true,
      message: 'Mercato USA APERTO (Sessione Regolare NYSE/NASDAQ).',
      isPreMarket: false,
    };
  }

  if (currentMinutes >= preMarketStartMinutes && currentMinutes < marketOpenMinutes) {
    return {
      isOpen: false,
      message: 'Fase di Pre-Market USA. Apertura regolare prevista per le 15:30 italiane.',
      isPreMarket: true,
    };
  }

  return {
    isOpen: false,
    message: 'Mercato USA Chiuso (After-Hours o Notte). Riapertura alle 15:30.',
    isPreMarket: false,
  };
}

/**
 * Calculate SEC and FINRA TAF regulatory selling fees
 */
export function calculateUsRegulatoryFees(shares: number, salePriceUSD: number): number {
  const secRate = 0.0000278; // $27.80 per million dollars
  const secFee = Math.max(0.01, shares * salePriceUSD * secRate);

  const tafRate = 0.000166; // $0.000166 per share
  const tafFee = Math.min(8.3, Math.max(0.01, shares * tafRate));

  return parseFloat((secFee + tafFee).toFixed(4));
}

/**
 * Calculate single-trade Revolut commission
 */
export function calculateRevolutTradeCommissionUSD(
  orderValueUSD: number,
  eurUsdRate: number,
  planName = 'Premium',
  hasFreeTradesRemaining = false
): number {
  if (hasFreeTradesRemaining) {
    return 0.0;
  }

  const plan = REVOLUT_PLANS[planName] || REVOLUT_PLANS.Premium;
  const variableFeeUSD = orderValueUSD * plan.commissionRate;
  const minFeeUSD = plan.minCommissionEur * eurUsdRate;

  return Math.max(minFeeUSD, variableFeeUSD);
}

/**
 * Calculate realistic Break-Even price on Revolut
 */
export function calculateRevolutBreakEvenPrice(
  entryPriceUSD: number,
  shares: number,
  eurUsdRate: number,
  planName = 'Premium',
  freeTradesRemaining = 5
): number {
  if (shares <= 0 || entryPriceUSD <= 0) return entryPriceUSD;

  const buyOrderValueUSD = entryPriceUSD * shares;
  const hasBuySlot = freeTradesRemaining > 0;
  const buyFeeUSD = calculateRevolutTradeCommissionUSD(buyOrderValueUSD, eurUsdRate, planName, hasBuySlot);

  // Estimating sell fee and regulatory fees at entry level
  const hasSellSlot = freeTradesRemaining > 1;
  const estimatedSellFeeUSD = calculateRevolutTradeCommissionUSD(buyOrderValueUSD, eurUsdRate, planName, hasSellSlot);
  const estimatedRegulatoryFeesUSD = calculateUsRegulatoryFees(shares, entryPriceUSD);

  const totalRoundtripFeesUSD = buyFeeUSD + estimatedSellFeeUSD + estimatedRegulatoryFeesUSD;
  const breakEvenUSD = entryPriceUSD + totalRoundtripFeesUSD / shares;

  return parseFloat(breakEvenUSD.toFixed(3));
}

export interface PositionSizingParams {
  liquidityEur: number;
  riskPercentage: number;
  entryPriceUSD: number;
  stopLossPriceUSD: number;
  takeProfit1USD: number;
  takeProfit2USD?: number;
  eurUsdRate: number;
  planName?: string;
  freeTradesRemaining?: number;
}

export interface PositionSizingResult {
  fractionalShares: number;
  recommendedInvestmentEUR: number;
  recommendedInvestmentUSD: number;
  breakEvenPriceUSD: number;
  maxNetLossEUR: number;
  netProfitTP1EUR: number;
  netProfitTP2EUR: number;
  riskRewardRatio: string;
  roundtripFeesUSD: number;
  timingWarning: string;
  worthUsingSlot: boolean;
}

/**
 * Full Position Sizing & Revolut Risk Optimizer
 */
export function calculateRevolutPositionSizing(params: PositionSizingParams): PositionSizingResult {
  const {
    liquidityEur,
    riskPercentage,
    entryPriceUSD,
    stopLossPriceUSD,
    takeProfit1USD,
    takeProfit2USD = takeProfit1USD * 1.08,
    eurUsdRate,
    planName = 'Premium',
    freeTradesRemaining = 5,
  } = params;

  const weekendStatus = isWeekendFxMarkupActive();
  const effectiveEurUsdRate = weekendStatus.isWeekend ? eurUsdRate * 0.99 : eurUsdRate;

  // Max capital at risk in EUR
  const maxRiskAmountEUR = (liquidityEur * Math.max(0.1, Math.min(riskPercentage, 5.0))) / 100;
  const maxRiskAmountUSD = maxRiskAmountEUR * effectiveEurUsdRate;

  // Technical risk per share
  const priceDistance = Math.abs(entryPriceUSD - stopLossPriceUSD);
  const riskPerShareUSD = priceDistance > 0.01 ? priceDistance : entryPriceUSD * 0.05;

  // Raw theoretical shares
  let calculatedShares = maxRiskAmountUSD / riskPerShareUSD;

  // Safe portfolio allocation cap: max 30% of total liquidity in a single trade
  const maxInvestmentCapEUR = Math.min(liquidityEur * 0.35, liquidityEur);
  const maxInvestmentCapUSD = maxInvestmentCapEUR * effectiveEurUsdRate;

  if (calculatedShares * entryPriceUSD > maxInvestmentCapUSD) {
    calculatedShares = maxInvestmentCapUSD / entryPriceUSD;
  }

  // Revolut supports up to 4 decimal places for fractional shares
  const fractionalShares = Math.max(0.0001, parseFloat(calculatedShares.toFixed(4)));

  const totalInvestmentUSD = fractionalShares * entryPriceUSD;
  const recommendedInvestmentEUR = parseFloat((totalInvestmentUSD / effectiveEurUsdRate).toFixed(2));

  // Roundtrip Fees
  const buyFee = calculateRevolutTradeCommissionUSD(
    totalInvestmentUSD,
    effectiveEurUsdRate,
    planName,
    freeTradesRemaining > 0
  );
  const sellFee = calculateRevolutTradeCommissionUSD(
    fractionalShares * takeProfit1USD,
    effectiveEurUsdRate,
    planName,
    freeTradesRemaining > 1
  );
  const regFees = calculateUsRegulatoryFees(fractionalShares, takeProfit1USD);
  const roundtripFeesUSD = parseFloat((buyFee + sellFee + regFees).toFixed(2));

  // Break-even
  const breakEvenPriceUSD = calculateRevolutBreakEvenPrice(
    entryPriceUSD,
    fractionalShares,
    effectiveEurUsdRate,
    planName,
    freeTradesRemaining
  );

  // Net P&L scenarios
  const grossLossUSD = fractionalShares * (entryPriceUSD - stopLossPriceUSD);
  const maxNetLossEUR = parseFloat(((grossLossUSD + roundtripFeesUSD) / effectiveEurUsdRate).toFixed(2));

  const grossProfitTP1USD = fractionalShares * (takeProfit1USD - entryPriceUSD);
  const netProfitTP1EUR = parseFloat(Math.max(0, (grossProfitTP1USD - roundtripFeesUSD) / effectiveEurUsdRate).toFixed(2));

  const grossProfitTP2USD = fractionalShares * (takeProfit2USD - entryPriceUSD);
  const netProfitTP2EUR = parseFloat(Math.max(0, (grossProfitTP2USD - roundtripFeesUSD) / effectiveEurUsdRate).toFixed(2));

  // Risk / Reward Ratio
  const rrValue = maxNetLossEUR > 0 ? (netProfitTP1EUR / maxNetLossEUR).toFixed(1) : '2.5';
  const riskRewardRatio = `1 : ${rrValue}`;

  // Timing warning
  const marketStatus = getMarketTradingHoursStatus();
  let timingWarning = marketStatus.message;
  if (weekendStatus.warning) {
    timingWarning += ' ' + weekendStatus.warning;
  }

  // Is it worth using a free trade slot?
  // Worth if investment > 300 EUR and potential profit > 3x the 1€ minimum commission
  const worthUsingSlot = recommendedInvestmentEUR >= 300 && netProfitTP1EUR > 15;

  return {
    fractionalShares,
    recommendedInvestmentEUR,
    recommendedInvestmentUSD: parseFloat(totalInvestmentUSD.toFixed(2)),
    breakEvenPriceUSD,
    maxNetLossEUR,
    netProfitTP1EUR,
    netProfitTP2EUR,
    riskRewardRatio,
    roundtripFeesUSD,
    timingWarning,
    worthUsingSlot,
  };
}
