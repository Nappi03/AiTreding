'use client';

import React, { useState } from 'react';
import {
  Briefcase,
  Plus,
  Trash2,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  DollarSign,
  ShieldAlert,
  Edit2,
  Check,
  X,
} from 'lucide-react';

interface Position {
  id: string;
  ticker: string;
  name: string;
  sharesOwned: number;
  averageCostUSD: number;
  currentPriceUSD?: number | null;
  dayChangePercent?: number;
  currentValueUSD?: number;
  currentValueEUR?: number;
  pnlUSD?: number;
  pnlEUR?: number;
  pnlPercent?: number;
  stopLossPriceUSD?: number | null;
  takeProfitPriceUSD?: number | null;
  stopLossDistancePercent?: number | null;
  takeProfitDistancePercent?: number | null;
  isStopLossTriggered?: boolean;
  isTakeProfitTriggered?: boolean;
  notes?: string | null;
}

interface PortfolioSectionProps {
  positions: Position[];
  summary: {
    totalValueUSD: number;
    totalValueEUR: number;
    totalPnlUSD: number;
    totalPnlEUR: number;
    totalPnlPercent: number;
    eurUsdRate: number;
  } | null;
  onRefresh: () => void;
  onSelectTickerForDeepAnalysis: (ticker: string) => void;
}

export function PortfolioSection({
  positions,
  summary,
  onRefresh,
  onSelectTickerForDeepAnalysis,
}: PortfolioSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    ticker: '',
    sharesOwned: '',
    averageCostUSD: '',
    stopLossPriceUSD: '',
    takeProfitPriceUSD: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenAddModal = (pos?: Position) => {
    if (pos) {
      setFormData({
        ticker: pos.ticker,
        sharesOwned: String(pos.sharesOwned),
        averageCostUSD: String(pos.averageCostUSD),
        stopLossPriceUSD: pos.stopLossPriceUSD ? String(pos.stopLossPriceUSD) : '',
        takeProfitPriceUSD: pos.takeProfitPriceUSD ? String(pos.takeProfitPriceUSD) : '',
        notes: pos.notes || '',
      });
    } else {
      setFormData({
        ticker: '',
        sharesOwned: '',
        averageCostUSD: '',
        stopLossPriceUSD: '',
        takeProfitPriceUSD: '',
        notes: '',
      });
    }
    setError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Errore salvataggio posizione');
      }

      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (ticker: string) => {
    if (!confirm(`Sei sicuro di voler rimuovere ${ticker} dal portafoglio?`)) return;

    try {
      await fetch(`/api/portfolio?ticker=${ticker}`, { method: 'DELETE' });
      onRefresh();
    } catch (err) {
      console.warn('Delete failed:', err);
    }
  };

  const totalEUR = summary?.totalValueEUR ?? 0;
  const pnlEUR = summary?.totalPnlEUR ?? 0;
  const pnlPct = summary?.totalPnlPercent ?? 0;

  return (
    <div className="space-y-6">
      
      {/* Portfolio Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        
        <div className="bg-[#0d131f] border border-[#1f293d] rounded-xl p-4">
          <div className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Valore Portafoglio</div>
          <div className="num-mono font-bold text-lg sm:text-xl text-white mt-1">
            €{totalEUR.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-0.5">
            ${(summary?.totalValueUSD ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
          </div>
        </div>

        <div className="bg-[#0d131f] border border-[#1f293d] rounded-xl p-4">
          <div className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">P&L Totale Netto</div>
          <div
            className={`num-mono font-bold text-lg sm:text-xl mt-1 ${
              pnlEUR >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {pnlEUR >= 0 ? '+' : ''}€{pnlEUR.toFixed(2)}
          </div>
          <div
            className={`text-[11px] font-mono mt-0.5 ${
              pnlPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}% totale
          </div>
        </div>

        <div className="bg-[#0d131f] border border-[#1f293d] rounded-xl p-4">
          <div className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Posizioni Aperte</div>
          <div className="num-mono font-bold text-lg sm:text-xl text-white mt-1">
            {positions.length}
          </div>
          <div className="text-[11px] font-mono text-amber-400 mt-0.5">
            Azioni USA su Revolut
          </div>
        </div>

        <div className="bg-[#0d131f] border border-[#1f293d] rounded-xl p-4 flex flex-col justify-between">
          <div className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Azione Rapida</div>
          <button
            onClick={() => handleOpenAddModal()}
            className="w-full mt-2 py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs font-mono uppercase flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-amber-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuova Posizione</span>
          </button>
        </div>

      </div>

      {/* Positions Table / Mobile Cards */}
      <div className="bg-[#0b101c] border border-[#1f293d] rounded-xl overflow-hidden">
        
        <div className="p-4 border-b border-[#1f293d] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
              Posizioni in Portafoglio Revolut ({positions.length})
            </h2>
          </div>
          <button
            onClick={() => handleOpenAddModal()}
            className="hidden sm:inline-flex items-center gap-1 text-xs font-mono text-amber-400 hover:text-amber-300"
          >
            <Plus className="w-3.5 h-3.5" /> Aggiungi Titolo
          </button>
        </div>

        {positions.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs font-mono">
            Nessuna posizione registrata. Inserisci i titoli che possiedi già su Revolut per monitorare Stop Loss e Take Profit in tempo reale.
          </div>
        ) : (
          <div className="divide-y divide-[#1f293d]">
            {positions.map((pos) => {
              const pnl = pos.pnlEUR ?? 0;
              const pnlPct = pos.pnlPercent ?? 0;
              const isProfit = pnl >= 0;

              return (
                <div
                  key={pos.id}
                  className={`p-4 transition-colors hover:bg-slate-900/50 flex flex-col md:flex-row md:items-center md:justify-between gap-3 ${
                    pos.isStopLossTriggered ? 'bg-rose-950/20 border-l-4 border-rose-500' : ''
                  }`}
                >
                  {/* Left: Ticker & Holding Info */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center font-mono font-black text-sm text-amber-400 shrink-0">
                      {pos.ticker.slice(0, 4)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white font-mono text-base">{pos.ticker}</span>
                        <span className="text-xs text-slate-400 truncate max-w-[150px] sm:max-w-xs">{pos.name}</span>
                        {pos.isStopLossTriggered && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            STOP LOSS COLPITO!
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-mono text-slate-400 mt-0.5 flex flex-wrap items-center gap-3">
                        <span>Azioni: <b className="text-slate-200">{pos.sharesOwned}</b></span>
                        <span>Prezzo Medio: <b className="text-slate-200">${pos.averageCostUSD}</b></span>
                        <span>Attuale: <b className="text-cyan-300">${pos.currentPriceUSD ?? '--'}</b></span>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Stop Loss & TP Status */}
                  <div className="flex items-center gap-5 text-xs font-mono">
                    <div className="bg-rose-950/20 border border-rose-500/20 px-2.5 py-1.5 rounded-lg">
                      <span className="text-xs text-rose-300 block font-bold">Stop Loss</span>
                      <span className="text-white font-bold text-sm block">
                        {pos.stopLossPriceUSD ? `$${pos.stopLossPriceUSD}` : 'Non imp.'}
                      </span>
                      <span className="text-[11px] text-rose-300/80 block">Prezzo sicurezza</span>
                      {pos.stopLossDistancePercent !== null && pos.stopLossDistancePercent !== undefined && (
                        <span className="text-[11px] text-slate-300 block font-semibold">
                          ({pos.stopLossDistancePercent > 0 ? '+' : ''}{pos.stopLossDistancePercent}%)
                        </span>
                      )}
                    </div>

                    <div className="bg-emerald-950/20 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg">
                      <span className="text-xs text-emerald-300 block font-bold">Take Profit</span>
                      <span className="text-white font-bold text-sm block">
                        {pos.takeProfitPriceUSD ? `$${pos.takeProfitPriceUSD}` : 'Non imp.'}
                      </span>
                      <span className="text-[11px] text-emerald-300/80 block">Obiettivo guadagno</span>
                      {pos.takeProfitDistancePercent !== null && pos.takeProfitDistancePercent !== undefined && (
                        <span className="text-[11px] text-slate-300 block font-semibold">
                          ({pos.takeProfitDistancePercent > 0 ? '+' : ''}{pos.takeProfitDistancePercent}%)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: P&L and Action Buttons */}
                  <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                    <div className="text-left md:text-right">
                      <div className="text-[10px] text-slate-400 font-mono">P&L Netto</div>
                      <div className={`num-mono font-bold text-sm ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isProfit ? '+' : ''}€{pnl.toFixed(2)} ({isProfit ? '+' : ''}{pnlPct.toFixed(2)}%)
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        Valore: €{pos.currentValueEUR?.toFixed(2) ?? '--'}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => onSelectTickerForDeepAnalysis(pos.ticker)}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-mono font-semibold flex items-center gap-1 transition-colors"
                        title="Esegui Deep Hedge-Fund Analysis con Gemini 2.5 Pro"
                      >
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span>Analizza</span>
                      </button>

                      <button
                        onClick={() => handleOpenAddModal(pos)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800"
                        title="Modifica"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDelete(pos.ticker)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-800"
                        title="Elimina"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Add / Edit Position Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0b101c] border border-[#1f2d47] rounded-xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white font-mono uppercase">
                {formData.ticker ? `Modifica ${formData.ticker}` : 'Aggiungi Titolo Revolut'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-mono">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-mono mb-1">Ticker Simbolo (es. NVDA, AAPL, TSLA)</label>
                <input
                  type="text"
                  required
                  value={formData.ticker}
                  onChange={(e) => setFormData({ ...formData, ticker: e.target.value.toUpperCase() })}
                  className="w-full bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-white font-mono uppercase focus:border-amber-500 outline-none"
                  placeholder="NVDA"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-mono mb-1">Quantità Azioni (anche frazioni)</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formData.sharesOwned}
                    onChange={(e) => setFormData({ ...formData, sharesOwned: e.target.value })}
                    className="w-full bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-amber-500 outline-none"
                    placeholder="12.5"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-mono mb-1">Prezzo Medio Carico ($USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.averageCostUSD}
                    onChange={(e) => setFormData({ ...formData, averageCostUSD: e.target.value })}
                    className="w-full bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-amber-500 outline-none"
                    placeholder="120.50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-rose-400 font-mono mb-1">Stop Loss ($USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.stopLossPriceUSD}
                    onChange={(e) => setFormData({ ...formData, stopLossPriceUSD: e.target.value })}
                    className="w-full bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-rose-500 outline-none"
                    placeholder="110.00"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Prezzo sicurezza: vendi qui se scende per bloccare le perdite</span>
                </div>
                <div>
                  <label className="block text-emerald-400 font-mono mb-1">Take Profit ($USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.takeProfitPriceUSD}
                    onChange={(e) => setFormData({ ...formData, takeProfitPriceUSD: e.target.value })}
                    className="w-full bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-emerald-500 outline-none"
                    placeholder="150.00"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Obiettivo: vendi qui per incassare il guadagno</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-mono mb-1">Note (strategia o tesi)</label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-amber-500 outline-none"
                  placeholder="Es. Ingresso su rimbalzo SMA50"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 font-mono"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold font-mono uppercase"
                >
                  {isSubmitting ? 'Salvataggio...' : 'Salva Posizione'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
