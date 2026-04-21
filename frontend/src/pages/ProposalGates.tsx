import { useState, useEffect } from 'react';
import { api } from '../api';
import { Table, Badge } from '../components/Table';
import { Loader2, FileCheck } from 'lucide-react';

export default function ProposalGates() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);
  const fetchData = async () => {
    try { const r = await api.proposalGates.list(); setData(r); } 
    catch(e) { console.error(e); } finally { setLoading(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500" /></div>;

  return (
    <div className="space-y-6">
       <div className="bg-blue-500/5 border border-blue-500/10 p-6 rounded-2xl flex items-center gap-4">
        <FileCheck className="text-blue-500" />
        <h2 className="text-sm font-bold text-white uppercase tracking-widest">Proposal Readiness Gates</h2>
      </div>
      <Table headers={['Display Label', 'Min Confidence', 'Required Fields']}>
        {data.map(g => (
          <tr key={g.id}>
            <td className="px-6 py-4 font-bold text-white">{g.display_label}</td>
            <td className="px-6 py-4"><Badge type="blue">{g.min_confidence_score}%</Badge></td>
            <td className="px-6 py-4">
              <div className="flex flex-wrap gap-1">
                {(g.required_fields || []).map((f: string) => (
                  <div key={f}><Badge type="gray">{f}</Badge></div>
                ))}
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
