'use client';

import React, { useState } from 'react';
import {
  X,
  Sparkles,
  TrendingUp,
  Globe2,
  Cpu,
  BarChart2,
  Copy,
  Check,
  Send,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { DeepAnalysisOutput } from '@/lib/ai-engine';
import { TradingViewChart } from './TradingViewChart';
import { RevolutCopyCard } from './RevolutCopyCard';

interface DeepAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: DeepAnalysisOutput | null;
  isLoading: boolean;
  ticker: string;
}

export function DeepAnalysisModal({
  isOpen,
  onClose,
  analysis,
  isLoading,
  ticker,
}: DeepAnalysisModalProps) {
  const [activeTab, setActiveTab] = useState<'plan' | 'thesis' | 'geopolitics' | 'catalysts' | 'technical'>('plan');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#0b101c] border border-[#1f2d47] rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#1f293d] flex items-center justify-between bg-[#080c16]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center font-bold text-black text-sm shadow-lg shadow-amber-500/20">
              <Sparkles className="w-5 h-5 text-black" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white font-mono tracking-tight">{ticker}</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                  Gemini 2.5 Pro (Thinking 32k)
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Spiegazione chiara dell'opportunità & Numeri esatti da copiare su Revolut
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          
          {isLoading && (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin" />
                <Sparkles className="w-6 h-6 text-amber-400 absolute inset-0 m-auto animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                  Analisi approfondita con l'AI in corso...
                </h3>
                <p className="text-xs text-slate-400 max-w-sm">
                  L'Intelligenza Artificiale sta leggendo le ultime notizie in tempo reale, verificando grafici e calcolando Stop Loss e quote sicure per il tuo conto Revolut.
                </p>
              </div>
            </div>
          )}

          {!isLoading && !analysis && (
            <div className="py-12 text-center text-slate-400 text-sm">
              Nessuna analisi disponibile per {ticker}.
            </div>
          )}

          {!isLoading && analysis && (
            <>
              {/* Navigation Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800 text-xs font-mono">
                {[
                  { id: 'plan', label: 'Cosa Fare su Revolut', icon: TrendingUp },
                  { id: 'thesis', label: 'Spiegazione Semplice', icon: ShieldCheck },
                  { id: 'geopolitics', label: 'Notizie Mondo & Impatto', icon: Globe2 },
                  { id: 'catalysts', label: 'Novità Azienda', icon: Cpu },
                  { id: 'technical', label: 'Grafici & Prezzi', icon: BarChart2 },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                        isActive
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'text-slate-400 hover:text-white hover:bg-slate-900'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tab 1: Operational Plan & Interactive Chart */}
              {activeTab === 'plan' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {/* Left: Interactive TradingView Chart */}
                    <div className="lg:col-span-7">
                      <TradingViewChart
                        ticker={ticker}
                        entryPrice={analysis.revolutExecutionPlan?.idealEntryPriceUSD}
                        breakEvenPrice={analysis.revolutExecutionPlan?.breakEvenPriceUSD}
                        stopLossPrice={analysis.revolutExecutionPlan?.stopLossPriceUSD}
                        takeProfit1Price={analysis.revolutExecutionPlan?.takeProfit1USD}
                        takeProfit2Price={analysis.revolutExecutionPlan?.takeProfit2USD}
                      />
                    </div>

                    {/* Right: Revolut Copy Card */}
                    <div className="lg:col-span-5">
                      <RevolutCopyCard
                        ticker={ticker}
                        verdict={analysis.verdict}
                        convictionScore={analysis.convictionScore}
                        worthUsingSlot={analysis.worthUsingRevolutSlot}
                        thesisSummary={analysis.thesisSummary}
                        plan={analysis.revolutExecutionPlan}
                        analysisId={analysis.id}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Thesis & Verdict */}
              {activeTab === 'thesis' && (
                <div className="bg-[#0e1422] border border-[#1f2d47] rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider font-mono text-slate-400">Spiegazione della Scelta</span>
                    <span className="text-sm font-bold text-amber-400 font-mono">Affidabilità Consiglio: {analysis.convictionScore}/100</span>
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                    {analysis.thesisSummary}
                  </p>
                </div>
              )}

              {/* Tab 3: Geopolitics & Macro */}
              {activeTab === 'geopolitics' && (
                <div className="bg-[#0e1422] border border-[#1f2d47] rounded-xl p-5 space-y-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-mono text-cyan-400">
                    <Globe2 className="w-4 h-4" />
                    <span>Impatto Geopolitico e Macroeconomico su {ticker}</span>
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                    {analysis.geopoliticalAndMacroAnalysis}
                  </p>
                </div>
              )}

              {/* Tab 4: Company Catalysts */}
              {activeTab === 'catalysts' && (
                <div className="bg-[#0e1422] border border-[#1f2d47] rounded-xl p-5 space-y-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-mono text-amber-400">
                    <Cpu className="w-4 h-4" />
                    <span>Catalizzatori Specifici Aziendali & Ultime Notizie</span>
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                    {analysis.companyCatalysts}
                  </p>
                </div>
              )}

              {/* Tab 5: Technical Confluence */}
              {activeTab === 'technical' && (
                <div className="space-y-4">
                  <div className="bg-[#0e1422] border border-[#1f2d47] rounded-xl p-5 space-y-3">
                    <span className="text-xs uppercase tracking-wider font-mono text-emerald-400 block">
                      Analisi Confluenza Matematica
                    </span>
                    <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                      {analysis.technicalConfluence}
                    </p>
                  </div>

                  {/* Indicators Grid */}
                  {analysis.rawIndicators && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                      <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">RSI (14)</span>
                        <span className="text-base font-bold text-white">{analysis.rawIndicators.rsi14 ?? 'N/A'}</span>
                      </div>
                      <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">Trend Primario</span>
                        <span className="text-base font-bold text-emerald-400">{analysis.rawIndicators.trend}</span>
                      </div>
                      <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">SMA 20 / SMA 50</span>
                        <span className="text-sm font-bold text-white">${analysis.rawIndicators.sma20} / ${analysis.rawIndicators.sma50}</span>
                      </div>
                      <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                        <span className="text-slate-400 block text-[10px]">ATR (14) Volatilità</span>
                        <span className="text-base font-bold text-amber-400">${analysis.rawIndicators.atr14}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </>
          )}

        </div>

      </div>
    </div>
  );
}
