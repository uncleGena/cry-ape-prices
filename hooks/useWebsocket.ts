import { useEffect, useRef, useState } from "react";

type SocketMessage = {
  type: string;
  message: string;
  timestamp: string;
};

// Track active instances to enforce singleton usage
let activeInstances = 0;

export function useWebsocket() {
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

        const helloMessage: SocketMessage = {
          type: "client-hello",
          message: "Client connected",
          timestamp: new Date().toISOString(),
        };

        socket?.send(JSON.stringify(helloMessage));
      });

      socket.addEventListener("message", (event) => {
        if (disable || socketRef.current !== socket) {
          return;
        }

        try {
          const parsed = JSON.parse(event.data) as SocketMessage;
          console.log("Received message:", parsed);
        } catch {
          console.log("Received non-JSON message:", event.data);
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
      activeInstances = Math.max(0, activeInstances - 1);
    };
  }, []);

  return {
    connectionState,
  }
}