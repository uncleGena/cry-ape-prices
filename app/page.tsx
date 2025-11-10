"use client";

import CandlestickChart from "@/components/CandlestickChart";
import { useWebsocket } from "@/hooks/useWebsocket";
import { SiSolana, SiTether } from "react-icons/si";
import { useEffect, useRef, useState } from "react";
import { FaBitcoin } from "react-icons/fa";

export default function Home() {  
  const {
    connectionState,
    historyBySymbol,
    feed,
  } = useWebsocket();

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        {/* Top */}
        <div>
          <h1 className="text-2xl font-semibold">Satoshi vs Yakovenko?</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Server connection status: <span className="font-medium">{connectionState}</span>
          </p>
        </div>

        <section className="w-full">
          <h2 className="mb-3 text-lg font-semibold">Price Action</h2>
          <CandlestickChart
            candles={historyBySymbol.BTCUSDT ?? []}
            symbol="BTCUSDT"
            interval="1m"
            icons={[
              <FaBitcoin key="bitcoin" className="h-10 w-10 text-amber-500" />,
              <SiTether key="tether" className="h-8 w-8 text-green-500" />,
            ]}
          />
        </section>

        <section className="w-full">
          <h2 className="mb-3 text-lg font-semibold">Price Action</h2>
          <CandlestickChart
            candles={historyBySymbol.SOLUSDT ?? []}
            symbol="SOLUSDT"
            interval="1m"
            icons={[
              <FaBitcoin key="bitcoin" className="h-10 w-10 text-amber-500" />,
              <SiSolana key="solana" className="h-8 w-8 text-purple-500" />,
            ]}
          />
        </section>
      </main>
    </div>
  );
}
