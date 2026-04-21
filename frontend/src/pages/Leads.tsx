import { useState, useEffect } from 'react';
import { api } from '../api';
import { Table, Badge } from '../components/Table';
import { Search, Loader2 } from 'lucide-react';

export default function Leads() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const data = await api.leads.list();
      setLeads(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = leads.filter(l => 
    (l.brand_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.lead_id || '').toLowerCase().includes(search.toLowerCase())
  );

  const getBandType = (band: string) => {
    switch (band?.toLowerCase()) {
      case 'priority': return 'red';
      case 'qualified': return 'green';
      case 'medium': return 'amber';
      case 'low': return 'gray';
      default: return 'gray';
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 grayscale">
      <Loader2 className="animate-spin text-[#f472b6] mb-4" size={32} />
      <span className="text-[#8b90a8] text-sm tracking-wide uppercase font-semibold">Scanning Interaction Streams...</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Leads (Read Only)</h2>
          <p className="text-sm text-[#8b90a8] mt-1">Mirror of live CRM interaction records</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5f7a]" size={16} />
          <input 
            type="text" 
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64 bg-surface border border-white/5 rounded-xl pl-10 pr-4 py-2 text-sm text-white outline-none focus:border-accent transition-all"
          />
        </div>
      </div>

      <Table headers={['Lead ID', 'Brand', 'Industry', 'Band', 'Score', 'Confidence', 'Created']}>
        {filtered.map((l) => (
          <tr key={l.id} className="hover:bg-white/[0.01]">
            <td className="px-6 py-4">
              <code className="text-[#8b90a8] text-xs uppercase">{l.lead_id || l.id.slice(0, 8)}</code>
            </td>
            <td className="px-6 py-4">
              <div className="font-medium text-white">{l.brand_name || '—'}</div>
            </td>
            <td className="px-6 py-4">
              <div className="text-xs text-[#8b90a8]">{l.industry_primary || '—'}</div>
            </td>
            <td className="px-6 py-4">
              {l.priority_band ? <Badge type={getBandType(l.priority_band) as any}>{l.priority_band}</Badge> : '—'}
            </td>
            <td className="px-6 py-4 font-bold text-white">
              {l.total_lead_score ?? '—'}
            </td>
            <td className="px-6 py-4">
              {l.confidence_score ? (
                <div className="flex items-center gap-2">
                  <div className="w-12 h-1 bg-bg rounded-full overflow-hidden">
                    <div className="h-full bg-accent" style={{ width: `${l.confidence_score}%` }} />
                  </div>
                  <span className="text-xs text-accent font-bold">{l.confidence_score}%</span>
                </div>
              ) : '—'}
            </td>
            <td className="px-6 py-4 text-xs text-[#5a5f7a]">
              {l.created_at ? new Date(l.created_at).toLocaleDateString() : '—'}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
