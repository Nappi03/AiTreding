'use client';

import React, { useState } from 'react';
import {
  Wallet,
  Clock,
  Send,
  Globe2,
  RefreshCw,
  MinusCircle,
  AlertTriangle,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';

interface TopBarProps {
  marketStatus: {
    eurUsdRate: number;
    weekend: {
      isWeekend: boolean;
      markupPercent: number;
      warning: string | null;
    };
    marketHours: {
      isOpen: boolean;
      message: string;
      isPreMarket: boolean;
    };
    settings: {
      liquidityEur: number;
      riskPercentage: number;
      revolutPlan: string;
      freeTradesRemaining: number;
    };
    geopoliticalStatus: {
      hasTodayBrief: boolean;
      sentiment: string;
      createdAt?: string;
    };
  } | null;
  portfolioSummary: {
    totalValueEUR: number;
    totalPnlEUR: number;
    totalPnlPercent: number;
  } | null;
  onRefreshAll: () => void;
  onOpenSettings: () => void;
  onTriggerGeopoliticalBrief: () => void;
  onDecrementTrade: () => void;
  isRefreshing?: boolean;
}

export function TopBar({
  marketStatus,
  portfolioSummary,
  onRefreshAll,
  onOpenSettings,
  onTriggerGeopoliticalBrief,
  onDecrementTrade,
  isRefreshing = false,
}: TopBarProps) {
  const [isDecreasing, setIsDecreasing] = useState(false);

  const handleDecrementTrade = async () => {
    setIsDecreasing(true);
    try {
      await onDecrementTrade();
    } finally {
      setIsDecreasing(false);
    }
  };

  const isWeekend = marketStatus?.weekend?.isWeekend;
  const isMarketOpen = marketStatus?.marketHours?.isOpen;
  const isPreMarket = marketStatus?.marketHours?.isPreMarket;
  const freeTrades = marketStatus?.settings?.freeTradesRemaining ?? 0;
  const pnlEUR = portfolioSummary?.totalPnlEUR ?? 0;
  const pnlPercent = portfolioSummary?.totalPnlPercent ?? 0;
  const hasBrief = marketStatus?.geopoliticalStatus?.hasTodayBrief;

  return (
    <header className="sticky top-0 z-40 bg-[#070a0f]/95 backdrop-blur border-b border-[#1f293d] px-3 sm:px-6 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-2.5">
        
        {/* Brand & Market Hours Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center font-bold text-black text-sm shadow-md shadow-amber-500/20">
              AI
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-wide text-white uppercase">AiTrading</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {marketStatus?.settings?.revolutPlan || 'Revolut'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isMarketOpen ? 'bg-emerald-500 animate-pulse' : isPreMarket ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'
                  }`}
                />
                <span className="truncate max-w-[200px] sm:max-w-xs text-[11px]">
                  {marketStatus?.marketHours?.message || 'Mercati USA'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Mobile Action Buttons */}
          <div className="flex md:hidden items-center gap-1.5">
            <button
              onClick={onRefreshAll}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
              title="Aggiorna Dati"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              onClick={onOpenSettings}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
              title="Impostazioni"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:flex md:items-center gap-2 text-xs">
          
          {/* Liquidità Revolut */}
          <div className="bg-[#0d131f] border border-[#1f293d] rounded-lg px-2.5 py-1.5 flex items-center justify-between sm:justify-start gap-2">
            <Wallet className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">Liquidità</div>
              <div className="num-mono font-bold text-white text-[13px]">
                {marketStatus?.settings?.liquidityEur ? `€${marketStatus.settings.liquidityEur.toLocaleString('it-IT')}` : '€--'}
              </div>
            </div>
          </div>

          {/* P&L Portafoglio */}
          <div className="bg-[#0d131f] border border-[#1f293d] rounded-lg px-2.5 py-1.5">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">P&L Portafoglio</div>
            <div
              className={`num-mono font-bold text-[13px] ${
                pnlEUR >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {pnlEUR >= 0 ? '+' : ''}€{pnlEUR.toFixed(2)} ({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(1)}%)
            </div>
          </div>

          {/* Trade Gratuiti Revolut & Decrement Button */}
          <div className="bg-[#0d131f] border border-[#1f293d] rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">Trade Gratuiti</div>
              <div className="num-mono font-bold text-[13px] text-amber-400 flex items-center gap-1">
                <span>{freeTrades} rimasti</span>
              </div>
            </div>
            <button
              onClick={handleDecrementTrade}
              disabled={isDecreasing || freeTrades <= 0}
              className="text-[10px] font-mono px-1.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-0.5 transition-colors disabled:opacity-40"
              title="Clicca quando esegui un trade su Revolut per scalare 1 slot"
            >
              <MinusCircle className="w-3 h-3" />
              <span>-1</span>
            </button>
          </div>

          {/* Cambio EUR/USD & Weekend Fee Indicator */}
          <div
            className={`border rounded-lg px-2.5 py-1.5 transition-colors ${
              isWeekend
                ? 'bg-amber-950/30 border-amber-500/40 text-amber-300'
                : 'bg-[#0d131f] border-[#1f293d] text-white'
            }`}
            title={marketStatus?.weekend?.warning || 'Tasso di cambio EUR/USD live'}
          >
            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-mono flex items-center justify-between">
              <span>EUR/USD</span>
              {isWeekend && (
                <span className="text-[9px] font-bold text-amber-400 flex items-center gap-0.5">
                  <AlertTriangle className="w-2.5 h-2.5" /> +1% Wkd
                </span>
              )}
            </div>
            <div className="num-mono font-bold text-[13px]">
              {marketStatus?.eurUsdRate ? marketStatus.eurUsdRate.toFixed(4) : '1.0850'}
            </div>
          </div>

          {/* Daily Geopolitical Brief Status */}
          <button
            onClick={onTriggerGeopoliticalBrief}
            className={`hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-left transition-colors ${
              hasBrief
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300 hover:bg-emerald-950/40'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Visualizza o rigenera il Master Report Geopolitico del giorno"
          >
            <Globe2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <div>
              <div className="text-[9px] uppercase tracking-wider font-mono text-slate-400">Report Macro</div>
              <div className="text-[11px] font-semibold flex items-center gap-1">
                {hasBrief ? 'Aggiornato Oggi' : 'Genera Ora'}
              </div>
            </div>
          </button>

          {/* Desktop Refresh & Settings */}
          <div className="hidden md:flex items-center gap-1.5">
            <button
              onClick={onRefreshAll}
              disabled={isRefreshing}
              className="p-2 rounded-lg bg-slate-900/90 border border-[#1f293d] text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
              title="Aggiorna Dati e Quotazioni"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-lg bg-slate-900/90 border border-[#1f293d] text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
              title="Impostazioni e Credenziali"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

      </div>
    </header>
  );
}
