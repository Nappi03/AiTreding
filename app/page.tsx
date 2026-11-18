'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Zap,
  Briefcase,
  ListFilter,
  Globe2,
  SlidersHorizontal,
  RefreshCw,
  Bell,
} from 'lucide-react';
import { TopBar } from '@/components/TopBar';
import { RadarSection } from '@/components/RadarSection';
import { PortfolioSection } from '@/components/PortfolioSection';
import { WatchlistSection } from '@/components/WatchlistSection';
import { GeopoliticalSection } from '@/components/GeopoliticalSection';
import { SettingsSection } from '@/components/SettingsSection';
import { DeepAnalysisModal } from '@/components/DeepAnalysisModal';
import { DeepAnalysisOutput } from '@/lib/ai-engine';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'radar' | 'portfolio' | 'watchlist' | 'geopolitics' | 'settings'>('radar');
  
  // App data state
  const [marketStatus, setMarketStatus] = useState<any>(null);
  const [portfolioData, setPortfolioData] = useState<{ positions: any[]; summary: any }>({
    positions: [],
    summary: null,
  });
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [topAnalyses, setTopAnalyses] = useState<any[]>([]);
  const [geopoliticalBrief, setGeopoliticalBrief] = useState<any>(null);
  const [portfolioAlerts, setPortfolioAlerts] = useState<any[]>([]);

  // Action states
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isTriaging, setIsTriaging] = useState(false);
  const [isGeneratingGeo, setIsGeneratingGeo] = useState(false);

  // Deep Analysis Modal State
  const [deepModal, setDeepModal] = useState<{
    isOpen: boolean;
    ticker: string;
    analysis: DeepAnalysisOutput | null;
    isLoading: boolean;
  }>({
    isOpen: false,
    ticker: '',
    analysis: null,
    isLoading: false,
  });

  // Fetch functions
  const fetchMarketStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/market-status');
      if (res.ok) {
        const data = await res.json();
        setMarketStatus(data);
      }
    } catch (e) {
      console.warn('Market status fetch failed:', e);
    }
  }, []);

  const fetchPortfolio = useCallback(async () => {
    try {
      const res = await fetch('/api/portfolio');
      if (res.ok) {
        const data = await res.json();
        setPortfolioData({
          positions: data.positions || [],
          summary: data.summary || null,
        });

        // Compute instant alerts
        const alerts: any[] = [];
        for (const p of data.positions || []) {
          if (p.isStopLossTriggered) {
            alerts.push({
              ticker: p.ticker,
              verdict: 'STOP LOSS COLPITO',
              message: `Prezzo ($${p.currentPriceUSD}) sotto lo Stop Loss ($${p.stopLossPriceUSD})`,
            });
          }
        }
        setPortfolioAlerts(alerts);
      }
    } catch (e) {
      console.warn('Portfolio fetch failed:', e);
    }
  }, []);

  const fetchWatchlist = useCallback(async () => {
    try {
      const res = await fetch('/api/watchlist');
      if (res.ok) {
        const data = await res.json();
        setWatchlist(data);
      }
    } catch (e) {
      console.warn('Watchlist fetch failed:', e);
    }
  }, []);

  const fetchAnalyses = useCallback(async () => {
    try {
      const res = await fetch('/api/analysis');
      if (res.ok) {
        const data = await res.json();
        setTopAnalyses(data || []);
      }
    } catch (e) {
      console.warn('Analyses fetch failed:', e);
    }
  }, []);

  const fetchGeopoliticalBrief = useCallback(async () => {
    try {
      const res = await fetch('/api/geopolitical-brief');
      if (res.ok) {
        const data = await res.json();
        setGeopoliticalBrief(data);
      }
    } catch (e) {
      console.warn('Geo brief fetch failed:', e);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([
      fetchMarketStatus(),
      fetchPortfolio(),
      fetchWatchlist(),
      fetchAnalyses(),
      fetchGeopoliticalBrief(),
    ]);
    setIsRefreshing(false);
  }, [fetchMarketStatus, fetchPortfolio, fetchWatchlist, fetchAnalyses, fetchGeopoliticalBrief]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Triggers
  const handleTriggerFullScan = async () => {
    setIsScanning(true);
    try {
      const res = await fetch('/api/scan/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'SCANSIONE MANUALE UI' }),
      });
      await refreshAll();
    } catch (err) {
      console.warn('Full scan trigger failed:', err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleTriggerTriage = async () => {
    setIsTriaging(true);
    try {
      await fetch('/api/triage', { method: 'POST' });
      await fetchWatchlist();
      setActiveTab('watchlist');
    } catch (err) {
      console.warn('Triage trigger failed:', err);
    } finally {
      setIsTriaging(false);
    }
  };

  const handleTriggerGeopolitical = async () => {
    setActiveTab('geopolitics');
  };

  const handleDecrementTrade = async () => {
    try {
      const res = await fetch('/api/settings/decrement-trade', { method: 'POST' });
      const data = await res.json();
      if (data.success && marketStatus) {
        setMarketStatus({
          ...marketStatus,
          settings: {
            ...marketStatus.settings,
            freeTradesRemaining: data.freeTradesRemaining,
          },
        });
      }
    } catch (err) {
      console.warn('Decrement trade failed:', err);
    }
  };

  // Launch Deep Analysis Modal
  const handleSelectTickerForDeepAnalysis = async (ticker: string) => {
    setDeepModal({
      isOpen: true,
      ticker,
      analysis: null,
      isLoading: true,
    });

    try {
      const res = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker }),
      });

      const data = await res.json();
      if (data.success && data.analysis) {
        setDeepModal({
          isOpen: true,
          ticker,
          analysis: data.analysis,
          isLoading: false,
        });
        fetchAnalyses();
      } else {
        throw new Error(data.error || 'Impossibile completare analisi');
      }
    } catch (err: any) {
      alert(`Errore nell'analisi di ${ticker}: ${err.message}`);
      setDeepModal((prev) => ({ ...prev, isOpen: false, isLoading: false }));
    }
  };

  return (
    <div className="min-h-screen bg-[#070a0f] text-[#f8fafc] flex flex-col pb-20 md:pb-6">
      
      {/* Top Bar with Live Revolut Metrics & Market Status */}
      <TopBar
        marketStatus={marketStatus}
        portfolioSummary={portfolioData.summary}
        onRefreshAll={refreshAll}
        onOpenSettings={() => setActiveTab('settings')}
        onTriggerGeopoliticalBrief={handleTriggerGeopolitical}
        onDecrementTrade={handleDecrementTrade}
        isRefreshing={isRefreshing}
      />

      {/* Main Container */}
      <main className="max-w-7xl w-full mx-auto px-3 sm:px-6 pt-4 flex-1">
        
        {/* Desktop Tab Switcher */}
        <div className="hidden md:flex items-center gap-1 bg-[#0d131f] p-1.5 rounded-xl border border-[#1f293d] mb-6">
          {[
            { id: 'radar', label: '🔥 Radar & Opportunità', icon: Zap },
            { id: 'portfolio', label: '💼 Portafoglio Revolut', icon: Briefcase },
            { id: 'watchlist', label: '📋 Titoli Osservati & Analisi', icon: ListFilter },
            { id: 'geopolitics', label: '🌍 Notizie Mondo & Economia', icon: Globe2 },
            { id: 'settings', label: '⚙️ Impostazioni', icon: SlidersHorizontal },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-mono font-bold transition-all ${
                  isActive
                    ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Views */}
        {activeTab === 'radar' && (
          <RadarSection
            topAnalyses={topAnalyses}
            portfolioAlerts={portfolioAlerts}
            onTriggerTriage={handleTriggerTriage}
            onTriggerFullScan={handleTriggerFullScan}
            onSelectTickerForDeepAnalysis={handleSelectTickerForDeepAnalysis}
            isScanning={isScanning}
          />
        )}

        {activeTab === 'portfolio' && (
          <PortfolioSection
            positions={portfolioData.positions}
            summary={portfolioData.summary}
            onRefresh={fetchPortfolio}
            onSelectTickerForDeepAnalysis={handleSelectTickerForDeepAnalysis}
          />
        )}

        {activeTab === 'watchlist' && (
          <WatchlistSection
            watchlist={watchlist}
            onRefresh={fetchWatchlist}
            onTriggerTriage={handleTriggerTriage}
            onSelectTickerForDeepAnalysis={handleSelectTickerForDeepAnalysis}
            isTriaging={isTriaging}
          />
        )}

        {activeTab === 'geopolitics' && (
          <GeopoliticalSection
            briefData={geopoliticalBrief}
            onRefresh={fetchGeopoliticalBrief}
            isGenerating={isGeneratingGeo}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsSection onSettingsUpdated={refreshAll} />
        )}

      </main>

      {/* Mobile Bottom Navigation Bar (Tailored for iPhone / PWA usage) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#070a0f]/95 backdrop-blur border-t border-[#1f293d] md:hidden px-2 py-1.5 flex items-center justify-around text-[10px] font-mono">
        {[
          { id: 'radar', label: 'Radar', icon: Zap },
          { id: 'portfolio', label: 'Portafoglio', icon: Briefcase },
          { id: 'watchlist', label: 'Osservati', icon: ListFilter },
          { id: 'geopolitics', label: 'Mondo', icon: Globe2 },
          { id: 'settings', label: 'Opzioni', icon: SlidersHorizontal },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-colors ${
                isActive ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Deep Analysis Modal */}
      <DeepAnalysisModal
        isOpen={deepModal.isOpen}
        onClose={() => setDeepModal((prev) => ({ ...prev, isOpen: false }))}
        ticker={deepModal.ticker}
        analysis={deepModal.analysis}
        isLoading={deepModal.isLoading}
      />

    </div>
  );
}
