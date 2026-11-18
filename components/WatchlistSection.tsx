'use client';

import React, { useState } from 'react';
import {
  ListFilter,
  Plus,
  Trash2,
  Sparkles,
  Activity,
  ArrowUpRight,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';

interface WatchlistItem {
  id: string;
  ticker: string;
  name: string;
  sector?: string;
  currency: string;
  priorityScore?: number | null;
  triageSummary?: string | null;
  currentPrice?: number | null;
  change?: number;
  changePercent?: number;
  rsi14?: number | null;
  trend?: string;
  sma20?: number | null;
  sma50?: number | null;
  signals?: string[];
}

interface WatchlistSectionProps {
  watchlist: WatchlistItem[];
  onRefresh: () => void;
  onTriggerTriage: () => void;
  onSelectTickerForDeepAnalysis: (ticker: string) => void;
  isTriaging: boolean;
}

export function WatchlistSection({
  watchlist,
  onRefresh,
  onTriggerTriage,
  onSelectTickerForDeepAnalysis,
  isTriaging,
}: WatchlistSectionProps) {
  const [newTicker, setNewTicker] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const handleAddTicker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicker.trim()) return;

    setIsAdding(true);
    setAddError(null);

    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: newTicker.trim().toUpperCase() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Errore aggiunta ticker');
      }

      setNewTicker('');
      onRefresh();
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteTicker = async (ticker: string) => {
    try {
      await fetch(`/api/watchlist?ticker=${ticker}`, { method: 'DELETE' });
      onRefresh();
    } catch (err) {
      console.warn('Failed to delete watchlist ticker:', err);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header & Quick Add */}
      <div className="bg-[#0d131f] border border-[#1f293d] rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ListFilter className="w-4 h-4 text-amber-400" />
            <h2 className="text-base font-black text-white uppercase font-mono tracking-wider">
              Titoli Osservati & Analisi
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              {watchlist.length} Titoli
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Prezzi live sempre aggiornati, indicatori spiegati in modo semplice e controllo rapido con l'AI
          </p>
        </div>

        {/* Add Ticker Form */}
        <form onSubmit={handleAddTicker} className="flex items-center gap-2">
          <input
            type="text"
            value={newTicker}
            onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
            placeholder="Aggiungi Ticker (es. ASML)"
            className="w-44 bg-[#111827] border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono uppercase focus:border-amber-500 outline-none"
          />
          <button
            type="submit"
            disabled={isAdding || !newTicker.trim()}
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs font-mono uppercase flex items-center gap-1 transition-colors disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isAdding ? '...' : 'Aggiungi'}</span>
          </button>
          <button
            type="button"
            onClick={onTriggerTriage}
            disabled={isTriaging}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Avvia controllo rapido con l'AI su tutti i titoli osservati"
          >
            <Activity className={`w-3.5 h-3.5 ${isTriaging ? 'animate-spin' : ''}`} />
            <span>Controllo Rapido</span>
          </button>
        </form>
      </div>

      {addError && (
        <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-mono">
          {addError}
        </div>
      )}

      {/* Watchlist Grid / Table */}
      <div className="bg-[#0b101c] border border-[#1f293d] rounded-xl overflow-hidden">
        <div className="divide-y divide-[#1f293d]">
          {watchlist.map((item) => {
            const changePct = item.changePercent ?? 0;
            const isUp = changePct >= 0;
            const score = item.priorityScore ?? 0;

            return (
              <div
                key={item.id}
                className="p-4 transition-colors hover:bg-slate-900/50 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
              >
                {/* Left: Ticker & Name */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center font-mono font-black text-sm text-amber-400 shrink-0">
                    {item.ticker.slice(0, 4)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white font-mono text-base">{item.ticker}</span>
                      <span className="text-xs text-slate-400 truncate max-w-[150px] sm:max-w-xs">{item.name}</span>
                      {item.sector && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                          {item.sector}
                        </span>
                      )}
                    </div>
                    {item.triageSummary && (
                      <p className="text-[11px] text-amber-200/90 font-mono mt-0.5">
                        ⚡️ {item.triageSummary}
                      </p>
                    )}
                  </div>
                </div>

                {/* Middle: Math Indicators & Live Quote */}
                <div className="flex items-center gap-4 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Prezzo Live</span>
                    <span className="text-sm font-bold text-white">${item.currentPrice ?? '--'}</span>
                    <span className={`text-[10px] block ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isUp ? '+' : ''}{changePct.toFixed(2)}%
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">RSI (14)</span>
                    <span
                      className={`text-xs font-bold ${
                        (item.rsi14 ?? 50) < 32
                          ? 'text-cyan-400'
                          : (item.rsi14 ?? 50) > 70
                          ? 'text-rose-400'
                          : 'text-slate-300'
                      }`}
                      title="Indica se un titolo è stato comprato troppo (sopra 70) o svenduto (sotto 30)"
                    >
                      {item.rsi14 ?? 'N/A'}
                    </span>
                    <span className="text-[9px] text-slate-500 block max-w-[90px] leading-tight">
                      {(item.rsi14 ?? 50) < 32 ? 'Svenduto (rimbalzo?)' : (item.rsi14 ?? 50) > 70 ? 'Comprato troppo' : 'Neutrale'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">Trend</span>
                    <span className="text-xs font-semibold text-emerald-400">
                      {item.trend === 'STRONG_BULLISH'
                        ? 'Salita Forte 🚀'
                        : item.trend === 'BULLISH'
                        ? 'In Salita 📈'
                        : item.trend === 'BEARISH'
                        ? 'In Discesa 📉'
                        : item.trend === 'STRONG_BEARISH'
                        ? 'Discesa Forte ⚠️'
                        : 'Laterale / Stabile ⚖️'}
                    </span>
                    <span className="text-[9px] text-slate-500 block">Direzione prezzo</span>
                  </div>

                  {/* Priority Score from Flash Triage */}
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-semibold">Priorità AI</span>
                    <span
                      className={`num-mono font-black text-sm ${
                        score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-slate-400'
                      }`}
                    >
                      {score > 0 ? `${score}/100` : '--'}
                    </span>
                    <span className="text-[9px] text-slate-500 block">Occasione</span>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center justify-end gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                  <button
                    onClick={() => onSelectTickerForDeepAnalysis(item.ticker)}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Analisi Completa</span>
                  </button>

                  <button
                    onClick={() => handleDeleteTicker(item.ticker)}
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-800"
                    title="Rimuovi da Watchlist"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
