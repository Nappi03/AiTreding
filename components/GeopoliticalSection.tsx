'use client';

import React, { useState } from 'react';
import {
  Globe2,
  RefreshCw,
  AlertTriangle,
  ShieldAlert,
  Flame,
  CheckCircle2,
  ExternalLink,
  Cpu,
} from 'lucide-react';

interface GeopoliticalBriefData {
  hasBrief: boolean;
  date?: string;
  title?: string;
  summary?: string;
  keyRisks?: string[];
  marketSentiment?: string;
  sources?: string[];
  createdAt?: string;
}

interface GeopoliticalSectionProps {
  briefData: GeopoliticalBriefData | null;
  onRefresh: () => void;
  isGenerating: boolean;
}

export function GeopoliticalSection({
  briefData,
  onRefresh,
  isGenerating,
}: GeopoliticalSectionProps) {
  const [forceRefreshing, setForceRefreshing] = useState(false);

  const handleForceGenerate = async () => {
    setForceRefreshing(true);
    try {
      await fetch('/api/geopolitical-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceRefresh: true }),
      });
      onRefresh();
    } catch (err) {
      console.warn('Failed to regenerate brief:', err);
    } finally {
      setForceRefreshing(false);
    }
  };

  const sentiment = briefData?.marketSentiment || 'NEUTRAL';

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-[#0d131f] border border-[#1f293d] rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Globe2 className="w-5 h-5 text-emerald-400" />
            <h1 className="text-base sm:text-lg font-black text-white uppercase font-mono tracking-wider">
              Cosa Succede nel Mondo Oggi (Notizie & Economia)
            </h1>
            <span
              className={`text-[10px] font-mono px-2.5 py-0.5 rounded font-bold uppercase ${
                sentiment === 'BULLISH'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : sentiment === 'BEARISH' || sentiment === 'HIGH_VOLATILITY'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}
            >
              Umore Mercato: {sentiment === 'BULLISH' ? 'Ottimista (Salita)' : sentiment === 'BEARISH' ? 'Pessimista (Discesa)' : sentiment === 'HIGH_VOLATILITY' ? 'Molto Nervoso' : 'Cauto / Neutrale'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Sintesi chiara delle notizie mondiali, tassi e petrolio spiegati in parole semplici dall'Intelligenza Artificiale, per farti capire cosa succede e come orientare i tuoi investimenti su Revolut.
          </p>
        </div>

        <button
          onClick={handleForceGenerate}
          disabled={isGenerating || forceRefreshing}
          className="self-start sm:self-auto px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs font-mono uppercase flex items-center gap-2 transition-colors disabled:opacity-50 shadow-lg shadow-emerald-600/20"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isGenerating || forceRefreshing ? 'animate-spin' : ''}`} />
          <span>{isGenerating || forceRefreshing ? 'Generazione...' : 'Rigenera Report Oggi'}</span>
        </button>
      </div>

      {!briefData?.hasBrief ? (
        <div className="bg-[#0b101c] border border-dashed border-[#1f293d] rounded-2xl p-12 text-center space-y-3">
          <Globe2 className="w-10 h-10 text-emerald-400 mx-auto opacity-50" />
          <h3 className="text-sm font-bold text-white font-mono uppercase">
            Nessun Master Report Geopolitico generato per oggi
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Clicca sul pulsante sottostante per avviare la sintesi macroeconomica globale con Google Search e Gemini 2.5 Pro.
          </p>
          <button
            onClick={handleForceGenerate}
            disabled={isGenerating || forceRefreshing}
            className="px-4 py-2 rounded-lg bg-emerald-500 text-black font-bold text-xs font-mono uppercase shadow-lg shadow-emerald-500/20"
          >
            Genera Report Ora
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* Key Risks Checklist */}
          {briefData.keyRisks && briefData.keyRisks.length > 0 && (
            <div className="bg-[#0e1422] border border-[#1f2d47] rounded-xl p-4 sm:p-5">
              <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-amber-400 mb-3">
                <Flame className="w-4 h-4" />
                <span>Fattori di Rischio e Focolai Sistemici Chiave</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {briefData.keyRisks.map((risk, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-200 flex items-start gap-2.5"
                  >
                    <span className="w-5 h-5 rounded bg-amber-500/10 text-amber-400 font-mono font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed">{risk}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Master Summary Report */}
          <div className="bg-[#0e1422] border border-[#1f2d47] rounded-xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white font-mono">
                {briefData.title || 'Quadro Geopolitico Globale'}
              </h2>
              <span className="text-[11px] font-mono text-slate-400">
                Data: {briefData.date}
              </span>
            </div>

            <div className="text-sm text-slate-200 leading-relaxed space-y-3 whitespace-pre-line">
              {briefData.summary}
            </div>

            {/* Citations / Sources */}
            {briefData.sources && briefData.sources.length > 0 && (
              <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-400">
                <span className="text-slate-500">Fonti e Grounding:</span>
                {briefData.sources.map((src, i) => (
                  <span key={i} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                    {src}
                  </span>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
