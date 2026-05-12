"use client";

import { useEffect, useRef, useState } from "react";
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

    socket.on("counter:update", (data: CounterEvent) => {
      setCount(data.count);
      setTotalEvents((n) => n + 1);
    });

    socket.on("users:count", (data: { count: number }) => {
      setUserCount(data.count);
    });

    socket.on("chat:message", (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

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
    connecting: "bg-amber-500",
    connected: "bg-green-500",
    disconnected: "bg-red-500",
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white border-b-2 border-black">
        <div className="max-w-[960px] mx-auto px-6 h-[60px] flex items-center justify-between">
          <h1 className="text-xl font-black uppercase tracking-tighter">
            Socket<span className="text-black">IO</span>
          </h1>
          <div className="flex items-center gap-2 px-3.5 py-1.5 border-2 border-black text-[0.8rem] font-bold uppercase tracking-widest">
            <span className={`w-2 h-2 animate-pulse ${statusColor[status]}`} />
            <span className="capitalize tracking-normal">{status}</span>
          </div>
        </div>
      </header>

      {/* ── Hero counter ────────────────────────────────────── */}
      <section className="flex-1 flex flex-col items-center justify-center py-16 px-6 text-center">
        <p className="text-[0.75rem] font-semibold uppercase tracking-[0.15em] text-gray-500 mb-6">
          Real-Time Counter
        </p>
        <div className="font-mono text-[clamp(5rem,18vw,10rem)] font-bold leading-none tracking-tighter text-black mb-6 select-none active:scale-95 transition-transform">
          {count.toString().padStart(4, "0")}
        </div>
        <p className="text-[0.9rem] text-gray-500 max-w-[420px] mb-10 leading-relaxed">
          This value is synced across every connected client via WebSocket.
        </p>

        <div className="flex gap-3 flex-wrap justify-center">
          <button 
            className="px-9 py-3.5 bg-black text-white text-[0.9rem] font-bold uppercase tracking-widest border-2 border-black hover:bg-gray-800 transition-colors active:scale-95"
            onClick={increment}
          >
            + Increment
          </button>
          <button 
            className="px-9 py-3.5 bg-white text-black text-[0.9rem] font-bold uppercase tracking-widest border-2 border-black hover:bg-gray-100 transition-colors active:scale-95"
            onClick={reset}
          >
            Reset
          </button>
        </div>
      </section>

      {/* ── Stats row ───────────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-3 border-y-2 border-black w-full">
        <div className="flex flex-col items-center justify-center py-8 px-4 gap-2 border-b-2 sm:border-b-0 sm:border-r-2 border-black">
          <span className="text-[0.7rem] font-semibold uppercase tracking-widest text-gray-500">Online Users</span>
          <span className="font-mono text-2xl font-bold tracking-tight">{userCount}</span>
        </div>
        <div className="flex flex-col items-center justify-center py-8 px-4 gap-2 border-b-2 sm:border-b-0 sm:border-r-2 border-black">
          <span className="text-[0.7rem] font-semibold uppercase tracking-widest text-gray-500">Events Received</span>
          <span className="font-mono text-2xl font-bold tracking-tight">{totalEvents}</span>
        </div>
        <div className="flex flex-col items-center justify-center py-8 px-4 gap-2">
          <span className="text-[0.7rem] font-semibold uppercase tracking-widest text-gray-500">Connection</span>
          <span className={`font-mono text-2xl font-bold tracking-tight capitalize ${status === 'connected' ? 'text-green-600' : 'text-amber-600'}`}>
            {status}
          </span>
        </div>
      </section>

      {/* ── Global Chat ───────────────────────────────────────── */}
      <section className="max-w-[960px] w-full mx-auto px-6 py-12 md:py-16">
        <div className="border-2 border-black flex flex-col bg-white">
          <div className="p-3 px-4 border-b-2 border-black flex justify-between items-center">
            <span className="text-[0.75rem] font-bold uppercase tracking-widest">Global Chat</span>
            <span className="text-[0.75rem] font-bold uppercase tracking-widest">{messages.length} Messages</span>
          </div>
          <div 
            className="h-[400px] overflow-y-auto p-4 flex flex-col gap-3 bg-gray-50 custom-scrollbar" 
            ref={chatBodyRef}
          >
            {messages.length === 0 ? (
              <p className="text-center text-gray-400 mt-36 text-[0.85rem] font-mono">
                No messages yet. Start the conversation!
              </p>
            ) : (
              messages.map((msg) => {
                const isOwn = msg.sender.includes(socketRef.current?.id?.substring(0, 4) || 'NOT_FOUND');
                return (
                  <div 
                    key={msg.id} 
                    className={`max-w-[85%] p-2.5 px-3.5 border text-[0.9rem] leading-relaxed relative ${
                      isOwn 
                        ? 'self-end bg-black text-white border-black' 
                        : 'self-start bg-white text-black border-black'
                    }`}
                  >
                    <span className="text-[0.7rem] font-semibold uppercase tracking-wider mb-1 block">
                      {msg.sender}
                    </span>
                    <p>{msg.text}</p>
                    <span className="text-[0.65rem] mt-1 block opacity-70 font-mono">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })
            )}
          </div>
          <form className="p-3 border-t-2 border-black flex gap-3" onSubmit={sendMessage}>
            <input 
              type="text" 
              className="flex-1 p-3 border-2 border-black font-sans text-[0.9rem] bg-white text-black outline-none focus:bg-gray-50" 
              placeholder="Type your message..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              disabled={status !== "connected"}
            />
            <button 
              type="submit" 
              className="px-6 bg-black text-white font-bold uppercase tracking-widest text-[0.8rem] hover:opacity-80 transition-opacity disabled:bg-gray-400 disabled:cursor-not-allowed"
              disabled={!inputMessage.trim() || status !== "connected"}
            >
              Send
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
