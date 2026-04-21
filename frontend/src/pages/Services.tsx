import { useState, useEffect } from 'react';
import { api } from '../api';
import { Table, Badge } from '../components/Table';
import { Search, Edit2, Loader2, AlertCircle, X } from 'lucide-react';

export default function Services() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [editingService, setEditingService] = useState<any>(null);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const data = await api.services.list();
      setServices(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = services.filter(s => 
    (s.service_code || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.service_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.service_category || '').toLowerCase().includes(search.toLowerCase())
  );

  const getStatusType = (status: string) => {
    switch (status) {
      case 'active': return 'green';
      case 'draft': return 'amber';
      case 'needs_review': return 'amber';
      case 'archived': return 'red';
      default: return 'gray';
    }
  };

  const getPriorityType = (p: string) => {
    switch (p) {
      case 'P1': return 'red';
      case 'P2': return 'amber';
      case 'P3': return 'blue';
      default: return 'gray';
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 grayscale">
      <Loader2 className="animate-spin text-accent mb-4" size={32} />
      <span className="text-[#8b90a8] text-sm tracking-wide uppercase font-semibold">Retrieving Catalogue...</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Service Catalogue</h2>
          <p className="text-sm text-[#8b90a8] mt-1">{services.length} total services identified in matrix</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5f7a]" size={16} />
          <input 
            type="text" 
            placeholder="Search code, name, category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64 bg-white/5 border border-glass-border rounded-xl pl-10 pr-4 py-2 text-sm text-white outline-none focus:border-accent transition-all"
          />
        </div>
      </div>

      <Table headers={['Code', 'Service Name', 'Type', 'Category', 'Status', 'Priority', 'Owner', 'Actions']}>
        {filtered.map((s) => (
          <tr key={s.id} className="hover:bg-white/[0.01] transition-colors group">
            <td className="px-6 py-4">
              <code className="text-accent font-mono text-[10px] bg-white/5 px-1.5 py-0.5 rounded border border-white/5">{s.service_code}</code>
            </td>
            <td className="px-6 py-4">
              <div className="font-semibold text-white">{s.service_name}</div>
            </td>
            <td className="px-6 py-4 text-xs font-mono text-text-dim">
              {s.service_type}
            </td>
            <td className="px-6 py-4 truncate max-w-[150px]">
              <div className="text-xs text-text-dim">{s.service_category || '—'}</div>
            </td>
            <td className="px-6 py-4">
              <Badge type={getStatusType(s.status) as any}>{s.status}</Badge>
            </td>
            <td className="px-6 py-4">
              <Badge type={getPriorityType(s.priority) as any}>{s.priority}</Badge>
            </td>
            <td className="px-6 py-4">
              <div className="text-xs text-text-dim">{s.primary_owner || '—'}</div>
            </td>
            <td className="px-6 py-4">
              <button 
                onClick={() => setEditingService(s)}
                className="p-2 text-text-dim hover:text-white hover:bg-white/10 rounded-lg transition-all"
              >
                <Edit2 size={14} />
              </button>
            </td>
          </tr>
        ))}
      </Table>

      {/* Edit Modal */}
      {editingService && (
        <EditServiceModal 
          service={editingService} 
          onClose={() => setEditingService(null)} 
          onSaved={fetchServices} 
        />
      )}
    </div>
  );
}

function EditServiceModal({ service, onClose, onSaved }: { service: any, onClose: () => void, onSaved: () => void }) {
  const [formData, setFormData] = useState({ ...service });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.services.update(service.id, {
        ...formData,
        best_fit_industries: Array.isArray(formData.best_fit_industries) ? formData.best_fit_industries : (formData.best_fit_industries || '').split(',').map((x:any)=>x.trim()).filter(Boolean),
        risk_flags: Array.isArray(formData.risk_flags) ? formData.risk_flags : (formData.risk_flags || '').split(',').map((x:any)=>x.trim()).filter(Boolean),
      });
      onSaved();
      onClose();
    } catch (err) {
      alert('Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-2xl glass-panel rounded-[20px] shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
      >
        <div className="sticky top-0 bg-white/5 backdrop-blur-md border-b border-glass-border p-6 flex justify-between items-center z-10">
          <h2 className="text-lg font-bold text-white tracking-tight text-center flex-1 ml-6">Edit Service Matrix: {service.service_code}</h2>
          <button onClick={onClose} className="text-text-dim hover:text-white transition-all bg-white/5 p-2 rounded-lg">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-dim uppercase tracking-[0.2em] ml-1">Service Name</label>
              <input 
                value={formData.service_name} 
                onChange={e => setFormData({ ...formData, service_name: e.target.value })}
                className="w-full bg-white/5 border border-glass-border rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-accent transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-dim uppercase tracking-[0.2em] ml-1">Status</label>
              <select 
                value={formData.status} 
                onChange={e => setFormData({ ...formData, status: e.target.value })}
                className="w-full bg-white/5 border border-glass-border rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-accent appearance-none"
              >
                {['active', 'draft', 'archived', 'needs_review'].map(v => <option key={v} value={v} className="bg-[#0f172a]">{v}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-dim uppercase tracking-[0.2em] ml-1">Priority</label>
              <select 
                value={formData.priority} 
                onChange={e => setFormData({ ...formData, priority: e.target.value })}
                className="w-full bg-white/5 border border-glass-border rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-accent appearance-none"
              >
                {['P1', 'P2', 'P3'].map(v => <option key={v} value={v} className="bg-[#0f172a]">{v}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-dim uppercase tracking-[0.2em] ml-1">Primary Owner</label>
              <input 
                value={formData.primary_owner || ''} 
                onChange={e => setFormData({ ...formData, primary_owner: e.target.value })}
                className="w-full bg-white/5 border border-glass-border rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-text-dim uppercase tracking-[0.2em] ml-1">Working Definition</label>
            <textarea 
              value={formData.working_definition || ''} 
              onChange={e => setFormData({ ...formData, working_definition: e.target.value })}
              className="w-full bg-white/5 border border-glass-border rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-accent min-h-[100px]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-text-dim uppercase tracking-[0.2em] ml-1">Best Fit Industries (comma-separated)</label>
            <input 
              value={Array.isArray(formData.best_fit_industries) ? formData.best_fit_industries.join(', ') : formData.best_fit_industries || ''} 
              onChange={e => setFormData({ ...formData, best_fit_industries: e.target.value })}
              className="w-full bg-white/5 border border-glass-border rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-accent"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-text-dim uppercase tracking-[0.2em] ml-1">Risk Flags (comma-separated)</label>
            <input 
              value={Array.isArray(formData.risk_flags) ? formData.risk_flags.join(', ') : formData.risk_flags || ''} 
              onChange={e => setFormData({ ...formData, risk_flags: e.target.value })}
              className="w-full bg-white/5 border border-glass-border rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-accent"
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-white/5 backdrop-blur-md border-t border-glass-border p-6 flex justify-end gap-3 z-10">
          <button onClick={onClose} className="px-6 py-2 rounded-xl text-sm font-bold text-text-dim uppercase tracking-wider hover:bg-white/5 transition-all">Cancel</button>
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="px-8 py-3 bg-accent hover:bg-accent/90 text-[#0f172a] rounded-xl text-xs font-bold shadow-lg shadow-accent/20 transition-all flex items-center gap-2 uppercase tracking-widest"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : 'Apply Mutations'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

import { motion } from 'motion/react';
