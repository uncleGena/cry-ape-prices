"use client";

import { ReactElement, useEffect, useMemo, useRef, useState } from "react";
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
  const [chartVisible, setChartVisible] = useState(false);


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

  const hasCandles = seriesData.length > 0;

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

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setChartVisible(hasCandles);
    }, hasCandles ? 500 : 0);

    return () => window.clearTimeout(timeoutId);
  }, [hasCandles]);

  return (
    <div className="w-full overflow-hidden rounded-lg border border-slate-700 bg-[#0f172a]">
      <div className="relative h-96 overflow-hidden">
        <motion.div
          className="absolute inset-0 flex flex-col"
          initial={{ y: "-100%" }}
          animate={{ y: chartVisible ? "0%" : "-100%" }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <div className="flex h-full flex-col p-4">
            <header className="mb-3 flex items-center justify-between text-sm text-slate-300">
              <span className="font-semibold tracking-wide text-slate-100">{symbol}</span>
              <span>{interval}</span>
            </header>
            <div ref={containerRef} className="min-h-0 flex-1 w-full overflow-hidden">
              {seriesData.length === 0 && (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                  Waiting for market data...
                </div>
              )}
            </div>
          </div>
        </motion.div>
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0, y: "0%" }}
          animate={{ opacity: chartVisible ? 0 : 1, y: chartVisible ? "100%" : "0%" }}
          transition={{
            opacity: { duration: 0.1, ease: "easeOut" },
            y: { duration: 0.3, ease: "easeInOut" },
          }}
        >
          <TokenPairAnimation baseIcon={baseIcon} quoteIcon={quoteIcon} className="h-full" />
        </motion.div>
      </div>
    </div>
  );
};

export default CandlestickChart;
