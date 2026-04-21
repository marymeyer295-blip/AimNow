import { useState, useEffect } from 'react';
import { api } from '../api';
import { Table, Badge } from '../components/Table';
import { Loader2, Edit2, X } from 'lucide-react';
import { motion } from 'motion/react';

export default function Thresholds() {
  const [thresholds, setThresholds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const data = await api.scoring.thresholds();
      setThresholds(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getBandType = (band: string) => {
    switch (band) {
      case 'priority': return 'red';
      case 'qualified': return 'green';
      case 'medium': return 'amber';
      case 'low': return 'gray';
      case 'disqualified': return 'red';
      default: return 'gray';
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 grayscale">
      <Loader2 className="animate-spin text-accent mb-4" size={32} />
      <span className="text-[#8b90a8] text-sm tracking-wide uppercase font-semibold">Tuning Priority Thresholds...</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Lead Priority Bands</h2>
          <p className="text-sm text-[#8b90a8] mt-1">Determine routing and SLA based on total lead score</p>
        </div>
      </div>

      <Table headers={['Band', 'Score Range', 'SLA (hrs)', 'Routing Action', 'Actions']}>
        {thresholds.map((t) => (
          <tr key={t.id} className="hover:bg-white/[0.01]">
            <td className="px-6 py-4">
              <Badge type={getBandType(t.band) as any}>{t.band}</Badge>
            </td>
            <td className="px-6 py-4">
              <div className="font-mono text-lg font-bold text-white">
                {t.min_total_score} <span className="text-[#5a5f7a] font-normal mx-1">–</span> {t.max_total_score}
              </div>
            </td>
            <td className="px-6 py-4">
              <div className={`text-sm ${t.sla_hours ? 'text-[#19c9b8] font-semibold' : 'text-[#5a5f7a]'}`}>
                {t.sla_hours || 'N/A'} hrs
              </div>
            </td>
            <td className="px-6 py-4">
              <div className="text-xs text-[#8b90a8] max-w-xs">{t.routing_action}</div>
            </td>
            <td className="px-6 py-4">
              <button 
                onClick={() => setEditing(t)}
                className="p-2 text-[#5a5f7a] hover:text-accent hover:bg-accent/10 rounded-lg transition-all"
              >
                <Edit2 size={14} />
              </button>
            </td>
          </tr>
        ))}
      </Table>

      {editing && (
        <EditThresholdModal 
          threshold={editing} 
          onClose={() => setEditing(null)} 
          onSaved={fetchData} 
        />
      )}
    </div>
  );
}

function EditThresholdModal({ threshold, onClose, onSaved }: { threshold: any, onClose: () => void, onSaved: () => void }) {
  const [formData, setFormData] = useState({ ...threshold });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.scoring.updateThreshold(threshold.id, {
        ...formData,
        min_total_score: parseInt(formData.min_total_score),
        max_total_score: parseInt(formData.max_total_score),
        sla_hours: formData.sla_hours ? parseInt(formData.sla_hours) : null
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
        className="w-full max-w-lg bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="bg-surface border-b border-white/5 p-6 flex justify-between items-center">
          <h2 className="text-lg font-bold text-white tracking-tight">Edit Priority Gate: {threshold.band?.toUpperCase()}</h2>
          <button onClick={onClose} className="text-[#5a5f7a] hover:text-white transition-all">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#5a5f7a] uppercase tracking-wider ml-1">Min Score</label>
              <input 
                type="number"
                value={formData.min_total_score} 
                onChange={e => setFormData({ ...formData, min_total_score: e.target.value })}
                className="w-full bg-bg border border-white/5 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-accent"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#5a5f7a] uppercase tracking-wider ml-1">Max Score</label>
              <input 
                type="number"
                value={formData.max_total_score} 
                onChange={e => setFormData({ ...formData, max_total_score: e.target.value })}
                className="w-full bg-bg border border-white/5 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#5a5f7a] uppercase tracking-wider ml-1">SLA Hours (optional)</label>
            <input 
              type="number"
              value={formData.sla_hours || ''} 
              onChange={e => setFormData({ ...formData, sla_hours: e.target.value })}
              className="w-full bg-bg border border-white/5 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-accent"
              placeholder="e.g. 24"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#5a5f7a] uppercase tracking-wider ml-1">Routing Action</label>
            <textarea 
              value={formData.routing_action} 
              onChange={e => setFormData({ ...formData, routing_action: e.target.value })}
              className="w-full bg-bg border border-white/5 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-accent min-h-[80px]"
            />
          </div>
        </div>

        <div className="bg-surface/80 backdrop-blur-md border-t border-white/5 p-6 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2 rounded-xl text-sm font-medium text-[#8b90a8] hover:bg-white/5 transition-all">Cancel</button>
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="px-6 py-2 bg-accent hover:bg-accent-dark text-white rounded-xl text-sm font-bold shadow-lg shadow-accent/20 transition-all font-mono"
          >
            {saving ? 'UPDATING...' : 'PATCH BAND'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
