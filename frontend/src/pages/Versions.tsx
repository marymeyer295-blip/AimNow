import { useState, useEffect } from 'react';
import { api } from '../api';
import { Badge } from '../components/Table';
import { Loader2, Settings, Zap, History } from 'lucide-react';

export default function Versions() {
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const data = await api.versions.list();
      setVersions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const publish = async (tag: string) => {
    if (!confirm(`Deploy ${tag} to Production? This overrides the Current Brain.`)) return;
    try {
      await api.versions.publish(tag);
      fetchData();
    } catch (err) {
      alert('Publish failed');
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 grayscale">
      <Loader2 className="animate-spin text-accent mb-4" size={32} />
    </div>
  );

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-surface border border-white/5 rounded-2xl p-6 mb-8">
        <h3 className="text-sm font-bold text-white mb-2 tracking-tight flex items-center gap-2">
           <Zap size={14} className="text-[#22c97b]" />
           Version Control Summary
        </h3>
        <p className="text-sm text-[#8b90a8] leading-relaxed">
          Only one <span className="text-[#22c97b] font-bold">live</span> version can exist. 
          Publishing a new version automatically decommissions and archives the current production brain.
        </p>
      </div>

      <div className="space-y-3">
        {versions.map((v) => (
          <div 
            key={v.id} 
            className={`
              p-6 bg-surface border rounded-2xl flex items-center justify-between transition-all group
              ${v.status === 'live' ? 'border-[#22c97b]/40 bg-[#22c97b]/5 shadow-[0_0_15px_rgba(34,201,123,0.1)]' : 'border-white/5 hover:border-white/10'}
            `}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-lg font-bold text-white tracking-tight">{v.version_tag}</span>
                <Badge type={v.status === 'live' ? 'green' : 'gray'}>{v.status}</Badge>
              </div>
              <p className="text-xs text-[#8b90a8] mb-3 line-clamp-1">{v.notes || 'No change logs provided'}</p>
              <div className="flex items-center gap-4 text-[10px] text-[#5a5f7a] uppercase tracking-widest font-bold">
                <span className="flex items-center gap-1.5"><History size={10} /> {v.published_at ? new Date(v.published_at).toLocaleString() : 'Not published'}</span>
                <span>•</span>
                <span>By {v.published_by || 'system'}</span>
              </div>
            </div>

            {v.status !== 'live' ? (
              <button 
                onClick={() => publish(v.version_tag)}
                className="px-5 py-2 bg-[#22c97b] hover:bg-[#1bb36c] text-[11px] font-bold text-white rounded-lg transition-all shadow-lg shadow-[#22c97b]/10 whitespace-nowrap"
              >
                DEPLOY LIVE
              </button>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 bg-[#22c97b]/10 text-[#22c97b] text-[10px] font-bold uppercase tracking-widest rounded-lg border border-[#22c97b]/20">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22c97b] animate-pulse"></span>
                In Production
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
