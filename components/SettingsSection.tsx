'use client';

import React, { useState, useEffect } from 'react';
import {
  SlidersHorizontal,
  Wallet,
  Send,
  Key,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Save,
} from 'lucide-react';

interface SettingsData {
  availableLiquidityEur: number;
  riskPercentage: number;
  revolutPlan: string;
  freeTradesRemaining: number;
  freeTradesResetDay: number;
  telegramBotToken?: string;
  telegramChatId?: string;
  geminiApiKey?: string;
  morningScanTime: string;
  afternoonScanTime: string;
  autoScanEnabled: boolean;
  hasGeminiApiKey?: boolean;
  hasTelegramBotToken?: boolean;
  hasTelegramChatId?: boolean;
}

interface SettingsSectionProps {
  onSettingsUpdated: () => void;
}

export function SettingsSection({ onSettingsUpdated }: SettingsSectionProps) {
  const [formData, setFormData] = useState<SettingsData>({
    availableLiquidityEur: 10000,
    riskPercentage: 1.5,
    revolutPlan: 'Premium',
    freeTradesRemaining: 5,
    freeTradesResetDay: 1,
    telegramBotToken: '',
    telegramChatId: '',
    geminiApiKey: '',
    morningScanTime: '08:30',
    afternoonScanTime: '15:00',
    autoScanEnabled: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Telegram test state
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [telegramTestStatus, setTelegramTestStatus] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        setFormData((prev) => ({
          ...prev,
          ...data,
          telegramBotToken: data.telegramBotToken || '',
          telegramChatId: data.telegramChatId || '',
          geminiApiKey: data.geminiApiKey || '',
        }));
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Errore salvataggio impostazioni');
      }

      setSaveSuccess(true);
      onSettingsUpdated();
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestTelegram = async () => {
    setTestingTelegram(true);
    setTelegramTestStatus(null);

    try {
      const res = await fetch('/api/telegram/test', {
        method: 'POST',
      });
      const data = await res.json();

      if (data.success) {
        setTelegramTestStatus('✅ Messaggio di test inviato con successo a Telegram!');
      } else {
        setTelegramTestStatus(`❌ Errore Telegram: ${data.error}`);
      }
    } catch (err: any) {
      setTelegramTestStatus(`❌ Errore invio test: ${err.message}`);
    } finally {
      setTestingTelegram(false);
      setTimeout(() => setTelegramTestStatus(null), 5000);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400 font-mono text-xs">Caricamento impostazioni...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="bg-[#0d131f] border border-[#1f293d] rounded-xl p-4 sm:p-5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-amber-400" />
            <h1 className="text-base sm:text-lg font-black text-white uppercase font-mono tracking-wider">
              Impostazioni Conto Revolut & Automazioni
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Configura il piano Revolut, la gestione del capitale, il Bot Telegram e gli orari dei cron job
          </p>
        </div>

        {saveSuccess && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono bg-emerald-950/40 border border-emerald-500/40 px-3 py-1.5 rounded-lg">
            <CheckCircle2 className="w-4 h-4" />
            <span>Salvate!</span>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-mono">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Section 1: Conto Revolut & Risk Management */}
        <div className="bg-[#0e1422] border border-[#1f2d47] rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-amber-400 border-b border-slate-800 pb-2">
            <Wallet className="w-4 h-4" />
            <span>Parametri Conto Revolut & Calcolo Quanto Investire</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs font-mono">
            <div>
              <label className="block text-slate-400 mb-1">Liquidità Disponibile (EUR)</label>
              <input
                type="number"
                step="50"
                value={formData.availableLiquidityEur}
                onChange={(e) => setFormData({ ...formData, availableLiquidityEur: parseFloat(e.target.value) || 0 })}
                className="w-full bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Capitale libero utilizzabile</span>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Rischio Max per Trade (%)</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="5.0"
                value={formData.riskPercentage}
                onChange={(e) => setFormData({ ...formData, riskPercentage: parseFloat(e.target.value) || 1.5 })}
                className="w-full bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Es. 1.5% = max €{((formData.availableLiquidityEur * formData.riskPercentage) / 100).toFixed(2)} persi a Stop Loss</span>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Piano Revolut Attivo</label>
              <select
                value={formData.revolutPlan}
                onChange={(e) => setFormData({ ...formData, revolutPlan: e.target.value })}
                className="w-full bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 outline-none"
              >
                <option value="Standard">Standard (1 trade gratis/mese)</option>
                <option value="Plus">Plus (3 trade gratis/mese)</option>
                <option value="Premium">Premium (5 trade gratis/mese)</option>
                <option value="Metal">Metal (10 trade gratis/mese)</option>
                <option value="Ultra">Ultra (10 trade gratis / 0.12% beyond)</option>
              </select>
              <span className="text-[10px] text-slate-500 mt-1 block">Determina le commissioni calcolate</span>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Trade Gratuiti Residui nel Mese</label>
              <input
                type="number"
                min="0"
                max="50"
                value={formData.freeTradesRemaining}
                onChange={(e) => setFormData({ ...formData, freeTradesRemaining: parseInt(e.target.value, 10) || 0 })}
                className="w-full bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Slot a zero commissioni rimasti</span>
            </div>
          </div>
        </div>

        {/* Section 2: Bot Telegram */}
        <div className="bg-[#0e1422] border border-[#1f2d47] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-sky-400">
              <Send className="w-4 h-4" />
              <span>Notifiche Telegram ("Revolut Action Alerts")</span>
            </div>

            <button
              type="button"
              onClick={handleTestTelegram}
              disabled={testingTelegram}
              className="px-3 py-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[11px] font-mono transition-colors disabled:opacity-50"
            >
              {testingTelegram ? 'Invio test...' : 'Invia Messaggio di Test'}
            </button>
          </div>

          {telegramTestStatus && (
            <div className="p-2.5 rounded-lg bg-slate-900 border border-sky-500/40 text-xs font-mono">
              {telegramTestStatus}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div>
              <label className="block text-slate-400 mb-1">Telegram Bot Token</label>
              <input
                type="text"
                value={formData.telegramBotToken || ''}
                onChange={(e) => setFormData({ ...formData, telegramBotToken: e.target.value })}
                placeholder="es. 123456789:ABCdefGhIJKlmNoPQRstuVWXyz"
                className="w-full bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-mono focus:border-amber-500 outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Ottenuto da @BotFather</span>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Telegram Chat ID (il tuo ID utente o canale)</label>
              <input
                type="text"
                value={formData.telegramChatId || ''}
                onChange={(e) => setFormData({ ...formData, telegramChatId: e.target.value })}
                placeholder="es. 987654321"
                className="w-full bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-mono focus:border-amber-500 outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Ottenuto da @userinfobot</span>
            </div>
          </div>
        </div>

        {/* Section 3: Google Gemini API Key */}
        <div className="bg-[#0e1422] border border-[#1f2d47] rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-amber-400 border-b border-slate-800 pb-2">
            <Key className="w-4 h-4" />
            <span>Google Gemini AI (SDK @google/genai)</span>
          </div>

          <div className="text-xs font-mono">
            <label className="block text-slate-400 mb-1">Gemini API Key (Supporta gemini-2.5-pro e gemini-2.5-flash)</label>
            <input
              type="password"
              value={formData.geminiApiKey || ''}
              onChange={(e) => setFormData({ ...formData, geminiApiKey: e.target.value })}
              placeholder={formData.hasGeminiApiKey ? '•••••••••••••••••••••••• (Configurata)' : 'Incolla la tua chiave AI Studio'}
              className="w-full bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-mono focus:border-amber-500 outline-none"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              Se lasciata vuota, viene utilizzata la variabile d'ambiente GEMINI_API_KEY.
            </span>
          </div>
        </div>

        {/* Section 4: Automazione Cron Job */}
        <div className="bg-[#0e1422] border border-[#1f2d47] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-emerald-400">
              <Clock className="w-4 h-4" />
              <span>Automazione Background (Node-Cron Interno)</span>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.autoScanEnabled}
                onChange={(e) => setFormData({ ...formData, autoScanEnabled: e.target.checked })}
                className="w-4 h-4 rounded text-amber-500 focus:ring-0 bg-slate-800 border-slate-700"
              />
              <span className="text-xs text-slate-300 font-mono">Scansioni Automatiche Attive</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div>
              <label className="block text-slate-400 mb-1">Scansione Mattutina (Orario Europa/Roma)</label>
              <input
                type="time"
                value={formData.morningScanTime}
                onChange={(e) => setFormData({ ...formData, morningScanTime: e.target.value })}
                className="w-full bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Di default alle 08:30 (apertura borse europee)</span>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Scansione Pomeridiana Pre-Market USA</label>
              <input
                type="time"
                value={formData.afternoonScanTime}
                onChange={(e) => setFormData({ ...formData, afternoonScanTime: e.target.value })}
                className="w-full bg-[#111827] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-amber-500 outline-none"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">Di default alle 15:00 (30 min prima di Wall Street)</span>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase font-mono flex items-center justify-center gap-2 transition-colors shadow-lg shadow-amber-500/20 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Salvataggio...' : 'Salva Tutte le Impostazioni'}</span>
          </button>
        </div>

      </form>

    </div>
  );
}
