import { useState, useEffect } from 'react';
import { api } from '../api';
import { Table, Badge } from '../components/Table';
import { Loader2, MessageSquare } from 'lucide-react';

export default function Objections() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);
  const fetchData = async () => {
    try { const r = await api.objections.list(); setData(r); } 
    catch(e) { console.error(e); } finally { setLoading(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-teal-400" /></div>;

  return (
    <div className="space-y-6">
       <div className="bg-teal-500/5 border border-teal-500/10 p-6 rounded-2xl flex items-center gap-4">
        <MessageSquare className="text-teal-400" />
        <h2 className="text-sm font-bold text-white uppercase tracking-widest">Objection Responses</h2>
      </div>
      <Table headers={['Category', 'Objection', 'Response Preview', 'Active']}>
        {data.map(o => (
          <tr key={o.id}>
            <td className="px-6 py-4"><Badge type="teal">{o.objection_category}</Badge></td>
            <td className="px-6 py-4 font-medium text-white max-w-xs truncate">{o.objection_text}</td>
            <td className="px-6 py-4 text-xs text-[#8b90a8] max-w-sm truncate">{o.recommended_response}</td>
            <td className="px-6 py-4">
              <Badge type={o.active ? 'green' : 'gray'}>{o.active ? 'Active' : 'Muted'}</Badge>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
