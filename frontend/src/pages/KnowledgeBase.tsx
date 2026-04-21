import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { api } from '../api';
import { 
  Database, 
  Send, 
  MessageSquare, 
  Upload, 
  Search, 
  CheckCircle2, 
  Loader2, 
  AlertTriangle,
  Download,
  Terminal,
  BrainCircuit,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const SYSTEM_INSTRUCTION = `
# AIM Knowledge Assistant Prompt

You are a knowledge assistant for AIM (Avenue Inside Marketing). Use the provided knowledge base snippets to answer the user's question.

## Guidelines

- Answer **only** using the facts from the provided knowledge snippets
- **Keep answers short and concise** — aim for 1-3 sentences maximum
- Do not hallucinate or add information not in the snippets
- If the answer is not found, say exactly: "I don't have enough information to answer that."
- Use bullet points only when absolutely necessary
- Prioritize the most relevant information

## Response Format

- Start with the direct answer immediately
- Add minimal context if needed
- Avoid lengthy explanations
`;

export default function KnowledgeBase() {
  const [activeTab, setActiveTab] = useState<'ingest' | 'chat'>('ingest');
  const [qdrantStatus, setQdrantStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    try {
      const status = await api.qdrant.getHealth();
      setQdrantStatus(status);
    } catch (e) {
      setQdrantStatus({ ok: false, status: 'disconnected', error: 'Could not connect to Qdrant' });
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">AIM Entity Brain</h2>
          <p className="text-sm text-text-dim mt-1">Semantic knowledge base and RAG-powered intelligence assistant.</p>
        </div>
        
        <div className={`px-4 py-2 rounded-xl border flex items-center gap-2 transition-all ${
          qdrantStatus?.ok ? 'bg-accent/10 border-accent/20 text-accent' : 'bg-[#f0545a]/10 border-[#f0545a]/20 text-[#f0545a]'
        }`}>
          <div className={`w-2 h-2 rounded-full ${qdrantStatus?.ok ? 'bg-accent shadow-[0_0_8px_rgba(74,222,128,0.5)]' : 'bg-[#f0545a]'}`} />
          <span className="text-[10px] font-bold uppercase tracking-widest">
            Qdrant: {qdrantStatus?.ok ? `Connected (${qdrantStatus.points} points)` : 'Disconnected'}
          </span>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-white/5 rounded-2xl w-fit border border-white/5">
        <button
          onClick={() => setActiveTab('ingest')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'ingest' ? 'bg-white/10 text-white shadow-lg' : 'text-text-dim hover:text-white'
          }`}
        >
          <Database size={14} />
          <span>Vector Ingestion</span>
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'chat' ? 'bg-white/10 text-white shadow-lg' : 'text-text-dim hover:text-white'
          }`}
        >
          <MessageSquare size={14} />
          <span>Brain Chat</span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'ingest' ? (
          <motion.div
            key="ingest"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            <div className="lg:col-span-2 space-y-6">
              <IngestionPanel onIncomplete={checkHealth} />
            </div>
            <div className="space-y-6">
              <div className="glass-panel p-6 rounded-3xl border border-glass-border">
                <h3 className="text-[10px] font-bold text-text-dim uppercase tracking-[0.2em] mb-4">Pipeline Logic</h3>
                <ul className="space-y-4">
                  <li className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-accent/10 text-accent flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold">01</span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Semantic Extraction</div>
                      <div className="text-[10px] text-text-dim mt-1">Input JSON chunks from the Chunker pipeline.</div>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold">02</span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Local Embeddings</div>
                      <div className="text-[10px] text-text-dim mt-1">Local Xenova transformer generates 768d vectors.</div>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <div className="w-6 h-6 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold">03</span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Vector Upsert</div>
                      <div className="text-[10px] text-text-dim mt-1">Chunks stored in Qdrant with semantic payloads.</div>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <ChatPanel />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function IngestionPanel({ onIncomplete }: { onIncomplete: () => void }) {
  const [jsonInput, setJsonInput] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setJsonInput(text);
      };
      reader.readAsText(file);
    }
  };

  const executeIngest = async () => {
    try {
      const data = JSON.parse(jsonInput);
      const chunks = Array.isArray(data) ? data : (data.qdrant_chunks || []);
      
      if (chunks.length === 0) throw new Error("No qdrant_chunks found in JSON");

      setIngesting(true);
      setError('');
      
      const res = await api.qdrant.ingest(chunks);
      setStats(res);
      onIncomplete();
    } catch (e: any) {
      setError(e.message || "Invalid JSON format");
    } finally {
      setIngesting(false);
    }
  };

  return (
    <div className="glass-panel p-8 rounded-3xl border border-glass-border">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-accent/10 rounded-lg text-accent border border-accent/20">
            <Upload size={20} />
          </div>
          <h3 className="text-lg font-bold text-white uppercase tracking-widest text-[12px]">Vector Data Ingestion</h3>
        </div>
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="text-xs font-bold text-accent uppercase tracking-widest hover:underline flex items-center gap-2"
        >
          <Download size={14} />
          Import Chunker File
        </button>
        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".json" className="hidden" />
      </div>

      <div className="relative group">
        <div className="absolute top-4 right-4 flex gap-2">
          <button 
            onClick={() => setJsonInput('')}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-text-dim hover:text-white transition-all"
          >
            <Trash2 size={14} />
          </button>
        </div>
        <textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder="Paste qdrant_chunks.json payload here..."
          className="w-full h-80 bg-black/30 border border-white/5 rounded-2xl p-6 text-sm font-mono text-white custom-scrollbar focus:border-accent/30 outline-none transition-all"
        />
      </div>

      {error && (
        <div className="mt-4 p-4 bg-[#f0545a]/10 border border-[#f0545a]/20 text-[#f0545a] rounded-xl text-xs flex items-center gap-3">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}

      {stats && (
        <div className="mt-4 p-4 bg-accent/5 border border-accent/10 text-accent rounded-xl text-xs flex items-center gap-3">
          <CheckCircle2 size={14} />
          Successfully ingested {stats.count} vectors into the brain.
        </div>
      )}

      <button
        onClick={executeIngest}
        disabled={!jsonInput || ingesting}
        className="w-full mt-8 bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed text-[#0f172a] font-bold py-4 rounded-xl transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
      >
        {ingesting ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            <span>Generating Local Embeddings...</span>
          </>
        ) : (
          <>
            <Terminal size={18} />
            <span>Process & Transmit to Qdrant</span>
          </>
        )}
      </button>
    </div>
  );
}

type Message = { role: 'user' | 'assistant'; content: string; sources?: any[] };

function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // 1. Vector Search
      const searchResponse = await api.qdrant.search(userMsg.content);
      const sources = searchResponse.results;

      // 2. LLM Completion via backend
      const context = sources.map((r: any, i: number) => {
        const p = r.payload;
        return `[S${i+1}] Source: ${p.source} | Section: ${p.section}\n${p.content}`;
      }).join('\n\n');

      const prompt = `Question: ${userMsg.content}\n\nKnowledge Context:\n${context}`;

      const llmResponse = await api.llm.complete(prompt, SYSTEM_INSTRUCTION);

      const assistantMsg: Message = { 
        role: 'assistant', 
        content: llmResponse.content || "I don't have enough information to answer that.",
        sources: sources
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Error connecting to the brain: " + e.message }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel h-[600px] flex flex-col rounded-3xl border border-glass-border overflow-hidden">
      <div className="px-6 py-4 border-bottom border-white/5 bg-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-accent/10 rounded-lg text-accent border border-accent/20">
            <BrainCircuit size={18} />
          </div>
          <span className="text-sm font-bold text-white uppercase tracking-widest text-[11px]">Brain Insight Assistant</span>
        </div>
        <button onClick={() => setMessages([])} className="text-[10px] font-bold text-text-dim hover:text-white uppercase tracking-widest">Reset Thread</button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4 border border-accent/20 text-accent">
              <MessageSquare size={32} />
            </div>
            <h4 className="text-white font-bold text-sm mb-1 uppercase tracking-widest">Conversation Hub</h4>
            <p className="text-[11px] text-text-dim max-w-xs">Query the ingested semantic knowledge base. Ask about fit logic, objectives, or service inclusions.</p>
          </div>
        )}
        
        {messages.map((msg, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[80%] space-y-2`}>
              <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-accent text-[#0f172a] font-semibold' 
                  : 'bg-white/10 text-white border border-white/5'
              }`}>
                {msg.content}
              </div>
              
              {msg.sources && msg.sources.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {msg.sources.map((s: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-1.5 px-2 py-1 bg-white/5 border border-white/5 rounded-lg text-[9px] font-bold text-text-dim uppercase tracking-widest cursor-default hover:border-accent/30 transition-all">
                      <Terminal size={10} />
                      S{idx+1}: {s.payload.section}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/10 p-4 rounded-2xl flex items-center gap-3">
              <div className="flex gap-1">
                <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 rounded-full bg-accent" />
                <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 rounded-full bg-accent" />
                <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 rounded-full bg-accent" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-6 border-t border-white/5 bg-black/20">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask anything about the knowledge base..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-6 pr-14 text-sm text-white focus:border-accent/30 outline-none transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="absolute right-2 top-2 bottom-2 px-4 bg-accent hover:bg-accent/90 disabled:opacity-50 text-[#0f172a] rounded-xl transition-all shadow-lg shadow-accent/20"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
