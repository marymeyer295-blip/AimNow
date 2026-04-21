import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, RefreshCcw } from 'lucide-react';

export default function InternalTrainingBot() {
  const [messages, setMessages] = useState<{source: string, message: string}[]>([]);
  const [inputText, setInputText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    
    const userMsg = inputText;
    setMessages(prev => [...prev, { source: 'user', message: userMsg }]);
    setInputText('');
    
    // Simulate thinking state or call internal bot endpoint API
    try {
      const res = await fetch('/api/chatbot/internal/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg })
      });
      const data = await res.json();
      
      setMessages(prev => [...prev, { source: 'ai', message: data.notice || "Internal bot acknowledged." }]);
    } catch (e) {
      setMessages(prev => [...prev, { source: 'ai', message: "Error hitting internal endpoint." }]);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-black/40 rounded-xl border border-white/10 overflow-hidden max-w-4xl mx-auto">
      <div className="p-4 border-b border-white/10 flex justify-between items-center">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-widest">Internal Training Copilot</h2>
          <div className="text-xs text-text-dim mt-1">Test logic without polluting CRM</div>
        </div>
        <button onClick={() => setMessages([])} className="p-2 border border-white/10 rounded-lg hover:bg-white/5 text-text-dim hover:text-white transition-colors">
          <RefreshCcw size={16} />
        </button>
      </div>

      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-text-dim mt-20">Type a message to simulate a conversation.</div>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 max-w-[80%] ${msg.source === 'user' ? 'mr-auto' : 'ml-auto'}`}>
            {msg.source === 'user' && (
               <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                 <User size={14} className="text-white" />
               </div>
            )}
            <div className={`p-4 rounded-xl ${msg.source === 'user' ? 'bg-white/5 border border-white/10 text-white' : 'bg-accent/20 border border-accent/20 text-green-100'}`}>
               <div className="text-sm">{msg.message}</div>
            </div>
            {msg.source === 'ai' && (
               <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                 <Bot size={14} className="text-accent" />
               </div>
            )}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <div className="p-4 border-t border-white/10 bg-black/20">
        <div className="flex items-center gap-2">
          <input 
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Test a scenario..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-accent/50"
          />
          <button onClick={handleSend} className="bg-accent text-black p-3 rounded-lg hover:bg-accent/80 transition-colors">
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
