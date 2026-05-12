"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io as socketIO, Socket } from "socket.io-client";

type ConnectionStatus = "connecting" | "connected" | "disconnected";

interface CounterEvent {
  count: number;
  timestamp: string;
}

interface LogEntry {
  id: number;
  message: string;
  time: string;
  type: "info" | "event" | "error";
}

export default function RealtimeCounter() {
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [count, setCount] = useState(0);
  const [totalEvents, setTotalEvents] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logIdRef = useRef(0);

  const addLog = useCallback((message: string, type: LogEntry["type"] = "info") => {
    const now = new Date();
    const time = now.toLocaleTimeString("en-US", { hour12: false });
    setLogs((prev) => [
      { id: ++logIdRef.current, message, time, type },
      ...prev.slice(0, 49), // keep last 50
    ]);
  }, []);

  useEffect(() => {
    const socket = socketIO();
    socketRef.current = socket;

    socket.on("connect", () => {
      setStatus("connected");
      addLog(`Connected — socket ID: ${socket.id}`, "info");
    });

    socket.on("disconnect", (reason) => {
      setStatus("disconnected");
      addLog(`Disconnected: ${reason}`, "error");
    });

    socket.on("connect_error", (err) => {
      setStatus("disconnected");
      addLog(`Connection error: ${err.message}`, "error");
    });

    // Listen for counter increments pushed from server
    socket.on("counter:update", (data: CounterEvent) => {
      setCount(data.count);
      setTotalEvents((n) => n + 1);
      addLog(`counter:update → count = ${data.count}  (${data.timestamp})`, "event");
    });

    // Listen for notifications from cron/API
    socket.on("notification", (data: { message: string }) => {
      addLog(`notification → ${data.message}`, "event");
    });

    return () => {
      socket.disconnect();
    };
  }, [addLog]);

  // Emit an increment event from the client → server will broadcast to all
  const increment = () => {
    socketRef.current?.emit("counter:increment");
  };

  const reset = () => {
    socketRef.current?.emit("counter:reset");
  };

  const statusColor: Record<ConnectionStatus, string> = {
    connecting: "#f59e0b",
    connected: "#22c55e",
    disconnected: "#ef4444",
  };

  return (
    <main className="page">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="header">
        <div className="header-inner">
          <h1 className="brand">Socket<span className="brand-accent">IO</span></h1>
          <div className="status-pill">
            <span
              className="status-dot"
              style={{ background: statusColor[status] }}
            />
            <span className="status-label">{status}</span>
          </div>
        </div>
      </header>

      {/* ── Hero counter ────────────────────────────────────── */}
      <section className="hero">
        <p className="hero-eyebrow">Real-Time Counter</p>
        <div className="counter-display" aria-live="polite">
          {count.toString().padStart(4, "0")}
        </div>
        <p className="hero-sub">
          This value is synced across every connected client via WebSocket.
        </p>

        <div className="btn-row">
          <button id="btn-increment" className="btn btn-primary" onClick={increment}>
            + Increment
          </button>
          <button id="btn-reset" className="btn btn-ghost" onClick={reset}>
            Reset
          </button>
        </div>
      </section>

      {/* ── Stats row ───────────────────────────────────────── */}
      <section className="stats-row">
        <div className="stat-card">
          <span className="stat-label">Current Count</span>
          <span className="stat-value">{count}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Events Received</span>
          <span className="stat-value">{totalEvents}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Connection</span>
          <span className="stat-value" style={{ color: statusColor[status] }}>
            {status}
          </span>
        </div>
      </section>

      {/* ── Event log ───────────────────────────────────────── */}
      <section className="log-section">
        <div className="log-header">
          <span className="log-title">Event Log</span>
          <span className="log-count">{logs.length} entries</span>
        </div>
        <div className="log-body" role="log" aria-label="Socket.IO event log">
          {logs.length === 0 ? (
            <p className="log-empty">Waiting for events…</p>
          ) : (
            logs.map((entry) => (
              <div key={entry.id} className={`log-entry log-entry--${entry.type}`}>
                <span className="log-time">{entry.time}</span>
                <span className="log-msg">{entry.message}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
