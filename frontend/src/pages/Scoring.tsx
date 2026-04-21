import { useState, useEffect } from 'react';
import { api } from '../api';
import { Table, Badge } from '../components/Table';
import { Loader2, Edit2, X } from 'lucide-react';
import { motion } from 'motion/react';

export default function Scoring() {
  const [components, setComponents] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [c, r] = await Promise.all([api.scoring.components(), api.scoring.rules()]);
      setComponents(c);
      setRules(r);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 grayscale">
      <Loader2 className="animate-spin text-[#f5a623] mb-4" size={32} />
      <span className="text-[#8b90a8] text-sm tracking-wide uppercase font-semibold">Calibrating Scoring Matrices...</span>
    </div>
  );

  return (
    <div className="space-y-12">
      {components.map(comp => {
        const compRules = rules.filter(r => r.component_code === comp.component_code);
        const activeSum = compRules.filter(r => r.active && !r.is_deduction).reduce((acc, curr) => acc + curr.points, 0);

        return (
          <div key={comp.id} className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-bold text-white tracking-widest uppercase">{comp.component_name}</h3>
                <Badge type="blue">Max: {comp.max_points} pts</Badge>
                <Badge type="gray">Active: {activeSum}</Badge>
              </div>
            </div>

            <Table headers={['Rule', 'Condition', 'Points', 'Type', 'Active', 'Actions']}>
              {compRules.map(rule => (
                <tr key={rule.id} className="hover:bg-white/[0.01]">
                  <td className="px-6 py-4 font-medium text-[#e8eaf0]">{rule.rule_label}</td>
                  <td className="px-6 py-4 text-xs text-[#8b90a8] max-w-xs truncate">{rule.condition_text}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                       <div className="flex-1 h-1.5 w-20 bg-bg rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${rule.points > 0 ? 'bg-[#22c97b]' : 'bg-[#f0545a]'}`} 
                            style={{ width: `${Math.min(100, (Math.abs(rule.points) / 15) * 100)}%` }}
                          />
                       </div>
                       <span className={`text-xs font-bold font-mono ${rule.points > 0 ? 'text-[#22c97b]' : 'text-[#f0545a]'}`}>
                        {rule.points > 0 ? '+' : ''}{rule.points}
                       </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge type={rule.is_deduction ? 'red' : 'green'}>{rule.is_deduction ? 'Deduction' : 'Award'}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={rule.active} 
                        onChange={async (e) => {
                          await api.scoring.updateRule(rule.id, { ...rule, active: e.target.checked });
                          fetchData();
                        }}
                        className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-white/5 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#5a5f7a] after:border-white/5 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent/40 peer-checked:after:bg-accent"></div>
                    </label>
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => setEditingRule(rule)}
                      className="p-2 text-[#5a5f7a] hover:text-accent hover:bg-accent/10 rounded-lg transition-all"
                    >
                      <Edit2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </Table>
          </div>
        );
      })}

      {editingRule && (
        <EditRuleModal 
          rule={editingRule} 
          onClose={() => setEditingRule(null)} 
          onSaved={fetchData} 
        />
      )}
    </div>
  );
}

function EditRuleModal({ rule, onClose, onSaved }: { rule: any, onClose: () => void, onSaved: () => void }) {
  const [formData, setFormData] = useState({ ...rule });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.scoring.updateRule(rule.id, formData);
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
          <h2 className="text-lg font-bold text-white tracking-tight">Edit Scoring Rule</h2>
          <button onClick={onClose} className="text-[#5a5f7a] hover:text-white transition-all">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#5a5f7a] uppercase tracking-wider ml-1">Rule Label</label>
            <input 
              value={formData.rule_label} 
              onChange={e => setFormData({ ...formData, rule_label: e.target.value })}
              className="w-full bg-bg border border-white/5 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-accent"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#5a5f7a] uppercase tracking-wider ml-1">Condition Text</label>
            <textarea 
              value={formData.condition_text} 
              onChange={e => setFormData({ ...formData, condition_text: e.target.value })}
              className="w-full bg-bg border border-white/5 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-accent min-h-[100px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#5a5f7a] uppercase tracking-wider ml-1">Points</label>
              <input 
                type="number"
                value={formData.points} 
                onChange={e => setFormData({ ...formData, points: parseInt(e.target.value) })}
                className="w-full bg-bg border border-white/5 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-accent"
              />
            </div>
            <div className="flex flex-col justify-end pb-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={formData.is_deduction}
                  onChange={e => setFormData({ ...formData, is_deduction: e.target.checked })}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded border transition-all flex items-center justify-center ${formData.is_deduction ? 'bg-[#f0545a] border-[#f0545a] text-white' : 'border-[#5a5f7a] hover:border-[#f0545a]'}`}>
                  {formData.is_deduction && <X size={14} className="rotate-45" />}
                </div>
                <span className="text-sm text-[#8b90a8] group-hover:text-white transition-all">Is Deduction?</span>
              </label>
            </div>
          </div>
        </div>

        <div className="bg-surface/80 backdrop-blur-md border-t border-white/5 p-6 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2 rounded-xl text-sm font-medium text-[#8b90a8] hover:bg-white/5 transition-all">Cancel</button>
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="px-6 py-2 bg-[#f5a623] hover:bg-[#d88d1d] text-white rounded-xl text-sm font-bold shadow-lg shadow-[#f5a623]/20 transition-all"
          >
            {saving ? 'Saving...' : 'Update Scorer'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
