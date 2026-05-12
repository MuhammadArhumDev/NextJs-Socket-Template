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
  replyTo?: {
    id: string;
    text?: string;
    sender: string;
  };
  isEdited?: boolean;
  isDeleted?: boolean;
}

type ContextMenuState = {
  visible: boolean;
  x: number;
  y: number;
  messageId: string;
} | null;

export default function RealtimeCounter() {
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [count, setCount] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [totalEvents, setTotalEvents] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [locallyDeletedIds, setLocallyDeletedIds] = useState<Set<string>>(new Set());
  const [inputMessage, setInputMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<{ name: string; type: string; data: string } | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const chatBodyRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartX = useRef<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<{ [id: string]: number }>({});

  const visibleMessages = messages.filter(m => !locallyDeletedIds.has(m.id));

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

    socket.on("chat:edit:update", (data: { messageId: string; newText: string }) => {
      setMessages((prev) => 
        prev.map((msg) => 
          msg.id === data.messageId 
            ? { ...msg, text: data.newText, isEdited: true } 
            : msg
        )
      );
    });

    socket.on("chat:delete:update", (data: { messageId: string }) => {
      setMessages((prev) => 
        prev.map((msg) => 
          msg.id === data.messageId 
            ? { ...msg, isDeleted: true, text: undefined, file: undefined } 
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
      textareaRef.current?.focus();
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

  const handleContextMenu = (e: React.MouseEvent, messageId: string) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      messageId
    });
  };

  const handleTouchStart = (e: React.TouchEvent, messageId: string) => {
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    const x = touch.clientX;
    const y = touch.clientY;
    longPressTimer.current = setTimeout(() => {
      setContextMenu({
        visible: true,
        x,
        y,
        messageId
      });
    }, 500);
  };

  const handleTouchMove = (e: React.TouchEvent, messageId: string) => {
    if (touchStartX.current === null) return;
    const touch = e.touches[0];
    const diff = touch.clientX - touchStartX.current;
    
    // Only allow swiping right
    if (diff > 0 && diff < 100) {
      setSwipeOffset(prev => ({ ...prev, [messageId]: diff }));
      if (diff > 20 && longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    }
  };

  const handleTouchEnd = (messageId: string) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    
    if (swipeOffset[messageId] > 60) {
      const msg = messages.find(m => m.id === messageId);
      if (msg && !msg.isDeleted) {
        setReplyTo(msg);
        setEditingMsg(null);
        setTimeout(() => textareaRef.current?.focus(), 50);
      }
    }
    
    setSwipeOffset(prev => ({ ...prev, [messageId]: 0 }));
    touchStartX.current = null;
  };

  const handleAction = (type: 'reply' | 'edit' | 'deleteLocal' | 'deleteAll') => {
    if (!contextMenu) return;
    const msg = messages.find(m => m.id === contextMenu.messageId);
    if (!msg || msg.isDeleted) return;

    if (type === 'reply') {
      setReplyTo(msg);
      setEditingMsg(null);
      setTimeout(() => textareaRef.current?.focus(), 50);
    } else if (type === 'edit') {
      setEditingMsg(msg);
      setInputMessage(msg.text || "");
      setReplyTo(null);
      setTimeout(() => textareaRef.current?.focus(), 50);
    } else if (type === 'deleteLocal') {
      setLocallyDeletedIds(prev => new Set(prev).add(msg.id));
    } else if (type === 'deleteAll') {
      socketRef.current?.emit("chat:delete", { messageId: msg.id });
    }
    setContextMenu(null);
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputMessage.trim() && !selectedFile) || !socketRef.current) return;

    if (editingMsg) {
      socketRef.current.emit("chat:edit", { 
        messageId: editingMsg.id, 
        newText: inputMessage 
      });
      setEditingMsg(null);
    } else {
      socketRef.current.emit("chat:message", {
        text: inputMessage,
        file: selectedFile || undefined,
        sender: `User_${socketRef.current.id?.substring(0, 4)}`,
        replyTo: replyTo ? {
          id: replyTo.id,
          text: replyTo.text,
          sender: replyTo.sender
        } : undefined
      });
    }
    
    setInputMessage("");
    setSelectedFile(null);
    setReplyTo(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

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
      {/* ── Context Menu ───────────────────────────────────────── */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setContextMenu(null)} />
          <div 
            className="fixed z-[70] bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] w-52 py-1"
            style={{ 
              top: contextMenu.y + 150 > (typeof window !== 'undefined' ? window.innerHeight : 0) 
                ? contextMenu.y - 140 
                : contextMenu.y,
              left: contextMenu.x + 208 > (typeof window !== 'undefined' ? window.innerWidth : 0)
                ? contextMenu.x - 208
                : contextMenu.x
            }}
          >
            <button 
              className="w-full flex items-center gap-3 px-4 py-3 text-[0.75rem] font-black uppercase tracking-tight hover:bg-gray-50 border-b border-gray-100 cursor-pointer text-black whitespace-nowrap" 
              onClick={() => handleAction('reply')}
            >
              <Send size={14} className="rotate-[270deg]" /> Reply
            </button>
            <button 
              className="w-full flex items-center gap-3 px-4 py-3 text-[0.75rem] font-black uppercase tracking-tight hover:bg-gray-50 border-b border-gray-100 cursor-pointer text-black whitespace-nowrap" 
              onClick={() => handleAction('deleteLocal')}
            >
              <X size={14} className="text-gray-400" /> Delete for me
            </button>
            {(() => {
              const msg = messages.find(m => m.id === contextMenu.messageId);
              const isOwn = msg?.sender.includes(socketRef.current?.id?.substring(0, 4) || 'NOT_FOUND');
              if (!isOwn) return null;
              
              return (
                <>
                  <button 
                    className="w-full flex items-center gap-3 px-4 py-3 text-[0.75rem] font-black uppercase tracking-tight hover:bg-gray-50 border-b border-gray-100 cursor-pointer text-black whitespace-nowrap" 
                    onClick={() => handleAction('edit')}
                  >
                    <FileText size={14} /> Edit
                  </button>
                  <button 
                    className="w-full flex items-center gap-3 px-4 py-3 text-[0.75rem] font-black uppercase tracking-tight hover:bg-gray-50 text-red-600 cursor-pointer whitespace-nowrap" 
                    onClick={() => handleAction('deleteAll')}
                  >
                    <RotateCcw size={14} /> Delete for all
                  </button>
                </>
              );
            })()}
          </div>
        </>
      )}

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
            {visibleMessages.length === 0 ? (
              <p className="text-center text-gray-400 mt-36 text-[0.85rem] font-mono">
                No messages yet. Start the conversation!
              </p>
            ) : (
              visibleMessages.map((msg, index) => {
                const isOwn = msg.sender.includes(socketRef.current?.id?.substring(0, 4) || 'NOT_FOUND');
                const prevMsg = visibleMessages[index - 1];
                const isSameSender = prevMsg && prevMsg.sender === msg.sender;
                
                return (
                  <div 
                    key={msg.id} 
                    className={`flex flex-col gap-1 max-w-[80%] relative transition-transform duration-75 ${isOwn ? 'self-end' : 'self-start'} ${isSameSender ? '-mt-4' : 'mt-0'}`}
                    onContextMenu={(e) => handleContextMenu(e, msg.id)}
                    onTouchStart={(e) => handleTouchStart(e, msg.id)}
                    onTouchMove={(e) => handleTouchMove(e, msg.id)}
                    onTouchEnd={() => handleTouchEnd(msg.id)}
                    style={{ transform: `translateX(${swipeOffset[msg.id] || 0}px)` }}
                  >
                    {swipeOffset[msg.id] > 20 && (
                      <div className="absolute left-[-40px] top-1/2 -translate-y-1/2 opacity-50">
                        <Send size={20} className="rotate-[270deg]" />
                      </div>
                    )}
                    {!isSameSender && (
                      <span className="text-[0.55rem] font-mono font-bold uppercase tracking-widest text-gray-400 px-1 mt-1">
                        {msg.sender}
                      </span>
                    )}
                    <div 
                      className={`py-2 px-3 border text-[0.85rem] leading-snug relative break-words shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                        isOwn 
                          ? 'bg-black text-white border-black' 
                          : 'bg-white text-black border-black'
                      } ${msg.isDeleted ? 'opacity-50 italic' : ''}`}
                    >
                      {msg.replyTo && !msg.isDeleted && (
                        <div className={`mb-2 p-2 border-l-2 text-[0.7rem] overflow-hidden ${
                          isOwn ? 'bg-white/10 border-white/40 text-white/90' : 'bg-black/5 border-black/20 text-black/80'
                        }`}>
                          <span className="block font-bold mb-0.5 text-[0.55rem] uppercase tracking-wider">{msg.replyTo.sender}</span>
                          <p className="truncate">{msg.replyTo.text || 'File Attachment'}</p>
                        </div>
                      )}
                      {msg.isDeleted ? (
                        <p className="flex items-center gap-2"><RotateCcw size={14} /> This message was deleted</p>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {msg.file && (
                            <div className="mb-1">
                              {msg.file.type.startsWith("image/") ? (
                                <div className="relative group">
                                  <img src={msg.file.data} alt="Upload" className="max-w-full border border-current/20" />
                                  <div className="absolute top-1 left-1 bg-black/50 p-0.5">
                                    <ImageIcon size={12} className="text-white" />
                                  </div>
                                </div>
                              ) : (
                                <a href={msg.file.data} download={msg.file.name} className={`flex items-center gap-2 underline text-[0.75rem] p-1.5 border border-current/20 ${isOwn ? 'bg-white/5' : 'bg-black/5'}`}>
                                  <FileText size={14} />
                                  <span className="truncate max-w-[150px]">{msg.file.name}</span>
                                </a>
                              )}
                            </div>
                          )}
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                        </div>
                      )}
                      <div className="flex justify-between items-center mt-1.5 gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[0.55rem] opacity-60 font-mono">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {msg.isEdited && !msg.isDeleted && <span className="text-[0.55rem] opacity-40 uppercase font-bold tracking-tighter">Edited</span>}
                        </div>
                        {isOwn && !msg.isDeleted && (
                          <span className="text-[0.55rem] font-bold uppercase tracking-tighter opacity-60">
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
          {replyTo && (
            <div className="px-4 py-3 border-t-2 border-black bg-gray-100 flex items-center justify-between">
              <div className="flex flex-col overflow-hidden">
                <span className="text-[0.6rem] font-bold uppercase text-gray-500">Replying to {replyTo.sender}</span>
                <p className="text-[0.8rem] truncate opacity-70">{replyTo.text || 'File attachment'}</p>
              </div>
              <button className="p-1 hover:bg-gray-200 cursor-pointer" onClick={() => setReplyTo(null)}>
                <X size={16} />
              </button>
            </div>
          )}
          {editingMsg && (
            <div className="px-4 py-3 border-t-2 border-black bg-amber-50 flex items-center justify-between">
              <div className="flex flex-col overflow-hidden">
                <span className="text-[0.6rem] font-bold uppercase text-amber-600">Editing Message</span>
                <p className="text-[0.8rem] truncate opacity-70">{editingMsg.text}</p>
              </div>
              <button className="p-1 hover:bg-amber-100 cursor-pointer" onClick={() => {
                setEditingMsg(null);
                setInputMessage("");
              }}>
                <X size={16} />
              </button>
            </div>
          )}
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
              ref={textareaRef}
              className="flex-1 px-4 py-3 border-2 border-black font-sans text-[0.9rem] bg-white text-black outline-none focus:bg-gray-50 resize-none min-h-[48px] max-h-[120px] overflow-hidden custom-scrollbar" 
              placeholder="Type your message..."
              value={inputMessage}
              onChange={(e) => {
                const target = e.target;
                setInputMessage(target.value);
                
                // Auto-expand logic
                target.style.height = '48px'; // Reset to min-height first
                const newHeight = Math.min(target.scrollHeight, 120);
                target.style.height = `${newHeight}px`;
                
                // Only show scroll if we've hit the max height
                target.style.overflowY = target.scrollHeight > 120 ? 'auto' : 'hidden';
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
