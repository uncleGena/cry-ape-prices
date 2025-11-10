import { 
  BinanceCandleMessage, 
  CandlestickData as BinanceCandlestick, 
  ServerMessage
} from "@/types/binance";
import { useEffect, useMemo, useRef, useState } from "react";

type SocketMessage = {
  type: string;
  message: string;
  timestamp: string;
};

// Track active instances to enforce singleton usage
let activeInstances = 0;

const HISTORY_LIMIT = 30;

export function useWebsocket() {
  const [historyBySymbol, setHistoryBySymbol] = useState<Record<string, BinanceCandlestick[]>>({});
  const [feed, setFeed] = useState<BinanceCandleMessage[]>([]);
  const [connectionState, setConnectionState] = useState(
    "connecting" as "connecting" | "open" | "closed" | "error"
  );
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Throw error if multiple instances are used
    if (activeInstances > 0) {
      throw new Error("useWebsocket: You should use this hook only once on the page");
    }

    activeInstances += 1;

    let disable = false;
    let socket: WebSocket | null = null;

    const connect = async () => {
      if (disable) return;

      try {
        await fetch("/api/ws");
      } catch {
        if (!disable) {
          setConnectionState("error");
        }
        return;
      }

      if (disable) {
        return;
      }

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const socketUrl = `${protocol}//${window.location.host}/api/ws`;
      socket = new WebSocket(socketUrl);
      socketRef.current = socket;

      socket.addEventListener("open", () => {
        if (disable || socketRef.current !== socket) {
          return;
        }

        console.log("WebSocket opened");
        setConnectionState("open");
      });

      socket.addEventListener("message", (event) => {
        if (disable || socketRef.current !== socket) {
          return;
        }

        try {
          const parsed = JSON.parse(event.data) as ServerMessage;
          if (parsed.type === "binance-history") {
            const { symbol, candles } = parsed;
            setHistoryBySymbol((prev) => ({
              ...prev,
              [symbol]: [...candles].sort((a, b) => a.t - b.t),
            }));
          } else if (parsed.type === "binance-candle") {
            const message = parsed;
            setFeed((prev) => {
              const next = [...prev, message];
              return next.slice(-200);
            });

            setHistoryBySymbol((prev) => {
              const current = prev[message.symbol] ?? [];
              const index = current.findIndex((item) => item.t === message.candle.t);
              let updated: BinanceCandlestick[];

              if (index >= 0) {
                updated = [...current];
                updated[index] = message.candle;
              } else {
                updated = [...current, message.candle];
              }

              updated.sort((a, b) => a.t - b.t);

              if (updated.length > HISTORY_LIMIT) {
                updated = updated.slice(updated.length - HISTORY_LIMIT);
              }

              return {
                ...prev,
                [message.symbol]: updated,
              };
            });
          }
        } catch (error) {
          console.warn("Failed to parse WebSocket message", error);
        }
      });

      socket.addEventListener("close", () => {
        console.log("WebSocket closed, disable:", disable, "is current:", socketRef.current === socket);
        if (!disable && socketRef.current === socket) {
          setConnectionState("closed");
        }
      });

      socket.addEventListener("error", (err) => {
        console.log("WebSocket error:", err);
        if (!disable && socketRef.current === socket) {
          setConnectionState("error");
        }
      });
    };

    connect();

    return () => {
      console.log("Cleanup called");
      disable = true;
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
      socket?.close();
      activeInstances = 0;
    };
  }, []);

  const latestBySymbol = useMemo(() => {
    const grouped = new Map<string, BinanceCandlestick>();
    Object.entries(historyBySymbol).forEach(([symbol, series]) => {
      const latest = series[series.length - 1];
      if (latest) {
        grouped.set(symbol, latest);
      }
    });
    return grouped;
  }, [historyBySymbol]);

  return {
    connectionState,
    latestBySymbol,
    historyBySymbol,
    feed,
  }
}