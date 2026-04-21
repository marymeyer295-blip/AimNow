import { useState, useEffect } from 'react';
import { api } from '../api';
import { Table, Badge } from '../components/Table';
import { Search, Edit2, Loader2, Plus, Archive, X } from 'lucide-react';
import { motion } from 'motion/react';

export default function Questions() {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [editingQuestion, setEditingQuestion] = useState<any>(null);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const data = await api.questions.list();
      setQuestions(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = questions.filter(q => 
    (q.question_text || '').toLowerCase().includes(search.toLowerCase()) ||
    (q.question_code || '').toLowerCase().includes(search.toLowerCase())
  );

  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'must_ask': return 'red';
      case 'quote_critical': return 'amber';
      case 'feasibility_critical': return 'teal';
      case 'scoring_critical': return 'purple';
      default: return 'gray';
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 grayscale">
      <Loader2 className="animate-spin text-accent mb-4" size={32} />
      <span className="text-[#8b90a8] text-sm tracking-wide uppercase font-semibold">Syncing Logic Nodes...</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Discovery Questions</h2>
          <p className="text-sm text-[#8b90a8] mt-1">{questions.length} active decision nodes</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5f7a]" size={16} />
            <input 
              type="text" 
              placeholder="Search questions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-64 bg-white/5 border border-glass-border rounded-xl pl-10 pr-4 py-2 text-sm text-white outline-none focus:border-accent transition-all"
            />
          </div>
          <button 
            onClick={() => setEditingQuestion({ isNew: true })}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-dark text-white rounded-xl text-sm font-bold shadow-lg shadow-accent/20 transition-all"
          >
            <Plus size={16} />
            Add Node
          </button>
        </div>
      </div>

      <Table headers={['Code', 'Question', 'Type', 'Priority', 'Critical', 'Status', 'Actions']}>
        {filtered.map((q) => (
          <tr key={q.id} className="hover:bg-white/[0.01] transition-colors group">
            <td className="px-6 py-4">
              <code className="text-accent font-mono text-xs">{q.question_code || '—'}</code>
            </td>
            <td className="px-6 py-4 max-w-md">
              <div className="text-sm text-[#e8eaf0] line-clamp-2">{q.question_text}</div>
            </td>
            <td className="px-6 py-4">
              <Badge type={getTypeStyle(q.question_type) as any}>{q.question_type?.replace(/_/g, ' ')}</Badge>
            </td>
            <td className="px-6 py-4 text-[#8b90a8] text-sm">{q.priority_order}</td>
            <td className="px-6 py-4">
              <div className="flex gap-1.5 flex-wrap">
                {q.quote_critical && <Badge type="amber">Q</Badge>}
                {q.feasibility_critical && <Badge type="teal">F</Badge>}
                {q.scoring_critical && <Badge type="purple">S</Badge>}
              </div>
            </td>
            <td className="px-6 py-4">
              <Badge type={q.status === 'active' ? 'green' : 'gray'}>{q.status}</Badge>
            </td>
            <td className="px-6 py-4">
              <div className="flex gap-2">
                <button 
                  onClick={() => setEditingQuestion(q)}
                  className="p-2 text-[#5a5f7a] hover:text-accent hover:bg-accent/10 rounded-lg transition-all"
                >
                  <Edit2 size={14} />
                </button>
                <button 
                  onClick={async () => {
                    if (confirm('Archive this decision node?')) {
                      await api.questions.delete(q.id);
                      fetchQuestions();
                    }
                  }}
                  className="p-2 text-[#5a5f7a] hover:text-[#f0545a] hover:bg-[#f0545a]/10 rounded-lg transition-all"
                >
                  <Archive size={14} />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </Table>

      {editingQuestion && (
        <EditQuestionModal 
          question={editingQuestion} 
          onClose={() => setEditingQuestion(null)} 
          onSaved={fetchQuestions} 
        />
      )}
    </div>
  );
}

function EditQuestionModal({ question, onClose, onSaved }: { question: any, onClose: () => void, onSaved: () => void }) {
  const isNew = question.isNew;
  const [formData, setFormData] = useState(isNew ? {
    question_code: '',
    question_text: '',
    question_type: 'must_ask',
    priority_order: 99,
    status: 'active',
    purpose: '',
    ask_if: '',
    skip_if: '',
    quote_critical: false,
    feasibility_critical: false,
    scoring_critical: false
  } : { ...question });
  
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.question_text.trim()) return alert('Question text is required');
    setSaving(true);
    try {
      if (isNew) {
        await api.questions.create(formData);
      } else {
        await api.questions.update(question.id, formData);
      }
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
        className="w-full max-w-2xl glass-panel rounded-[20px] shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
      >
        <div className="sticky top-0 bg-white/5 backdrop-blur-md border-b border-glass-border p-6 flex justify-between items-center z-10">
          <h2 className="text-lg font-bold text-white tracking-tight">{isNew ? 'New Discovery Node' : 'Edit Decision Node'}</h2>
          <button onClick={onClose} className="text-text-dim hover:text-white transition-all bg-white/5 p-2 rounded-lg">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-text-dim uppercase tracking-[0.2em] ml-1">Question Text</label>
            <textarea 
              value={formData.question_text} 
              onChange={e => setFormData({ ...formData, question_text: e.target.value })}
              className="w-full bg-white/5 border border-glass-border rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-accent min-h-[80px] transition-all"
              placeholder="e.g. What is the primary objective for this transformation?"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-dim uppercase tracking-[0.2em] ml-1">Type</label>
              <select 
                value={formData.question_type} 
                onChange={e => setFormData({ ...formData, question_type: e.target.value })}
                className="w-full bg-white/5 border border-glass-border rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-accent appearance-none"
              >
                {['must_ask', 'quote_critical', 'feasibility_critical', 'scoring_critical', 'optional_depth'].map(v => (
                  <option key={v} value={v} className="bg-[#0f172a]">{v.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-dim uppercase tracking-[0.2em] ml-1">Priority Order</label>
              <input 
                type="number"
                value={formData.priority_order} 
                onChange={e => setFormData({ ...formData, priority_order: parseInt(e.target.value) })}
                className="w-full bg-white/5 border border-glass-border rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-accent transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-dim uppercase tracking-[0.2em] ml-1">Question Code</label>
              <input 
                value={formData.question_code || ''} 
                onChange={e => setFormData({ ...formData, question_code: e.target.value })}
                className="w-full bg-white/5 border border-glass-border rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-accent font-mono transition-all"
                placeholder="Q-100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-dim uppercase tracking-[0.2em] ml-1">Status</label>
              <select 
                value={formData.status} 
                onChange={e => setFormData({ ...formData, status: e.target.value })}
                className="w-full bg-white/5 border border-glass-border rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-accent appearance-none"
              >
                {['active', 'draft', 'archived'].map(v => <option key={v} value={v} className="bg-[#0f172a]">{v}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-dim uppercase tracking-[0.2em] ml-1">Ask If (Logic)</label>
              <input 
                value={formData.ask_if || ''} 
                onChange={e => setFormData({ ...formData, ask_if: e.target.value })}
                className="w-full bg-white/5 border border-glass-border rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-accent transition-all"
                placeholder="has_crm_sync == true"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-dim uppercase tracking-[0.2em] ml-1">Skip If (Logic)</label>
              <input 
                value={formData.skip_if || ''} 
                onChange={e => setFormData({ ...formData, skip_if: e.target.value })}
                className="w-full bg-white/5 border border-glass-border rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-accent transition-all"
                placeholder="is_startup == true"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-text-dim uppercase tracking-[0.2em] ml-1">Purpose / Context</label>
            <textarea 
              value={formData.purpose || ''} 
              onChange={e => setFormData({ ...formData, purpose: e.target.value })}
              className="w-full bg-white/5 border border-glass-border rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-accent min-h-[60px] transition-all"
            />
          </div>

          <div className="flex flex-wrap gap-6 pt-2">
            {[
              { id: 'quote_critical', label: 'Quote Critical' },
              { id: 'feasibility_critical', label: 'Feasibility Critical' },
              { id: 'scoring_critical', label: 'Scoring Critical' }
            ].map(check => (
              <label key={check.id} className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input 
                    type="checkbox" 
                    checked={formData[check.id]}
                    onChange={e => setFormData({ ...formData, [check.id]: e.target.checked })}
                    className="sr-only"
                  />
                  <div className={`w-5 h-5 rounded-lg border transition-all flex items-center justify-center ${formData[check.id] ? 'bg-accent border-accent text-[#0f172a]' : 'border-glass-border bg-white/5 group-hover:border-accent'}`}>
                    {formData[check.id] && <X size={14} className="rotate-45" />}
                  </div>
                </div>
                <span className="text-xs font-bold text-text-dim uppercase tracking-wider group-hover:text-white transition-all">{check.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="sticky bottom-0 bg-white/5 backdrop-blur-md border-t border-glass-border p-6 flex justify-end gap-3 z-10">
          <button onClick={onClose} className="px-6 py-2 rounded-xl text-sm font-bold text-text-dim uppercase tracking-wider hover:bg-white/5 transition-all">Cancel</button>
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="px-8 py-3 bg-accent hover:bg-accent/90 text-[#0f172a] rounded-xl text-xs font-bold shadow-lg shadow-accent/20 transition-all flex items-center gap-2 uppercase tracking-widest"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : 'Confirm Node'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
