import { useState, useEffect } from 'react';
import { api } from '../api';
import { Badge } from '../components/Table';
import { Loader2, Edit2, X, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Playbooks() {
  const [playbooks, setPlaybooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);

  useEffect(() => {
    fetchPlaybooks();
  }, []);

  const fetchPlaybooks = async () => {
    try {
      const data = await api.playbooks.list();
      setPlaybooks(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 grayscale">
      <Loader2 className="animate-spin text-[#19c9b8] mb-4" size={32} />
      <span className="text-[#8b90a8] text-sm tracking-wide uppercase font-semibold">Indexing Industry Playbooks...</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {playbooks.map(p => (
          <div key={p.id} className="bg-surface border border-white/5 rounded-2xl overflow-hidden shadow-sm hover:border-accent/20 transition-all flex flex-col">
            <div className="p-6 border-b border-white/5 bg-white/[0.01] flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">{p.industry_name}</h3>
                <code className="text-xs text-accent/70 font-mono tracking-wider">{p.industry_code}</code>
              </div>
              <div className="flex items-center gap-3">
                <Badge type={p.status === 'active' ? 'green' : 'gray'}>{p.status}</Badge>
                <button 
                  onClick={() => setEditing(p)}
                  className="p-2 text-[#5a5f7a] hover:text-accent hover:bg-accent/10 rounded-lg transition-all"
                >
                  <Edit2 size={16} />
                </button>
              </div>
            </div>

            <div className="p-6 grid grid-cols-2 gap-8 flex-1">
              <div className="space-y-4">
                <div>
                  <div className="text-[10px] font-bold text-[#5a5f7a] uppercase tracking-widest mb-2">Sensitivity Matrix</div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#8b90a8]">Trust</span>
                      <span className="text-white font-medium capitalize">{p.trust_sensitivity}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#8b90a8]">Environment</span>
                      <span className="text-white font-medium capitalize">{p.environment_sensitivity}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-[#5a5f7a] uppercase tracking-widest mb-2">Bias Approach</div>
                  <div className="text-xs text-accent font-semibold flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(108,124,255,0.5)]"></div>
                    {p.scale_vs_precision?.replace(/_/g, ' ')}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-[10px] font-bold text-[#5a5f7a] uppercase tracking-widest mb-2">Key Risk Flags</div>
                  <div className="flex flex-wrap gap-1.2">
                    {(p.key_risk_flags || []).map((f: string) => (
                      <span key={f} className="text-[10px] px-2 py-0.5 bg-[#f0545a]/10 text-[#f0545a] border border-[#f0545a]/20 rounded-full font-medium mb-1 mr-1">
                        {f.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-[#5a5f7a] uppercase tracking-widest mb-2">Buyer Personas</div>
                  <div className="flex flex-wrap gap-1">
                    {(p.buyer_personas || []).map((b: string) => (
                      <span key={b} className="text-[10px] px-2 py-0.5 bg-white/5 text-[#8b90a8] border border-white/10 rounded-full font-medium mb-1 mr-1">
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-white/[0.01] border-t border-white/5">
              <div className="text-[10px] font-bold text-[#5a5f7a] uppercase tracking-widest mb-2">Recommendation Bias</div>
              <div className="text-xs text-[#8b90a8] italic line-clamp-2 leading-relaxed">"{p.default_recommendation_bias}"</div>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {editing && (
          <EditPlaybookModal 
            playbook={editing} 
            onClose={() => setEditing(null)} 
            onSaved={fetchPlaybooks} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function EditPlaybookModal({ playbook, onClose, onSaved }: { playbook: any, onClose: () => void, onSaved: () => void }) {
  const [formData, setFormData] = useState({ 
    ...playbook,
    buyer_personas: (playbook.buyer_personas || []).join(', '),
    strongest_objectives: (playbook.strongest_objectives || []).join(', '),
    key_risk_flags: (playbook.key_risk_flags || []).join(', ')
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.playbooks.update(playbook.id, {
        ...formData,
        buyer_personas: formData.buyer_personas.split(',').map((x:any)=>x.trim()).filter(Boolean),
        strongest_objectives: formData.strongest_objectives.split(',').map((x:any)=>x.trim()).filter(Boolean),
        key_risk_flags: formData.key_risk_flags.split(',').map((x:any)=>x.trim()).filter(Boolean),
      });
      onSaved();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-2xl bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="bg-surface border-b border-white/5 p-6 flex justify-between items-center">
          <h2 className="text-lg font-bold text-white tracking-tight">Logic Playbook: {playbook.industry_name}</h2>
          <button onClick={onClose} className="text-[#5a5f7a] hover:text-white transition-all">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#5a5f7a] uppercase tracking-wider ml-1">Recommendation Bias</label>
            <textarea 
              value={formData.default_recommendation_bias} 
              onChange={e => setFormData({ ...formData, default_recommendation_bias: e.target.value })}
              className="w-full bg-bg border border-white/5 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-accent min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#5a5f7a] uppercase tracking-wider ml-1">Trust Sensitivity</label>
              <select 
                value={formData.trust_sensitivity} 
                onChange={e => setFormData({ ...formData, trust_sensitivity: e.target.value })}
                className="w-full bg-bg border border-white/5 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-accent"
              >
                {['high', 'medium', 'low'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#5a5f7a] uppercase tracking-wider ml-1">Environment Sensitivity</label>
              <select 
                value={formData.environment_sensitivity} 
                onChange={e => setFormData({ ...formData, environment_sensitivity: e.target.value })}
                className="w-full bg-bg border border-white/5 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-accent"
              >
                {['high', 'medium', 'low'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#5a5f7a] uppercase tracking-wider ml-1">Bias Approach</label>
              <select 
                value={formData.scale_vs_precision} 
                onChange={e => setFormData({ ...formData, scale_vs_precision: e.target.value })}
                className="w-full bg-bg border border-white/5 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-accent"
              >
                {['scale_first', 'precision_first', 'context_dependent'].map(v => (
                  <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#5a5f7a] uppercase tracking-wider ml-1">Status</label>
              <select 
                value={formData.status} 
                onChange={e => setFormData({ ...formData, status: e.target.value })}
                className="w-full bg-bg border border-white/5 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-accent"
              >
                {['active', 'draft', 'archived'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#5a5f7a] uppercase tracking-wider ml-1">Buyer Personas (comma-separated)</label>
            <input 
              value={formData.buyer_personas} 
              onChange={e => setFormData({ ...formData, buyer_personas: e.target.value })}
              className="w-full bg-bg border border-white/5 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-accent"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#5a5f7a] uppercase tracking-wider ml-1">Key Risk Flags (comma-separated)</label>
            <input 
              value={formData.key_risk_flags} 
              onChange={e => setFormData({ ...formData, key_risk_flags: e.target.value })}
              className="w-full bg-bg border border-white/5 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-accent"
            />
          </div>
        </div>

        <div className="bg-surface/80 backdrop-blur-md border-t border-white/5 p-6 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-6 py-2 rounded-xl text-sm font-medium text-[#8b90a8] hover:bg-white/5 transition-all">Cancel</button>
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="px-6 py-2 bg-[#19c9b8] hover:bg-[#159e91] text-white rounded-xl text-sm font-bold shadow-lg shadow-[#19c9b8]/20 transition-all"
          >
            {saving ? 'Saving...' : 'Patch Playbook'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
