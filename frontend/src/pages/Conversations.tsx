import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, AlertCircle } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

export default function Conversations() {
  const [messages, setMessages] = useState<{source: string, message: string, timestamp: Date}[]>([]);
  const [inputText, setInputText] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isTakingOver, setIsTakingOver] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const sessionId = 'DS-1001'; // Mock active session ID for demo

  useEffect(() => {
    // Connect to backend websocket
    const newSocket = io('http://localhost:3000');
    setSocket(newSocket);

    newSocket.on(`chat_update_${sessionId}`, (data) => {
      setMessages((prev) => [...prev, data]);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim() || !socket) return;

    // Send admin override message directly to socket
    socket.emit('admin_reply', {
      sessionId,
      message: inputText
    });

    setInputText('');
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-black/40 rounded-xl border border-white/10 overflow-hidden">
      {/* Session List (Left Pane) */}
      <div className="w-1/3 border-r border-white/10 bg-black/20 flex flex-col">
        <div className="p-4 border-b border-white/10">
          <h2 className="text-sm font-bold text-white uppercase tracking-widest">Active Sessions</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {/* Mock Session Item */}
          <div className="p-4 border-b border-white/5 hover:bg-white/5 cursor-pointer flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
              <User size={18} className="text-accent" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">visitor@example.com</div>
              <div className="text-xs text-text-dim">Session: DS-1001</div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Interface (Right Pane) */}
      <div className="flex-1 flex flex-col relative">
        <div className="p-4 border-b border-white/10 bg-black/20 flex justify-between items-center">
          <div>
            <h2 className="text-sm font-bold text-white">visitor@example.com</h2>
            <div className="text-xs text-accent flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" /> Live
            </div>
          </div>
          <button 
            onClick={() => setIsTakingOver(!isTakingOver)}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
              isTakingOver ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {isTakingOver ? 'Release to AI' : 'Take Over Chat'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-text-dim mt-10 text-sm">Waiting for incoming messages...</div>
          )}
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 max-w-[80%] ${msg.source === 'user' ? 'mr-auto' : 'ml-auto'}`}>
              {msg.source === 'user' && (
                 <div className="w-8 h-8 rounded-full bg-white/10 flex-shrink-0 flex items-center justify-center">
                   <User size={14} className="text-white" />
                 </div>
              )}
              
              <div className={`p-4 rounded-2xl ${
                msg.source === 'admin' ? 'bg-blue-600/30 border border-blue-500/30 text-blue-100' :
                msg.source === 'ai'    ? 'bg-accent/20 border border-accent/20 text-green-100' :
                                         'bg-white/5 border border-white/10 text-white'
              }`}>
                <div className="text-[10px] uppercase font-bold tracking-widest mb-1 opacity-50 flex items-center gap-1">
                  {msg.source === 'ai' ? <Bot size={10} /> : null}
                  {msg.source}
                </div>
                <div className="text-sm">{msg.message}</div>
              </div>

              {msg.source !== 'user' && (
                 <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                    msg.source === 'admin' ? 'bg-blue-600/20' : 'bg-accent/20'
                 }`}>
                   {msg.source === 'admin' ? <AlertCircle size={14} className="text-blue-400" /> : <Bot size={14} className="text-accent" />}
                 </div>
              )}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <div className={`p-4 border-t border-white/10 transition-opacity ${!isTakingOver ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center gap-2">
            <input 
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type message to override AI..."
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-accent/50"
            />
            <button 
              onClick={handleSend}
              className="bg-accent text-black p-3 rounded-lg hover:bg-accent/80 transition-colors"
            >
              <Send size={18} />
            </button>
          </div>
          {!isTakingOver && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/80 text-white text-xs px-4 py-2 rounded-full border border-white/10 shadow-xl backdrop-blur-md">
              Chat is currently driven by AI. Click "Take Over Chat" to intervene.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
