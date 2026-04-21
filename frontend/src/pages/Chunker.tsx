import { useState, useRef, ChangeEvent } from 'react';
import { api } from '../api';
import { 
  Upload, 
  FileText, 
  FileJson, 
  Database, 
  CheckCircle2, 
  Loader2, 
  Download, 
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Chunker() {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<any | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const processFiles = async () => {
    if (files.length === 0) return;
    setProcessing(true);
    setError('');
    setResults(null);

    try {
      const response = await api.chunker.process(files);
      setResults(response);
    } catch (err: any) {
      setError(err.message || 'Processing failed');
    } finally {
      setProcessing(false);
    }
  };

  const downloadJson = (data: any, name: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 pb-20">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Intelligence Chunking Pipeline</h2>
        <p className="text-sm text-text-dim mt-2">Convert unstructured documentation PDF, Word, and Excel into matrix-ready JSON nodes.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload Section */}
        <div className="space-y-6">
          <div className="glass-panel p-8 rounded-3xl border border-glass-border">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-accent/10 rounded-lg text-accent border border-accent/20">
                <Upload size={20} />
              </div>
              <h3 className="text-lg font-bold text-white uppercase tracking-widest text-[12px]">Upload Source Documents</h3>
            </div>

            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-glass-border rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer hover:border-accent hover:bg-accent/5 transition-all group"
            >
              <FileText className="text-text-dim group-hover:text-accent group-hover:scale-110 transition-all mb-4" size={48} />
              <p className="text-white font-bold mb-1">Click to browse or drag and drop</p>
              <p className="text-xs text-text-dim uppercase tracking-wider">PDF, DOCX, XLSX (Max 10MB per file)</p>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                multiple 
                accept=".docx,.pdf,.xlsx,.xls,.txt"
                className="hidden" 
              />
            </div>

            <AnimatePresence>
              {files.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 space-y-2"
                >
                  <div className="flex justify-between items-center mb-2 px-1">
                    <span className="text-[10px] font-bold text-text-dim uppercase tracking-widest">Selected Entities: {files.length}</span>
                    <button onClick={() => setFiles([])} className="text-[10px] font-bold text-[#f0545a] uppercase tracking-widest hover:underline">Clear All</button>
                  </div>
                  {files.map((file, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-xl group hover:border-glass-border">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileText size={16} className="text-accent shrink-0" />
                        <span className="text-sm text-white truncate">{file.name}</span>
                        <span className="text-[10px] text-text-dim font-mono">{(file.size / 1024).toFixed(0)} KB</span>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeFile(i); }} 
                        className="p-1.5 text-text-dim hover:text-[#f0545a] hover:bg-[#f0545a]/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={processFiles}
              disabled={files.length === 0 || processing}
              className="w-full mt-8 bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed text-[#0f172a] font-bold py-4 rounded-xl transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
            >
              {processing ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Calibrating Neural Chunks...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  <span>Execute Pipeline Extraction</span>
                </>
              )}
            </button>
          </div>

          {error && (
            <div className="bg-[#f0545a]/10 border border-[#f0545a]/20 text-[#f0545a] p-4 rounded-2xl flex items-center gap-3 text-sm">
              <AlertTriangle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Results Section */}
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {!results ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full min-h-[400px] border border-glass-border rounded-3xl border-dashed flex flex-col items-center justify-center text-center p-8 text-text-dim"
              >
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/5">
                  <Database size={32} strokeWidth={1.5} />
                </div>
                <h4 className="text-lg font-bold text-white mb-2 uppercase tracking-widest text-[14px]">Pipeline Idle</h4>
                <p className="max-w-xs text-xs tracking-wide">Upload documentation to begin the semantic extraction and structural mapping process.</p>
              </motion.div>
            ) : (
              <motion.div 
                key="results"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div className="glass-panel p-8 rounded-3xl border border-glass-border">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 border border-blue-500/20">
                      <FileJson size={20} />
                    </div>
                    <h3 className="text-lg font-bold text-white uppercase tracking-widest text-[12px]">Extraction Summary</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="p-6 bg-white/5 border border-white/5 rounded-2xl">
                      <div className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em] mb-3">Qdrant Chunks</div>
                      <div className="text-3xl font-bold text-white flex items-baseline gap-1">
                        {results.summary.qdrantCount}
                        <span className="text-[10px] text-text-dim uppercase font-bold">nodes</span>
                      </div>
                    </div>
                    <div className="p-6 bg-white/5 border border-white/5 rounded-2xl">
                      <div className="text-[10px] font-bold text-purple-400 uppercase tracking-[0.2em] mb-3">Postgres Rows</div>
                      <div className="text-3xl font-bold text-white flex items-baseline gap-1">
                        {results.summary.postgresCount}
                        <span className="text-[10px] text-text-dim uppercase font-bold">fields</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl group hover:border-blue-500/30 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                          <FileJson size={20} />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">qdrant_chunks.json</div>
                          <div className="text-[10px] text-text-dim uppercase tracking-widest">Semantic & Pitching Knowledge</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => downloadJson(results.qdrant_chunks, 'qdrant_chunks.json')}
                        className="p-3 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded-xl transition-all shadow-lg shadow-blue-500/10"
                      >
                        <Download size={18} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl group hover:border-purple-500/30 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.1)]">
                          <Database size={20} />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">postgres_seed.json</div>
                          <div className="text-[10px] text-text-dim uppercase tracking-widest">Structural Scoring & Logic</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => downloadJson(results.postgres_seed, 'postgres_seed.json')}
                        className="p-3 bg-purple-500/10 text-purple-400 hover:bg-purple-500 hover:text-white rounded-xl transition-all shadow-lg shadow-purple-500/10"
                      >
                        <Download size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-8 p-4 bg-accent/5 rounded-2xl border border-accent/10">
                    <div className="flex items-center gap-3 text-accent text-xs font-bold uppercase tracking-widest">
                      <CheckCircle2 size={16} />
                      <span>Calibration Complete</span>
                    </div>
                    <p className="text-[11px] text-text-dim mt-2 leading-relaxed">
                      All files processed successfully. Chunks have been classified based on semantic richness and structural density. Ready for database injection.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
