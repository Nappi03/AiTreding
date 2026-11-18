'use client';

import React from 'react';
import {
  Sparkles,
  Zap,
  AlertTriangle,
  Play,
  TrendingUp,
  Activity,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { RevolutCopyCard } from './RevolutCopyCard';

interface RadarSectionProps {
  topAnalyses: any[];
  portfolioAlerts: any[];
  onTriggerTriage: () => void;
  onTriggerFullScan: () => void;
  onSelectTickerForDeepAnalysis: (ticker: string) => void;
  isScanning: boolean;
}

export function RadarSection({
  topAnalyses,
  portfolioAlerts,
  onTriggerTriage,
  onTriggerFullScan,
  onSelectTickerForDeepAnalysis,
  isScanning,
}: RadarSectionProps) {
  return (
    <div className="space-y-6">
      
      {/* Action Header with Triggers */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#0d131f] border border-[#1f293d] p-4 rounded-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-black text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Azioni Prioritarie Oggi
            </h1>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Live Radar
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Migliori occasioni d'acquisto calcolate in modo sicuro e allarmi sui tuoi investimenti Revolut
          </p>
        </div>

        {/* Scan Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onTriggerTriage}
            disabled={isScanning}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors disabled:opacity-50"
            title="Avvia controllo rapido con l'AI su tutti i titoli osservati"
          >
            <Activity className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>Controllo Rapido</span>
          </button>

          <button
            onClick={onTriggerFullScan}
            disabled={isScanning}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black transition-colors disabled:opacity-50 shadow-md shadow-amber-500/20"
            title="Esegui subito il controllo completo (Notizie del Mondo + Controllo Rapido + Analisi Approfondita)"
          >
            <Play className={`w-3.5 h-3.5 fill-black ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Controllo in corso...' : 'Scansione Completa'}</span>
          </button>
        </div>
      </div>

      {/* Urgent Alerts Banner (if any) */}
      {portfolioAlerts && portfolioAlerts.length > 0 && (
        <div className="bg-rose-950/30 border border-rose-500/40 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-rose-400 font-mono text-xs font-bold uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4" />
            <span>Allarmi Urgenti sul tuo Portafoglio ({portfolioAlerts.length})</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {portfolioAlerts.map((alert, idx) => (
              <div
                key={idx}
                className="bg-slate-900/90 border border-rose-500/30 p-3 rounded-lg flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-mono font-bold text-white text-sm flex items-center gap-2">
                    <span>{alert.ticker}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">
                      {alert.verdict || 'ATTENZIONE'}
                    </span>
                  </div>
                  <p className="text-slate-300 text-[11px] mt-0.5">{alert.message || alert.reason}</p>
                </div>
                <button
                  onClick={() => onSelectTickerForDeepAnalysis(alert.ticker)}
                  className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-mono text-[11px] shrink-0"
                >
                  Analisi
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Priority Revolut Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs uppercase font-mono tracking-wider text-slate-400 font-semibold">
            Schede Operative "Copia su Revolut" ({topAnalyses.length})
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            Tocca i valori numerici per copiarli al volo nell'app Revolut
          </span>
        </div>

        {topAnalyses.length === 0 ? (
          <div className="bg-[#0b101c] border border-dashed border-[#1f293d] rounded-2xl p-8 sm:p-12 text-center space-y-3">
            <Sparkles className="w-8 h-8 text-amber-400 mx-auto opacity-60" />
            <h3 className="text-sm font-bold text-white font-mono uppercase">
              Nessuna scheda operativa attiva in questo momento
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Avvia un <b>Controllo Completo</b> o clicca su qualsiasi titolo nella sezione <b>Titoli Osservati</b> per generare la scheda con i numeri esatti da copiare su Revolut.
            </p>
            <div className="pt-2">
              <button
                onClick={onTriggerFullScan}
                disabled={isScanning}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase font-mono shadow-lg shadow-amber-500/20"
              >
                {isScanning ? 'Controllo in corso...' : 'Avvia Scansione Ora'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {topAnalyses.map((item) => (
              <RevolutCopyCard
                key={item.id || item.ticker}
                ticker={item.ticker}
                verdict={item.verdict}
                convictionScore={item.convictionScore}
                worthUsingSlot={item.worthUsingRevolutSlot}
                thesisSummary={item.thesisSummary}
                plan={item.revolutExecutionPlan}
                analysisId={item.id}
                onViewDeepDetails={() => onSelectTickerForDeepAnalysis(item.ticker)}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
