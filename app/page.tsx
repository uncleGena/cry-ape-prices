"use client";

import { useWebsocket } from "@/hooks/useWebsocket";
import { useEffect, useRef, useState } from "react";
import { FaBitcoin } from "react-icons/fa";

export default function Home() {  
  const {
    connectionState,
  } = useWebsocket();

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        {/* Top */}
        <div>
          <h1 className="text-2xl font-semibold">Satoshi vs Yakovenko?</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Server connection status: <span className="font-medium">{connectionState}</span>
          </p>
        </div>

        <FaBitcoin />
      </main>
    </div>
  );
}
