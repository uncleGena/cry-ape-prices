import type { NextApiRequest, NextApiResponse } from "next";
import { WebSocketServer } from "ws";
import type WebSocket from "ws";
import type { IncomingMessage } from "http";
import type { Socket } from "net";
import Binance from "node-binance-api";

import type {
  BinanceCandleMessage,
  BinanceHistoryMessage,
  CandlestickData,
  ServerInfoMessage,
} from "@/types/binance";

const BINANCE_SYMBOLS = ["BTCUSDT", "SOLUSDT"] as const;
const BINANCE_INTERVAL = "1m";
const HISTORY_LIMIT = 30;

const formatServerMessage = (type: ServerInfoMessage["type"], message: string) =>
  JSON.stringify({ type, message, timestamp: new Date().toISOString() });

type NextApiResponseWithSocket = NextApiResponse & {
  socket: Socket & {
    server: Record<string, unknown> & {
      wsServer?: WebSocketServer;
    };
  };
};

let globalWss: WebSocketServer | null = null;
let binanceClient: Binance | null = null;
let binanceStreamActive = false;
const sockets = new Set<WebSocket>();
const historyCache = new Map<string, CandlestickData[]>();

const ensureBinanceClient = (): Binance => {
  if (binanceClient) {
    return binanceClient;
  }

  const apiKey = process.env.NEXT_ENV_BINANCE_KEY;
  const apiSecret = process.env.NEXT_ENV_BINANCE_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error("Missing Binance API credentials. Check NEXT_ENV_BINANCE_KEY and NEXT_ENV_BINANCE_SECRET.");
  }

  const client = new Binance();
  client.options({
    APIKEY: apiKey,
    APISECRET: apiSecret,
    reconnect: true,
  });

  binanceClient = client;
  return client;
};

const broadcast = (message: BinanceCandleMessage | ServerInfoMessage) => {
  const payload = JSON.stringify({ ...message, timestamp: new Date().toISOString() });
  sockets.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(payload);
    } else {
      sockets.delete(client);
    }
  });
};

const updateHistory = (symbol: string, candle: CandlestickData) => {
  const existing = historyCache.get(symbol) ?? [];
  const index = existing.findIndex((item) => item.t === candle.t);
  let updated: CandlestickData[];

  if (index >= 0) {
    // replace the existing candle with the same open time.
    updated = [...existing];
    updated[index] = candle;
  } else {
    // append the new candle while keeping the array immutable.
    updated = [...existing, candle];
  }

  // ensure candles remain sorted by open time.
  updated.sort((a, b) => a.t - b.t);

  if (updated.length > HISTORY_LIMIT) {
    // truncate to the newest HISTORY_LIMIT candles.
    updated = updated.slice(updated.length - HISTORY_LIMIT);
  }

  historyCache.set(symbol, updated);
  return updated;
};

const ensureBinanceStream = () => {
  if (binanceStreamActive) {
    return;
  }

  try {
    const client = ensureBinanceClient();
    const symbols = [...BINANCE_SYMBOLS];
    client.websockets.candlesticks(symbols, BINANCE_INTERVAL, (candlestick: Record<string, unknown>) => {
      const symbol = String(candlestick.s ?? "");
      const kline = candlestick.k as Record<string, unknown> | undefined;

      if (!symbol || !kline) {
        return;
      }

      const candle = mapWsKlineToCandlestick(symbol, kline);
      updateHistory(symbol, candle);
      const message: BinanceCandleMessage = {
        type: "binance-candle",
        symbol,
        interval: candle.i,
        candle,
        timestamp: new Date().toISOString(),
      };

      broadcast(message);
    });

    binanceStreamActive = true;
  } catch (error) {
    console.error("Failed to initialise Binance candlestick stream", error);
    broadcast({
      type: "server-error",
      message: "Failed to initialise Binance candlestick stream.",
      timestamp: new Date().toISOString(),
    });
  }
};

const sendInitialCandles = async (socket: WebSocket) => {
  try {
    const client = ensureBinanceClient();
    for (const symbol of BINANCE_SYMBOLS) {
      let history = historyCache.get(symbol);

      if (!history || history.length === 0) {
        const klines = (await client.candlesticks(symbol, BINANCE_INTERVAL, {
          limit: HISTORY_LIMIT,
        })) as unknown;

        if (Array.isArray(klines)) {
          history = klines
            .map((entry) => mapRestCandlestick(symbol, entry))
            .sort((a, b) => a.t - b.t);
        } else if (klines) {
          history = [mapRestCandlestick(symbol, klines)];
        } else {
          history = [];
        }

        if (history.length > 0) {
          history = history.slice(-HISTORY_LIMIT);
          historyCache.set(symbol, history);
        }
      }

      if (!history || history.length === 0) continue;

      const historyMessage: BinanceHistoryMessage = {
        type: "binance-history",
        symbol,
        interval: BINANCE_INTERVAL,
        candles: history.slice(),
        timestamp: new Date().toISOString(),
      };

      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify(historyMessage));
      }
    }
  } catch (error) {
    console.error("Failed to fetch initial Binance candles", error);
    if (socket.readyState === socket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "server-error",
          message: "Failed to fetch initial Binance candles.",
          timestamp: new Date().toISOString(),
        })
      );
    }
  }
};

const ensureWebSocketServer = (res: NextApiResponseWithSocket) => {
  if (globalWss) {
    return globalWss;
  }

  const wss = new WebSocketServer({ noServer: true });
  globalWss = wss;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const server = res.socket.server as any;

  // Remove any existing upgrade listeners to prevent duplicates
  server.removeAllListeners("upgrade");

  // This is for simple websocket handling without a library like next-ws
  server.on("upgrade", (request: IncomingMessage, socket: Socket, head: Buffer) => {
    const { pathname } = new URL(request.url!, `http://${request.headers.host}`);

    console.log("Upgrade request received for:", pathname);

    // Not our WebSocket route (HMR etc...
    if (pathname !== "/api/ws") {
      console.log("Ignoring upgrade for:", pathname);
      return;
    }

    console.log("Handling WebSocket upgrade for /api/ws");
    wss.handleUpgrade(request, socket, head, (websocket) => {
      wss.emit("connection", websocket, request);
    });
  });

  ensureBinanceStream();

  wss.on("connection", (socket) => {
    console.log("WebSocket connection established");
    sockets.add(socket);

    // const heartbeat = setInterval(() => {
    //   if (socket.readyState === socket.OPEN) {
    //     socket.send(formatServerMessage("server-heartbeat", "tick"));
    //   } else {
    //     clearInterval(heartbeat);
    //   }
    // }, 15000);

    if (socket.readyState === socket.OPEN) {
      socket.send(formatServerMessage("server-info", "Connected to WebSocket server"));
    }

    sendInitialCandles(socket).catch((error) => {
      console.error("Failed to send initial candles", error);
    });

    socket.on("close", (code, reason) => {
      console.log("WebSocket connection closed:", code, reason.toString());
      sockets.delete(socket);
      // clearInterval(heartbeat);
    });

    socket.on("error", (error) => {
      console.log("WebSocket server error:", error);
      sockets.delete(socket);
      // clearInterval(heartbeat);
    });
  });

  return wss;
};

export default function handler(
  _req: NextApiRequest,
  res: NextApiResponseWithSocket
) {
  ensureWebSocketServer(res);

  res.status(200).json({ ok: true });
}


function mapWsKlineToCandlestick (symbol: string, kline: Record<string, unknown>): CandlestickData {
  return {
    t: Number(kline.t),
    T: Number(kline.T),
    s: symbol,
    i: String(kline.i ?? BINANCE_INTERVAL),
    f: Number(kline.f ?? 0),
    L: Number(kline.L ?? 0),
    o: String(kline.o ?? "0"),
    c: String(kline.c ?? "0"),
    h: String(kline.h ?? "0"),
    l: String(kline.l ?? "0"),
    v: String(kline.v ?? "0"),
    n: Number(kline.n ?? 0),
    x: Boolean(kline.x),
    q: String(kline.q ?? "0"),
    V: String(kline.V ?? "0"),
    Q: String(kline.Q ?? "0"),
    B: String(kline.B ?? ""),
  }
}

function mapRestCandlestick (symbol: string, raw: unknown): CandlestickData {
  if (Array.isArray(raw)) {
    const [
      openTime,
      open,
      high,
      low,
      close,
      volume,
      closeTime,
      quoteAssetVolume,
      trades,
      takerBuyBaseVolume,
      takerBuyQuoteVolume,
      ignore,
    ] = raw as [number, string, string, string, string, string, number, string, number, string, string, string];

    return {
      t: Number(openTime),
      T: Number(closeTime),
      s: symbol,
      i: BINANCE_INTERVAL,
      f: 0,
      L: 0,
      o: String(open),
      c: String(close),
      h: String(high),
      l: String(low),
      v: String(volume),
      n: Number(trades ?? 0),
      x: true,
      q: String(quoteAssetVolume ?? "0"),
      V: String(takerBuyBaseVolume ?? "0"),
      Q: String(takerBuyQuoteVolume ?? "0"),
      B: String(ignore ?? ""),
    };
  }

  if (raw && typeof raw === "object") {
    const data = raw as Record<string, unknown>;

    const openTime = Number(data.openTime ?? data.t ?? Date.now());
    const closeTime = Number(data.closeTime ?? data.T ?? openTime);

    return {
      t: openTime,
      T: closeTime,
      s: symbol,
      i: String(data.interval ?? data.i ?? BINANCE_INTERVAL),
      f: Number(data.firstTradeId ?? data.f ?? 0),
      L: Number(data.lastTradeId ?? data.L ?? 0),
      o: String(data.open ?? data.o ?? "0"),
      c: String(data.close ?? data.c ?? "0"),
      h: String(data.high ?? data.h ?? "0"),
      l: String(data.low ?? data.l ?? "0"),
      v: String(data.volume ?? data.v ?? "0"),
      n: Number(data.numberOfTrades ?? data.n ?? 0),
      x: Boolean(data.isClosed ?? data.x ?? true),
      q: String(data.quoteAssetVolume ?? data.q ?? "0"),
      V: String(data.takerBuyBaseAssetVolume ?? data.V ?? "0"),
      Q: String(data.takerBuyQuoteAssetVolume ?? data.Q ?? "0"),
      B: String(data.ignore ?? data.B ?? ""),
    };
  }

  throw new TypeError("Unsupported candlestick payload shape from Binance REST API");
};