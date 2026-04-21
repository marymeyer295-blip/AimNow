import { useState, useEffect } from 'react';
import { api } from '../api';
import { Table, Badge } from '../components/Table';
import { Loader2, Edit2, X, Search } from 'lucide-react';
import { motion } from 'motion/react';

export default function Rankings() {
  const [rankings, setRankings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const data = await api.rankings.list();
      setRankings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = rankings.filter(r => 
    (r.service_code || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.industry_code || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.tier || '').toLowerCase().includes(search.toLowerCase())
  );

  const getTierType = (tier: string) => {
    switch (tier) {
      case 'Tier1': return 'green';
      case 'Tier2': return 'blue';
      case 'Tier3': return 'amber';
      case 'Tier4': return 'red';
      case 'Avoid': return 'red';
      default: return 'gray';
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 grayscale">
      <Loader2 className="animate-spin text-accent mb-4" size={32} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Service–Industry Rankings</h2>
          <p className="text-sm text-[#8b90a8] mt-1">Cross-matrix optimization of Tiers and Relevancy</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5f7a]" size={16} />
          <input 
            type="text" 
            placeholder="Search code, tier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64 bg-surface border border-white/5 rounded-xl pl-10 pr-4 py-2 text-sm text-white outline-none focus:border-accent"
          />
        </div>
      </div>

      <Table headers={['Service', 'Industry', 'Tier', 'Reason', 'Active', 'Actions']}>
        {filtered.map((r) => (
          <tr key={r.id} className="hover:bg-white/[0.01]">
            <td className="px-6 py-4"><code className="text-teal-400 font-mono text-xs">{r.service_code}</code></td>
            <td className="px-6 py-4"><code className="text-purple-400 font-mono text-xs">{r.industry_code}</code></td>
            <td className="px-6 py-4"><Badge type={getTierType(r.tier) as any}>{r.tier}</Badge></td>
            <td className="px-6 py-4 text-xs text-[#8b90a8] max-w-xs truncate">{r.reason}</td>
            <td className="px-6 py-4">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={r.active} onChange={async (e) => {
                  await api.rankings.update(r.id, { ...r, active: e.target.checked });
                  fetchData();
                }} className="sr-only peer" />
                <div className="w-9 h-5 bg-white/5 rounded-full peer peer-checked:bg-accent/40 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#5a5f7a] after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full peer-checked:after:bg-accent"></div>
              </label>
            </td>
            <td className="px-6 py-4">
              <button 
                onClick={() => setEditing(r)}
                className="p-2 text-[#5a5f7a] hover:text-accent hover:bg-accent/10 rounded-lg transition-all"
              >
                <Edit2 size={14} />
              </button>
            </td>
          </tr>
        ))}
      </Table>

      {editing && (
        <EditModal 
          item={editing} 
          onClose={() => setEditing(null)} 
          onSaved={fetchData} 
        />
      )}
    </div>
  );
}

function EditModal({ item, onClose, onSaved }: { item: any, onClose: () => void, onSaved: () => void }) {
  const [formData, setFormData] = useState({ ...item });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.rankings.update(item.id, formData);
      onSaved();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm focus-within:outline-none">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg bg-surface border border-white/10 rounded-2xl shadow-2xl p-6 space-y-6">
        <h2 className="text-lg font-bold text-white tracking-tight">Edit Ranking</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5 opacity-50"><label className="text-xs font-bold text-[#5a5f7a] uppercase">Service</label><input value={item.service_code} disabled className="w-full bg-bg border border-white/5 rounded-xl px-4 py-2 text-sm text-white" /></div>
          <div className="space-y-1.5 opacity-50"><label className="text-xs font-bold text-[#5a5f7a] uppercase">Industry</label><input value={item.industry_code} disabled className="w-full bg-bg border border-white/5 rounded-xl px-4 py-2 text-sm text-white" /></div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#5a5f7a] uppercase tracking-wider ml-1">Tier</label>
          <select value={formData.tier} onChange={e => setFormData({ ...formData, tier: e.target.value })} className="w-full bg-bg border border-white/5 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-accent">
            {['Tier1', 'Tier2', 'Tier3', 'Tier4', 'Avoid'].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#5a5f7a] uppercase tracking-wider ml-1">Reason / Context</label>
          <textarea value={formData.reason || ''} onChange={e => setFormData({ ...formData, reason: e.target.value })} className="w-full bg-bg border border-white/5 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-accent min-h-[100px]" />
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
          <button onClick={onClose} className="px-6 py-2 text-[#8b90a8] hover:bg-white/5 rounded-xl transition-all">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-accent hover:bg-accent-dark text-white rounded-xl text-sm font-bold shadow-lg shadow-accent/20 transition-all font-mono">
            {saving ? 'UPDATING...' : 'PATCH RANK'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
