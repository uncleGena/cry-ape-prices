import type { NextApiRequest, NextApiResponse } from "next";
import { WebSocketServer } from "ws";
import type { IncomingMessage } from "http";
import type { Socket } from "net";

const formatServerMessage = (type: string, message: string) =>
  JSON.stringify({ type, message, timestamp: new Date().toISOString() });

type NextApiResponseWithSocket = NextApiResponse & {
  socket: Socket & {
    server: Record<string, unknown> & {
      wsServer?: WebSocketServer;
    };
  };
};

let globalWss: WebSocketServer | null = null;

function ensureWebSocketServer(res: NextApiResponseWithSocket) {
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

  wss.on("connection", (socket) => {
    console.log("WebSocket connection established");

    socket.send(
      formatServerMessage("server-welcome", "Connected to WebSocket server")
    );

    socket.on("message", (raw) => {
      console.log("Received message:", raw.toString());
      const payload = typeof raw === "string" ? raw : raw.toString();

      socket.send(
        formatServerMessage("server-echo", payload || "(received empty message)")
      );
    });

    socket.on("close", (code, reason) => {
      console.log("WebSocket connection closed:", code, reason.toString());
    });

    socket.on("error", (error) => {
      console.log("WebSocket server error:", error);
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
