'use client';

import React, { useState } from 'react';
import {
  Copy,
  Check,
  Send,
  AlertCircle,
  TrendingUp,
  ShieldAlert,
  Target,
  Clock,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';

interface RevolutPlanExecution {
  orderType: string;
  idealEntryPriceUSD: number;
  breakEvenPriceUSD: number;
  stopLossPriceUSD: number;
  takeProfit1USD: number;
  takeProfit2USD?: number;
  riskRewardRatio: string;
  recommendedInvestmentEUR: number;
  fractionalSharesToBuy: number;
  netProfitAtTP1EUR: number;
  maxNetLossAtStopEUR: number;
  timingWarning?: string;
}

interface RevolutCopyCardProps {
  ticker: string;
  verdict: string;
  convictionScore: number;
  worthUsingSlot?: boolean;
  thesisSummary: string;
  plan: RevolutPlanExecution;
  onViewDeepDetails?: () => void;
  analysisId?: string;
}

export function RevolutCopyCard({
  ticker,
  verdict,
  convictionScore,
  worthUsingSlot,
  thesisSummary,
  plan,
  onViewDeepDetails,
  analysisId,
}: RevolutCopyCardProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<string | null>(null);

  const copyToClipboard = async (text: string | number, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(String(text));
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.warn('Clipboard write failed:', err);
    }
  };

  const handleSendTelegram = async () => {
    setIsSendingTelegram(true);
    setTelegramStatus(null);

    try {
      const res = await fetch('/api/analysis/send-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId,
          analysis: {
            ticker,
            verdict,
            convictionScore,
            thesisSummary,
            revolutExecutionPlan: plan,
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        setTelegramStatus('Inviato con successo!');
      } else {
        setTelegramStatus(`Errore: ${data.error || 'Impossibile inviare'}`);
      }
    } catch (err: any) {
      setTelegramStatus(`Errore: ${err.message}`);
    } finally {
      setIsSendingTelegram(false);
      setTimeout(() => setTelegramStatus(null), 3500);
    }
  };

  const isBuy = verdict.includes('COMPRA');
  const isSell = verdict.includes('VENDI') || verdict.includes('PROFITTO');

  return (
    <div className="bg-[#0e1422] border border-[#223049] hover:border-amber-500/40 rounded-xl p-4 sm:p-5 transition-all shadow-lg flex flex-col justify-between relative overflow-hidden group">
      
      {/* Top Banner Accent */}
      <div
        className={`absolute top-0 left-0 right-0 h-1 ${
          isBuy ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : isSell ? 'bg-gradient-to-r from-rose-500 to-amber-500' : 'bg-slate-700'
        }`}
      />

      <div>
        {/* Header: Ticker, Conviction & Verdict */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-tight text-white font-mono">{ticker}</span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded font-bold uppercase tracking-wider font-mono ${
                  isBuy
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : isSell
                    ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                }`}
              >
                {verdict}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex flex-wrap items-center gap-2">
              <span>Tipo Ordine: <b className="text-slate-200">{plan.orderType || 'Ordine Limite'}</b> <span className="text-[10px] text-slate-500">(compra solo a questo prezzo o meno)</span></span>
              {worthUsingSlot !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${worthUsingSlot ? 'bg-amber-500/15 text-amber-300' : 'bg-slate-800 text-slate-400'}`}>
                  {worthUsingSlot ? '⭐️ Consigliato usare trade gratuito' : '⚠️ Trade piccolo: valuta commissione'}
                </span>
              )}
            </div>
          </div>

          {/* Conviction / Affidabilità Score Pill */}
          <div className="text-right">
            <div className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Affidabilità Consiglio</div>
            <div
              className={`num-mono font-black text-lg ${
                convictionScore >= 80
                  ? 'text-emerald-400'
                  : convictionScore >= 65
                  ? 'text-amber-400'
                  : 'text-slate-400'
              }`}
            >
              {convictionScore}<span className="text-xs text-slate-500">/100</span>
            </div>
          </div>
        </div>

        {/* Thesis Flash */}
        <p className="text-xs text-slate-300 leading-relaxed line-clamp-2 mb-4 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/80">
          {thesisSummary}
        </p>

        {/* 3 Click-to-Copy Quick Action Buttons for Revolut */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
          
          {/* 1. Copia Prezzo Ingresso */}
          <button
            onClick={() => copyToClipboard(plan.idealEntryPriceUSD, 'price')}
            className="flex items-center justify-between p-2.5 rounded-lg bg-[#141d30] hover:bg-[#1a263f] border border-[#253552] text-left transition-colors group/btn"
            title="Prezzo a cui impostare l'acquisto su Revolut"
          >
            <div>
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-mono">Prezzo a cui Comprare</div>
              <div className="num-mono font-bold text-sm text-cyan-300">
                ${plan.idealEntryPriceUSD}
              </div>
              <div className="text-[9px] text-slate-500 font-mono mt-0.5">Tocca per copiare</div>
            </div>
            <div className="p-1 rounded bg-slate-800/80 text-slate-400 group-hover/btn:text-cyan-300">
              {copiedField === 'price' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </div>
          </button>

          {/* 2. Copia Azioni Frazionate */}
          <button
            onClick={() => copyToClipboard(plan.fractionalSharesToBuy, 'shares')}
            className="flex items-center justify-between p-2.5 rounded-lg bg-[#141d30] hover:bg-[#1a263f] border border-[#253552] text-left transition-colors group/btn"
            title="Numero esatto di quote da inserire su Revolut"
          >
            <div>
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-mono">Azioni da Comprare</div>
              <div className="num-mono font-bold text-sm text-amber-300">
                {plan.fractionalSharesToBuy}
              </div>
              <div className="text-[9px] text-slate-500 font-mono mt-0.5">Quote da digitare</div>
            </div>
            <div className="p-1 rounded bg-slate-800/80 text-slate-400 group-hover/btn:text-amber-300">
              {copiedField === 'shares' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </div>
          </button>

          {/* 3. Copia Euro da Investire */}
          <button
            onClick={() => copyToClipboard(plan.recommendedInvestmentEUR, 'eur')}
            className="flex items-center justify-between p-2.5 rounded-lg bg-[#141d30] hover:bg-[#1a263f] border border-[#253552] text-left transition-colors group/btn"
            title="Importo totale in Euro calcolato per non rischiare troppo"
          >
            <div>
              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-mono">Soldi da Investire</div>
              <div className="num-mono font-bold text-sm text-emerald-300">
                €{plan.recommendedInvestmentEUR}
              </div>
              <div className="text-[9px] text-slate-500 font-mono mt-0.5">Totale calcolato</div>
            </div>
            <div className="p-1 rounded bg-slate-800/80 text-slate-400 group-hover/btn:text-emerald-300">
              {copiedField === 'eur' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </div>
          </button>

        </div>

        {/* Key Operational Targets Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs py-2 px-3 rounded-lg bg-[#0a0f1a] border border-[#1b2538] mb-3">
          <div>
            <span className="text-[10px] text-slate-400 block font-mono">Prezzo Pareggio (BE):</span>
            <span className="num-mono font-semibold text-slate-200">${plan.breakEvenPriceUSD}</span>
            <span className="text-[9px] text-slate-500 block">Per coprire commissioni</span>
          </div>
          <div>
            <span className="text-[10px] text-rose-400 block font-mono">Stop Loss (Sicurezza):</span>
            <span className="num-mono font-semibold text-rose-300">${plan.stopLossPriceUSD}</span>
            <span className="text-[9px] text-rose-400/80 block">Vendi qui per bloccare perdite</span>
          </div>
          <div>
            <span className="text-[10px] text-emerald-400 block font-mono">Obiettivo Guadagno (TP1):</span>
            <span className="num-mono font-semibold text-emerald-300">${plan.takeProfit1USD}</span>
            <span className="text-[9px] text-emerald-400/80 block">Vendi qui per incassare</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-mono">Guadagno / Rischio:</span>
            <span className="num-mono font-bold text-amber-400">{plan.riskRewardRatio}</span>
            <span className="text-[9px] text-slate-500 block">Proporzione resa/rischio</span>
          </div>
        </div>

        {/* Risk / Reward P&L Preview */}
        <div className="flex items-center justify-between text-[11px] font-mono px-1 text-slate-400 mb-3">
          <span className="flex items-center gap-1 text-rose-400">
            <ShieldAlert className="w-3 h-3" /> Max Perdita: -€{plan.maxNetLossAtStopEUR}
          </span>
          <span className="flex items-center gap-1 text-emerald-400 font-semibold">
            <TrendingUp className="w-3 h-3" /> Guadagno TP1: +€{plan.netProfitAtTP1EUR}
          </span>
        </div>

        {/* Timing Warning */}
        {plan.timingWarning && (
          <div className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-lg mb-4 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span className="leading-snug">{plan.timingWarning}</span>
          </div>
        )}

      </div>

      {/* Action Footer: Send to Telegram + View Deep Details */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#1f293d]">
        <button
          onClick={handleSendTelegram}
          disabled={isSendingTelegram}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 transition-colors disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" />
          <span>{isSendingTelegram ? 'Invio in corso...' : 'Invia a Telegram'}</span>
        </button>

        {onViewDeepDetails && (
          <button
            onClick={onViewDeepDetails}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors border border-slate-700"
          >
            <span>Analisi Dettagliata</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Telegram feedback toast */}
      {telegramStatus && (
        <div className="absolute bottom-14 left-4 right-4 bg-slate-900 border border-sky-500/40 text-sky-300 text-xs py-1.5 px-3 rounded-lg text-center shadow-lg font-mono animate-fade-in">
          {telegramStatus}
        </div>
      )}

    </div>
  );
}
