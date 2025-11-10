"use client";

import { ReactElement, useEffect, useMemo, useRef } from "react";
import {
  CandlestickSeries as CandlestickSeriesDefinition,
  ColorType,
  createChart,
  UTCTimestamp,
} from "lightweight-charts";
import type { IChartApi, ISeriesApi } from "lightweight-charts";

import { motion } from "motion/react";

import type { CandlestickData as BinanceCandlestick } from "@/types/binance";

type ChartApi = IChartApi;
type CandlestickSeriesApi = ISeriesApi<"Candlestick">;

type CandlestickChartProps = {
  candles: BinanceCandlestick[];
  symbol?: string;
  interval?: string;
  icons?: ReactElement[];
};

const animationDuration = 0.5;

const TokenPairAnimation = ({
  baseIcon,
  quoteIcon,
  className,
}: {
  baseIcon?: ReactElement;
  quoteIcon?: ReactElement;
  className?: string;
}) => {
  if (!baseIcon || !quoteIcon) {
    return null;
  }

  const containerClasses = [
    "relative flex items-center justify-center overflow-hidden rounded-b-lg px-8 py-6",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClasses}>
      <div className="relative flex items-center justify-center scale-[300%]" style={{ width: "15.5rem", height: "14.25rem" }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="relative z-0 flex items-center justify-center rounded-md bg-white/95 p-1 shadow"
            initial={{ x: 14 }}
            animate={{ x: [14, 4, 14] }}
            transition={{ duration: animationDuration, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="text-2xl">{quoteIcon}</div>
          </motion.div>
        </div>

        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="relative z-10 flex items-center justify-center rounded-md bg-white p-1 shadow-lg"
            initial={{ x: -12 }}
            animate={{ x: [-12, 4, -12] }}
            transition={{ duration: animationDuration, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="text-2xl">{baseIcon}</div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

const CandlestickChart = ({ candles, symbol = "BTCUSDT", interval = "1m", icons }: CandlestickChartProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ChartApi | null>(null);
  const seriesRef = useRef<CandlestickSeriesApi | null>(null);
  const initialisedRef = useRef(false);

  const [baseIcon, quoteIcon] = icons ?? [];

  const seriesData = useMemo(() => {
    return candles
      .map((candle) => {
        const time = Math.floor(candle.t / 1000);
        const open = Number(candle.o);
        const high = Number(candle.h);
        const low = Number(candle.l);
        const close = Number(candle.c);

        if ([open, high, low, close].some((value) => Number.isNaN(value))) {
          return null;
        }

        return {
          time: time as UTCTimestamp,
          open,
          high,
          low,
          close,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  }, [candles]);

  useEffect(() => {
    if (!containerRef.current) {
      return () => undefined;
    }

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#0f172a" },
        textColor: "#f8fafc",
      },
      grid: {
        vertLines: { color: "rgba(148, 163, 184, 0.2)" },
        horzLines: { color: "rgba(148, 163, 184, 0.2)" },
      },
      autoSize: true,
      rightPriceScale: {
        borderColor: "rgba(148, 163, 184, 0.4)",
      },
      timeScale: {
        borderColor: "rgba(148, 163, 184, 0.4)",
      },
      crosshair: {
        mode: 0,
      },
    });

    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeriesDefinition, {
      upColor: "#22c55e",
      borderUpColor: "#22c55e",
      wickUpColor: "#22c55e",
      downColor: "#ef4444",
      borderDownColor: "#ef4444",
      wickDownColor: "#ef4444",
    });

    seriesRef.current = series;

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        chartRef.current.applyOptions({ width: clientWidth, height: clientHeight });
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      initialisedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current) {
      return;
    }

    if (seriesData.length === 0) {
      seriesRef.current.setData([]);
      initialisedRef.current = false;
      return;
    }

    seriesRef.current.setData(seriesData);

    if (!initialisedRef.current && chartRef.current) {
      chartRef.current.timeScale().fitContent();
      initialisedRef.current = true;
    }
  }, [seriesData]);

  return (
    <div className="w-full overflow-hidden rounded-lg border border-slate-700 bg-slate-900/70 p-0">
      <div className="p-4">
        <header className="mb-3 flex items-center justify-between text-sm text-slate-300">
          <span className="font-semibold tracking-wide text-slate-100">{symbol}</span>
          <span>{interval}</span>
        </header>
        <div ref={containerRef} className="h-96 w-full">
          {seriesData.length === 0 && (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              Waiting for market data...
            </div>
          )}
        </div>
      </div>
      <TokenPairAnimation baseIcon={baseIcon} quoteIcon={quoteIcon} className="h-96" />
    </div>
  );
};

export default CandlestickChart;
