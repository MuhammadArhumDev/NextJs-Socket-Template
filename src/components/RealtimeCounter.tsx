"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io as socketIO, Socket } from "socket.io-client";

type ConnectionStatus = "connecting" | "connected" | "disconnected";

interface CounterEvent {
  count: number;
  timestamp: string;
}

interface ChatMessage {
  id: string;
  text: string;
  sender: string;
  timestamp: string;
}

export default function RealtimeCounter() {
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [count, setCount] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [totalEvents, setTotalEvents] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const chatBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socket = socketIO();
    socketRef.current = socket;

    socket.on("connect", () => {
      setStatus("connected");
    });

    socket.on("disconnect", () => {
      setStatus("disconnected");
    });

    socket.on("connect_error", () => {
      setStatus("disconnected");
    });

    // Listen for counter increments pushed from server
    socket.on("counter:update", (data: CounterEvent) => {
      setCount(data.count);
      setTotalEvents((n) => n + 1);
    });

    // Listen for user count updates
    socket.on("users:count", (data: { count: number }) => {
      setUserCount(data.count);
    });

    // Listen for chat messages
    socket.on("chat:message", (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [messages]);

  const increment = () => {
    socketRef.current?.emit("counter:increment");
  };

  const reset = () => {
    socketRef.current?.emit("counter:reset");
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !socketRef.current) return;

    socketRef.current.emit("chat:message", {
      text: inputMessage,
      sender: `User_${socketRef.current.id?.substring(0, 4)}`,
    });
    setInputMessage("");
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
          <span className="stat-label">Online Users</span>
          <span className="stat-value">{userCount}</span>
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

      {/* ── Global Chat ───────────────────────────────────────── */}
      <section className="chat-section">
        <div className="chat-container">
          <div className="chat-header">
            <span className="chat-title">Global Chat</span>
            <span className="chat-title">{messages.length} Messages</span>
          </div>
          <div className="chat-body" ref={chatBodyRef}>
            {messages.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#999', marginTop: '140px', fontSize: '0.85rem' }}>
                No messages yet. Start the conversation!
              </p>
            ) : (
              messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`message ${msg.sender.includes(socketRef.current?.id?.substring(0, 4) || 'NOT_FOUND') ? 'message-own' : 'message-other'}`}
                >
                  <span className="message-info">{msg.sender}</span>
                  <p>{msg.text}</p>
                  <span className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
          <form className="chat-input-area" onSubmit={sendMessage}>
            <input 
              type="text" 
              className="chat-input" 
              placeholder="Type your message..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              disabled={status !== "connected"}
            />
            <button 
              type="submit" 
              className="chat-send-btn"
              disabled={!inputMessage.trim() || status !== "connected"}
            >
              Send
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
