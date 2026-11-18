'use client';

import React, { useEffect, useRef, useState } from 'react';
import { HistoricalCandle } from '@/lib/market-data';

interface TradingViewChartProps {
  ticker: string;
  entryPrice?: number;
  breakEvenPrice?: number;
  stopLossPrice?: number;
  takeProfit1Price?: number;
  takeProfit2Price?: number;
}

export function TradingViewChart({
  ticker,
  entryPrice,
  breakEvenPrice,
  stopLossPrice,
  takeProfit1Price,
  takeProfit2Price,
}: TradingViewChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<number>(180); // default 6 months

  useEffect(() => {
    let chartInstance: any = null;
    let isMounted = true;

    async function initChart() {
      if (!chartContainerRef.current) return;
      setLoading(true);
      setError(null);

      try {
        // Fetch historical data
        const res = await fetch(`/api/history/${ticker}?days=${timeframe}`);
        const data = await res.json();

        if (!data.candles || data.candles.length === 0) {
          throw new Error(data.error || 'Nessun dato storico disponibile');
        }

        if (!isMounted || !chartContainerRef.current) return;

        // Dynamic import of lightweight-charts
        const { createChart, CandlestickSeries, HistogramSeries, LineStyle, ColorType, CrosshairMode } =
          await import('lightweight-charts');

        // Clear previous content
        chartContainerRef.current.innerHTML = '';

        const container = chartContainerRef.current;
        const width = container.clientWidth || 600;
        const height = 380;

        chartInstance = createChart(container, {
          width,
          height,
          layout: {
            background: { type: ColorType.Solid, color: '#090d16' },
            textColor: '#94a3b8',
            fontSize: 11,
            fontFamily: 'ui-monospace, Menlo, Monaco, Consolas, monospace',
          },
          grid: {
            vertLines: { color: '#162032' },
            horzLines: { color: '#162032' },
          },
          crosshair: {
            mode: CrosshairMode.Normal,
            vertLine: { color: '#38bdf8', width: 1, style: LineStyle.Dashed },
            horzLine: { color: '#38bdf8', width: 1, style: LineStyle.Dashed },
          },
          timeScale: {
            borderColor: '#1f293d',
            timeVisible: false,
          },
          rightPriceScale: {
            borderColor: '#1f293d',
            scaleMargins: {
              top: 0.1,
              bottom: 0.25,
            },
          },
        });

        // Candlestick Series
        const candleSeries = chartInstance.addSeries(CandlestickSeries, {
          upColor: '#10b981',
          downColor: '#f43f5e',
          borderVisible: false,
          wickUpColor: '#10b981',
          wickDownColor: '#f43f5e',
        });

        // Format data for chart
        const formattedCandles = data.candles.map((c: HistoricalCandle) => ({
          time: c.date,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));

        candleSeries.setData(formattedCandles);

        // Volume Series at bottom
        const volumeSeries = chartInstance.addSeries(HistogramSeries, {
          color: '#26a69a',
          priceFormat: {
            type: 'volume',
          },
          priceScaleId: '', // overlay
        });

        volumeSeries.priceScale().applyOptions({
          scaleMargins: {
            top: 0.8,
            bottom: 0,
          },
        });

        const formattedVolume = data.candles.map((c: HistoricalCandle) => ({
          time: c.date,
          value: c.volume,
          color: c.close >= c.open ? 'rgba(16, 185, 129, 0.25)' : 'rgba(244, 63, 94, 0.25)',
        }));

        volumeSeries.setData(formattedVolume);

        // Add Horizontal Reference Lines:
        // 1. Entry Price Line
        if (entryPrice) {
          candleSeries.createPriceLine({
            price: entryPrice,
            color: '#38bdf8',
            lineWidth: 2,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: 'ENTRY',
          });
        }

        // 2. Break-Even Price Line
        if (breakEvenPrice && Math.abs(breakEvenPrice - (entryPrice || 0)) > 0.05) {
          candleSeries.createPriceLine({
            price: breakEvenPrice,
            color: '#fbbf24',
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: 'BREAK-EVEN',
          });
        }

        // 3. Stop Loss Line
        if (stopLossPrice) {
          candleSeries.createPriceLine({
            price: stopLossPrice,
            color: '#f43f5e',
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: true,
            title: 'STOP LOSS',
          });
        }

        // 4. Take Profit 1 Line
        if (takeProfit1Price) {
          candleSeries.createPriceLine({
            price: takeProfit1Price,
            color: '#10b981',
            lineWidth: 2,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: 'TP1 TARGET',
          });
        }

        // 5. Take Profit 2 Line
        if (takeProfit2Price) {
          candleSeries.createPriceLine({
            price: takeProfit2Price,
            color: '#059669',
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: 'TP2 TARGET',
          });
        }

        chartInstance.timeScale().fitContent();

        // Responsive resize
        const resizeObserver = new ResizeObserver((entries) => {
          if (entries[0] && chartInstance) {
            chartInstance.applyOptions({
              width: entries[0].contentRect.width,
            });
          }
        });

        resizeObserver.observe(container);

        setLoading(false);
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Errore nel caricamento del grafico');
          setLoading(false);
        }
      }
    }

    initChart();

    return () => {
      isMounted = false;
      if (chartInstance) {
        chartInstance.remove();
      }
    };
  }, [ticker, timeframe, entryPrice, breakEvenPrice, stopLossPrice, takeProfit1Price, takeProfit2Price]);

  return (
    <div className="bg-[#090d16] border border-[#1f293d] rounded-xl p-3 sm:p-4">
      
      {/* Timeframe selector & Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-mono font-bold text-white text-sm tracking-wide">{ticker}</span>
          <div className="hidden sm:flex items-center gap-3 text-[11px] font-mono">
            {entryPrice && <span className="text-cyan-400">● Entry: ${entryPrice}</span>}
            {breakEvenPrice && <span className="text-amber-400">● B/E: ${breakEvenPrice}</span>}
            {stopLossPrice && <span className="text-rose-400">● SL: ${stopLossPrice}</span>}
            {takeProfit1Price && <span className="text-emerald-400">● TP1: ${takeProfit1Price}</span>}
          </div>
        </div>

        {/* Timeframe switcher */}
        <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px] font-mono">
          {[
            { label: '1M', days: 30 },
            { label: '3M', days: 90 },
            { label: '6M', days: 180 },
            { label: '1A', days: 365 },
          ].map((tf) => (
            <button
              key={tf.label}
              onClick={() => setTimeframe(tf.days)}
              className={`px-2 py-0.5 rounded ${
                timeframe === tf.days
                  ? 'bg-amber-500 text-black font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="relative w-full h-[380px] overflow-hidden rounded-lg">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#090d16]/80 backdrop-blur z-10 text-slate-400 text-xs font-mono">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-2" />
            <span>Caricamento candele storiche...</span>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#090d16] text-rose-400 text-xs font-mono p-4 text-center">
            <span>⚠️ {error}</span>
          </div>
        )}

        <div ref={chartContainerRef} className="w-full h-full" />
      </div>

    </div>
  );
}
