import { useState, useEffect } from 'react';
import { api } from '../api';
import { Table, Badge } from '../components/Table';
import { Loader2, History, AlertCircle } from 'lucide-react';

export default function AuditLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const data = await api.overrides.list();
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 grayscale">
      <Loader2 className="animate-spin text-accent mb-4" size={32} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-white/5 rounded-2xl p-6 flex items-start gap-4">
        <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500">
          <AlertCircle size={20} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight">System Overrides Audit</h3>
          <p className="text-sm text-[#8b90a8] mt-1 leading-relaxed">
            Record of manual corrective actions taken within the AI Decision Engine. 
            Used for refining scoring weights and industry playbooks.
          </p>
        </div>
      </div>

      {!logs.length ? (
        <div className="flex flex-col items-center justify-center py-20 bg-surface border border-white/5 border-dashed rounded-2xl grayscale">
          <div className="text-[#5a5f7a] font-mono text-sm tracking-widest uppercase">No Log Entries Found</div>
        </div>
      ) : (
        <Table headers={['Timestamp', 'Type', 'Override By', 'Notes']}>
          {logs.map((o) => (
            <tr key={o.id} className="hover:bg-white/[0.01]">
              <td className="px-6 py-4">
                <div className="flex items-center gap-2 text-xs text-[#5a5f7a] font-mono whitespace-nowrap">
                   <History size={12} />
                   {new Date(o.created_at).toLocaleString()}
                </div>
              </td>
              <td className="px-6 py-4">
                <Badge type="amber">{o.override_type?.replace(/_/g, ' ')}</Badge>
              </td>
              <td className="px-6 py-4 font-medium text-white">
                {o.override_by || 'Unknown System'}
              </td>
              <td className="px-6 py-4">
                <div className="text-xs text-[#8b90a8] max-w-lg leading-relaxed italic line-clamp-2">
                  "{o.override_notes || o.corrected_recommendation || 'No additional logs'}"
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
