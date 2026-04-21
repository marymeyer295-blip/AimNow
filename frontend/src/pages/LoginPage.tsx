import { useState, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await api.auth.login({ username, password });
      login(response.user, response.token);
    } catch (err: any) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4">
      <div className="mesh-bg" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="glass-panel rounded-3xl p-8 shadow-2xl">
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center text-accent border border-accent/20 shadow-[0_0_30px_rgba(74,222,128,0.2)]">
              <ShieldCheck size={32} />
            </div>
          </div>
          
          <div className="text-center mb-10">
            <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">AIM Brain Matrix</h1>
            <p className="text-sm text-text-dim">Neutral interface for intelligence calibration</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-[#f0545a]/10 border border-[#f0545a]/20 text-[#f0545a] px-4 py-3 rounded-xl text-sm font-medium">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-dim uppercase tracking-widest ml-1">Secure ID</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="w-full bg-white/5 border border-glass-border rounded-xl px-4 py-3 text-white outline-none focus:border-accent transition-all"
                placeholder="admin"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-text-dim uppercase tracking-widest ml-1">Access Token</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full bg-white/5 border border-glass-border rounded-xl px-4 py-3 text-white outline-none focus:border-accent transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent hover:bg-accent/90 disabled:opacity-50 text-[#0f172a] font-bold py-3 rounded-xl transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : 'Authorize Access'}
            </button>
          </form>

          <div className="mt-10 text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse"></span>
              <span className="text-[10px] text-text-dim font-bold uppercase tracking-widest">Enterprise Shield Active</span>
            </div>
            <p className="text-[10px] text-text-dim uppercase tracking-tighter">
              Admin Matrix Access v4.2 © 2026
            </p>
            <div className="mt-2 text-[10px] text-text-dim/40 italic">
              admin / admin123
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
