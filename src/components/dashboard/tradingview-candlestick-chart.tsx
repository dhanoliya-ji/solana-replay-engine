"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  CrosshairMode,
  HistogramSeries,
  LineStyle,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp
} from 'lightweight-charts';
import type { ActivityRow, ChartCandle } from '@/types/domain';
import { formatNumber, formatTimestamp } from '@/lib/utils';

type ChartMarkerInput = {
  id: string;
  type: 'BUY' | 'SELL' | 'SWAP';
  source: 'target' | 'simulated';
  timestamp: number | null;
  value: number;
  activity: ActivityRow;
};

type TooltipState = {
  x: number;
  y: number;
  candle: ChartCandle;
};

function toUtcTimestamp(timestampMs: number): UTCTimestamp {
  return Math.floor(timestampMs / 1000) as UTCTimestamp;
}

function markerShape(type: 'BUY' | 'SELL' | 'SWAP') {
  if (type === 'SELL') return 'arrowDown' as const;
  return 'arrowUp' as const;
}

function markerPosition(type: 'BUY' | 'SELL' | 'SWAP') {
  if (type === 'SELL') return 'aboveBar' as const;
  return 'belowBar' as const;
}

function markerColor(input: ChartMarkerInput) {
  if (input.source === 'simulated') {
    return input.type === 'SELL' ? '#8b5cf6' : '#60a5fa';
  }
  return input.type === 'SELL' ? '#f87171' : input.type === 'SWAP' ? '#f59e0b' : '#84cc16';
}

export function TradingviewCandlestickChart({
  candles,
  markers,
  onSelectActivity,
  view,
  showVolume = true,
  showMarkers = true,
  fitSignal = 0
}: {
  candles: ChartCandle[];
  markers: ChartMarkerInput[];
  onSelectActivity: (activity: ActivityRow) => void;
  view: 'mc' | 'price';
  showVolume?: boolean;
  showMarkers?: boolean;
  fitSignal?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick', Time> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram', Time> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const candleData = useMemo<CandlestickData<Time>[]>(() => {
    return candles.map((candle) => ({
      time: toUtcTimestamp(candle.bucketStart),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close
    }));
  }, [candles]);

  const candleByTime = useMemo(() => {
    const map = new Map<number, ChartCandle>();
    for (const candle of candles) {
      map.set(toUtcTimestamp(candle.bucketStart) as unknown as number, candle);
    }
    return map;
  }, [candles]);

  const volumeData = useMemo<HistogramData<Time>[]>(() => {
    return candles.map((candle) => ({
      time: toUtcTimestamp(candle.bucketStart),
      value: candle.volume,
      color: candle.close >= candle.open ? 'rgba(34,197,94,0.55)' : 'rgba(239,68,68,0.55)'
    }));
  }, [candles]);

  const resolvedMarkers = useMemo<SeriesMarker<Time>[]>(() => {
    if (!candles.length) return [];

    return markers.flatMap((input) => {
      const targetTimestamp = input.timestamp ?? candles[0].bucketStart;
      const nearest =
        candles.find((candle) => targetTimestamp <= candle.bucketEnd && targetTimestamp >= candle.bucketStart) ??
        candles.find((candle) => (candle.timestamp ?? candle.bucketStart) >= targetTimestamp) ??
        candles[candles.length - 1];

      if (!nearest) return [];

      return [
        {
          id: input.id,
          time: toUtcTimestamp(nearest.bucketStart),
          position: markerPosition(input.type),
          shape: markerShape(input.type),
          color: markerColor(input),
          text:
            input.source === 'simulated'
              ? input.type === 'SELL'
                ? 'MS'
                : 'MB'
              : undefined,
          size: 1.2
        }
      ];
    });
  }, [candles, markers]);

  const markerActivityById = useMemo(() => {
    const map = new Map<string, ActivityRow>();
    for (const marker of markers) {
      map.set(marker.id, marker.activity);
    }
    return map;
  }, [markers]);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: 360,
      layout: {
        background: { type: ColorType.Solid, color: '#0a1019' },
        textColor: '#7c879e',
        fontFamily: 'Arial, Helvetica, sans-serif',
        attributionLogo: false,
        panes: {
          separatorColor: '#171d29',
          separatorHoverColor: '#253045'
        }
      },
      grid: {
        vertLines: { color: 'rgba(148,163,184,0.07)' },
        horzLines: { color: 'rgba(148,163,184,0.10)' }
      },
      rightPriceScale: {
        borderColor: '#171d29',
        scaleMargins: {
          top: 0.12,
          bottom: 0.08
        }
      },
      timeScale: {
        borderColor: '#171d29',
        timeVisible: true,
        secondsVisible: true,
        rightOffset: 8,
        minBarSpacing: 7,
        barSpacing: 10
      },
      crosshair: {
        mode: CrosshairMode.MagnetOHLC,
        vertLine: {
          color: 'rgba(148,163,184,0.35)',
          width: 1,
          style: LineStyle.Solid,
          labelBackgroundColor: '#111827'
        },
        horzLine: {
          color: 'rgba(148,163,184,0.35)',
          width: 1,
          style: LineStyle.Solid,
          labelBackgroundColor: '#111827'
        }
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: {
          time: true,
          price: true
        }
      }
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      borderVisible: false,
      priceLineVisible: true,
      lastValueVisible: true,
      priceLineColor: '#ef4444',
      priceLineStyle: LineStyle.Dashed,
      priceFormat: {
        type: 'price',
        precision: view === 'price' ? 6 : 2,
        minMove: view === 'price' ? 0.000001 : 0.01
      }
    });
    const volumeSeries = chart.addSeries(
      HistogramSeries,
      {
        priceFormat: {
          type: 'volume'
        },
        priceScaleId: 'volume'
      },
      1
    );
    chart.priceScale('volume', 1).applyOptions({
      scaleMargins: {
        top: 0.05,
        bottom: 0
      }
    });
    chart.panes()[1]?.setHeight(90);

    chartRef.current = chart;
    seriesRef.current = series;
    volumeSeriesRef.current = volumeSeries;
    markersRef.current = createSeriesMarkers(series, [], { autoScale: true });

    const handleCrosshairMove = (param: Parameters<IChartApi['subscribeCrosshairMove']>[0] extends (arg: infer P) => void ? P : never) => {
      const candle = param.time ? candleByTime.get(param.time as unknown as number) : undefined;
      if (!candle || !param.point) {
        setTooltip(null);
        return;
      }

      setTooltip({
        x: param.point.x,
        y: param.point.y,
        candle
      });
    };

    const handleClick = (param: Parameters<IChartApi['subscribeClick']>[0] extends (arg: infer P) => void ? P : never) => {
      const objectId = param.hoveredObjectId;
      if (objectId == null) return;
      const activity = markerActivityById.get(String(objectId));
      if (activity) onSelectActivity(activity);
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);
    chart.subscribeClick(handleClick);

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !chartRef.current) return;
      chartRef.current.applyOptions({
        width: entry.contentRect.width
      });
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      chart.unsubscribeClick(handleClick);
      markersRef.current = null;
      seriesRef.current = null;
      volumeSeriesRef.current = null;
      chart.remove();
      chartRef.current = null;
    };
  }, [candleByTime, markerActivityById, onSelectActivity, view]);

  useEffect(() => {
    const series = seriesRef.current;
    const markerApi = markersRef.current;
    const chart = chartRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!series || !markerApi || !chart || !volumeSeries) return;

    series.setData(candleData);
    markerApi.setMarkers(showMarkers ? resolvedMarkers : []);
    volumeSeries.setData(showVolume ? volumeData : []);
    chart.timeScale().applyOptions({
      barSpacing: Math.max(7, Math.min(18, 700 / Math.max(1, candleData.length)))
    });
    chart.timeScale().fitContent();
  }, [candleData, resolvedMarkers, showMarkers, showVolume, volumeData]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.timeScale().fitContent();
  }, [fitSignal]);

  return (
    <div className="relative h-[360px] w-full overflow-hidden bg-[linear-gradient(180deg,rgba(15,23,42,0.18)_0%,rgba(2,6,23,0.65)_100%)]">
      <div ref={containerRef} className="h-full w-full" />

      {tooltip ? (
        <div
          className="pointer-events-none absolute z-10 min-w-[180px] rounded-xl border border-[#20283b] bg-[#0d1320]/95 px-3 py-2 text-xs text-slate-300 shadow-2xl"
          style={{
            left: Math.min(tooltip.x + 14, 760),
            top: Math.max(12, tooltip.y - 96)
          }}
        >
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Candle</div>
          <div className="mt-1 font-medium text-slate-100">
            {formatTimestamp(tooltip.candle.timestamp)}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
            <span className="text-slate-500">Open</span>
            <span className="text-right">{formatNumber(tooltip.candle.open, view === 'price' ? 6 : 2)}</span>
            <span className="text-slate-500">High</span>
            <span className="text-right">{formatNumber(tooltip.candle.high, view === 'price' ? 6 : 2)}</span>
            <span className="text-slate-500">Low</span>
            <span className="text-right">{formatNumber(tooltip.candle.low, view === 'price' ? 6 : 2)}</span>
            <span className="text-slate-500">Close</span>
            <span className="text-right">{formatNumber(tooltip.candle.close, view === 'price' ? 6 : 2)}</span>
            <span className="text-slate-500">Trades</span>
            <span className="text-right">{tooltip.candle.tradeCount}</span>
            <span className="text-slate-500">Volume</span>
            <span className="text-right">{formatNumber(tooltip.candle.volume, 4)}</span>
            <span className="text-slate-500">Buy volume</span>
            <span className="text-right">{formatNumber(tooltip.candle.buyVolume, 4)}</span>
            <span className="text-slate-500">Sell volume</span>
            <span className="text-right">{formatNumber(tooltip.candle.sellVolume, 4)}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
