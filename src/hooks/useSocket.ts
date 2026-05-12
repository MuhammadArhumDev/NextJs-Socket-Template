"use client";

import { useEffect, useRef, useState } from "react";
import { io as socketIO, Socket } from "socket.io-client";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");

  useEffect(() => {
    // Connect to the same origin — no separate port needed
    const socket = socketIO();
    socketRef.current = socket;

    socket.on("connect", () => setStatus("connected"));
    socket.on("disconnect", () => setStatus("disconnected"));
    socket.on("connect_error", () => setStatus("disconnected"));

    return () => {
      socket.disconnect();
    };
  }, []);

  return { socket: socketRef.current, status };
}
