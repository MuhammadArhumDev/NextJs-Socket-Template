"use client";

import { useEffect, useRef, useState } from "react";
import { io as socketIO, Socket } from "socket.io-client";
import { 
  Plus, 
  RotateCcw, 
  Users, 
  Activity, 
  Globe, 
  Send, 
  Paperclip, 
  X, 
  FileText,
  ImageIcon,
  ShieldCheck
} from "lucide-react";

type ConnectionStatus = "connecting" | "connected" | "disconnected";


interface CounterEvent {
  count: number;
  timestamp: string;
}

interface ChatMessage {
  id: string;
  text?: string;
  sender: string;
  timestamp: string;
  seenCount?: number;
  file?: {
    name: string;
    type: string;
    data: string; // Base64
  };
}

export default function RealtimeCounter() {
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [count, setCount] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [totalEvents, setTotalEvents] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<{ name: string; type: string; data: string } | null>(null);
  const chatBodyRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setMessages((prev) => [...prev, { ...message, seenCount: 0 }]);
      
      // Emit seen event if it's not our own message
      const ownId = socketRef.current?.id?.substring(0, 4);
      if (!message.sender.includes(ownId || 'NOT_FOUND')) {
        socketRef.current?.emit("chat:seen", { messageId: message.id });
      }
    });

    socket.on("chat:seen:update", (data: { messageId: string }) => {
      setMessages((prev) => 
        prev.map((msg) => 
          msg.id === data.messageId 
            ? { ...msg, seenCount: (msg.seenCount || 0) + 1 } 
            : msg
        )
      );
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const processFile = (file: File) => {
    const bannedExtensions = [".apk", ".exe", ".msi", ".bat", ".cmd", ".sh", ".com", ".bin"];
    const fileExtension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();

    if (bannedExtensions.includes(fileExtension)) {
      alert("Executable files (.apk, .exe, etc.) are not allowed.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target?.result as string;
      setSelectedFile({
        name: file.name,
        type: file.type,
        data: base64Data,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputMessage.trim() && !selectedFile) || !socketRef.current) return;

    socketRef.current.emit("chat:message", {
      text: inputMessage,
      file: selectedFile || undefined,
      sender: `User_${socketRef.current.id?.substring(0, 4)}`,
    });
    
    setInputMessage("");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    // Reset textarea height
    const textarea = (e.target as HTMLFormElement).querySelector('textarea');
    if (textarea) textarea.style.height = '48px';
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
            r<span className="text-black">Chat</span>
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
            className="flex items-center gap-2 px-9 py-3.5 bg-black text-white text-[0.9rem] font-bold uppercase tracking-widest border-2 border-black hover:bg-gray-800 transition-colors active:scale-95 cursor-pointer"
            onClick={increment}
          >
            <Plus size={18} />
            Increment
          </button>
          <button 
            className="flex items-center gap-2 px-9 py-3.5 bg-white text-black text-[0.9rem] font-bold uppercase tracking-widest border-2 border-black hover:bg-gray-100 transition-colors active:scale-95 cursor-pointer"
            onClick={reset}
          >
            <RotateCcw size={18} />
            Reset
          </button>
        </div>
      </section>

      {/* ── Stats row ───────────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-3 border-y-2 border-black w-full">
        <div className="flex flex-col items-center justify-center py-8 px-4 gap-2 border-b-2 sm:border-b-0 sm:border-r-2 border-black">
          <div className="flex items-center gap-2 text-gray-500 uppercase tracking-widest text-[0.7rem] font-semibold">
            <Users size={14} />
            <span>Online Users</span>
          </div>
          <span className="font-mono text-2xl font-bold tracking-tight">{userCount}</span>
        </div>
        <div className="flex flex-col items-center justify-center py-8 px-4 gap-2 border-b-2 sm:border-b-0 sm:border-r-2 border-black">
          <div className="flex items-center gap-2 text-gray-500 uppercase tracking-widest text-[0.7rem] font-semibold">
            <Activity size={14} />
            <span>Events Received</span>
          </div>
          <span className="font-mono text-2xl font-bold tracking-tight">{totalEvents}</span>
        </div>
        <div className="flex flex-col items-center justify-center py-8 px-4 gap-2">
          <div className="flex items-center gap-2 text-gray-500 uppercase tracking-widest text-[0.7rem] font-semibold">
            <Globe size={14} />
            <span>Connection</span>
          </div>
          <span className={`font-mono text-2xl font-bold tracking-tight capitalize ${status === 'connected' ? 'text-green-600' : 'text-amber-600'}`}>
            {status}
          </span>
        </div>
      </section>

      {/* ── Global Chat ───────────────────────────────────────── */}
      <section className="max-w-[960px] w-full mx-auto px-6 py-12 md:py-16">
        <div 
          className="border-2 border-black flex flex-col bg-white transition-colors duration-200 group/chat"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div className="p-3 px-4 border-b-2 border-black flex justify-between items-center bg-white group-drag-over/chat:bg-gray-100 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-[0.75rem] font-bold uppercase tracking-widest">Global Chat</span>
            </div>
            <span className="text-[0.75rem] font-bold uppercase tracking-widest">{messages.length} Messages</span>
          </div>
          <div 
            className="h-[400px] overflow-y-auto p-4 flex flex-col gap-6 bg-gray-50 custom-scrollbar" 
            ref={chatBodyRef}
          >
            {messages.length === 0 ? (
              <p className="text-center text-gray-400 mt-36 text-[0.85rem] font-mono">
                No messages yet. Start the conversation!
              </p>
            ) : (
              messages.map((msg, index) => {
                const isOwn = msg.sender.includes(socketRef.current?.id?.substring(0, 4) || 'NOT_FOUND');
                const prevMsg = messages[index - 1];
                const isSameSender = prevMsg && prevMsg.sender === msg.sender;
                
                return (
                  <div 
                    key={msg.id} 
                    className={`flex flex-col gap-1 max-w-[80%] ${isOwn ? 'self-end' : 'self-start'} ${isSameSender ? '-mt-4' : 'mt-0'}`}
                  >
                    {!isSameSender && (
                      <span className="text-[0.55rem] font-mono font-bold uppercase tracking-widest text-gray-400 px-1 mt-1">
                        {msg.sender}
                      </span>
                    )}
                    <div 
                      className={`p-2.5 px-3.5 border text-[0.9rem] leading-relaxed relative break-words ${
                        isOwn 
                          ? 'bg-black text-white border-black' 
                          : 'bg-white text-black border-black'
                      }`}
                    >
                      {msg.file && (
                        <div className="mb-2">
                          {msg.file.type.startsWith("image/") ? (
                            <div className="relative group">
                              <img src={msg.file.data} alt="Upload" className="max-w-full border border-white/20" />
                              <div className="absolute top-2 left-2 bg-black/50 p-1">
                                <ImageIcon size={14} className="text-white" />
                              </div>
                            </div>
                          ) : (
                            <a href={msg.file.data} download={msg.file.name} className="flex items-center gap-2 underline text-[0.8rem] bg-white/10 p-2 border border-current">
                              <FileText size={16} />
                              <span className="truncate">{msg.file.name}</span>
                            </a>
                          )}
                        </div>
                      )}
                      <p>{msg.text}</p>
                      <div className="flex justify-between items-center mt-2 gap-4">
                        <span className="text-[0.6rem] opacity-70 font-mono">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isOwn && (
                          <span className="text-[0.6rem] font-bold uppercase tracking-tighter opacity-80">
                            Seen by {msg.seenCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {selectedFile && (
            <div className="px-4 py-2 border-t-2 border-black bg-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                <Paperclip size={14} className="shrink-0" />
                <span className="text-[0.7rem] font-mono truncate">
                  {selectedFile.name}
                </span>
              </div>
              <button 
                className="p-1 hover:bg-gray-200 cursor-pointer"
                onClick={() => {
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                <X size={14} className="text-red-600" />
              </button>
            </div>
          )}
          <form 
            className="p-3 border-t-2 border-black flex items-end gap-3 min-h-[72px]" 
            onSubmit={sendMessage}
          >
            <input 
              type="file"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <button 
              type="button"
              className="w-12 h-12 flex items-center justify-center bg-white text-black border-2 border-black hover:bg-gray-100 transition-colors cursor-pointer shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={status !== "connected"}
            >
              <Paperclip size={20} />
            </button>
            <textarea 
              className="flex-1 px-4 py-3 border-2 border-black font-sans text-[0.9rem] bg-white text-black outline-none focus:bg-gray-50 resize-none min-h-[48px] max-h-[120px] custom-scrollbar" 
              placeholder="Type your message..."
              value={inputMessage}
              onChange={(e) => {
                setInputMessage(e.target.value);
                // Auto-expand logic
                e.target.style.height = 'inherit';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(e as any);
                }
              }}
              rows={1}
              disabled={status !== "connected"}
            />
            <button 
              type="submit" 
              className="w-12 h-12 flex items-center justify-center bg-black text-white border-2 border-black hover:bg-gray-800 transition-opacity disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer shrink-0"
              disabled={!inputMessage.trim() && !selectedFile || status !== "connected"}
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
