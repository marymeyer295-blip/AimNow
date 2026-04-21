import { useState, useEffect } from 'react';
import { api } from '../api';
import { Table, Badge } from '../components/Table';
import { Loader2, Edit2, ShieldAlert } from 'lucide-react';

export default function Escalation() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);
  const fetchData = async () => {
    try { const r = await api.escalation.list(); setData(r); } 
    catch(e) { console.error(e); } finally { setLoading(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-red-500" /></div>;

  return (
    <div className="space-y-6">
       <div className="bg-red-500/5 border border-red-500/10 p-6 rounded-2xl flex items-center gap-4">
        <ShieldAlert className="text-red-500" />
        <h2 className="text-sm font-bold text-white uppercase tracking-widest">Escalation Triggers</h2>
      </div>
      <Table headers={['Rule Name', 'Condition', 'Escalate To', 'Active']}>
        {data.map(r => (
          <tr key={r.id}>
            <td className="px-6 py-4 font-bold text-white uppercase text-xs tracking-tight">{r.rule_name}</td>
            <td className="px-6 py-4 text-xs text-[#8b90a8] max-w-sm">{r.condition_description}</td>
            <td className="px-6 py-4"><Badge type="red">{r.escalate_to}</Badge></td>
            <td className="px-6 py-4">
              <Badge type={r.active ? 'green' : 'gray'}>{r.active ? 'Armed' : 'Inactive'}</Badge>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
