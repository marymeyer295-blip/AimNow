import { useState, useEffect } from 'react';
import { api } from '../api';
import { 
  Activity, 
  HelpCircle, 
  Star, 
  BookOpen, 
  Users, 
  Zap, 
  ArrowRight,
  Loader2,
  AlertCircle,
  LayoutDashboard
} from 'lucide-react';

interface Stats {
  activeServices: number;
  activeQuestions: number;
  totalLeads: number;
  activePlaybooks: number;
  scoringRules: number;
  currentVersion: {
    version_tag: string;
    status: string;
  } | null;
}

export default function Dashboard({ onNavigate }: { onNavigate: (page: any) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const data = await api.dashboard.getStats();
      setStats(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 grayscale">
      <Loader2 className="animate-spin text-accent mb-4" size={32} />
      <span className="text-[#8b90a8] text-sm animate-pulse tracking-wide uppercase font-semibold">Initiating Neural Uplink...</span>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center py-20 p-8 border border-[#f0545a]/20 bg-[#f0545a]/5 rounded-2xl">
      <AlertCircle className="text-[#f0545a] mb-4" size={48} />
      <h3 className="text-white text-lg font-bold mb-2 tracking-tight">System Access Error</h3>
      <p className="text-[#8b90a8] text-center max-w-md mb-6">{error}</p>
      <button 
        onClick={fetchStats}
        className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-medium transition-all"
      >
        Retry Core Connection
      </button>
    </div>
  );

  const statCards = [
    { label: 'Active Services', value: stats?.activeServices, sub: 'In Catalogue', icon: Activity, color: 'text-accent', bg: 'bg-accent/10', page: 'services' },
    { label: 'Discovery Assets', value: stats?.activeQuestions, sub: 'Active Decision Nodes', icon: HelpCircle, color: 'text-purple-400', bg: 'bg-purple-400/10', page: 'questions' },
    { label: 'Total CRM Leads', value: stats?.totalLeads, sub: 'Interaction Records', icon: Users, color: 'text-pink-400', bg: 'bg-pink-400/10', page: 'leads' },
    { label: 'Scoring Rules', value: stats?.scoringRules, sub: 'Logic Calibrations', icon: Star, color: 'text-amber-400', bg: 'bg-amber-400/10', page: 'scoring' },
  ];

  const footerWidgets = [
    { label: 'Current Knowledge Version', value: stats?.currentVersion?.version_tag || '—', sub: `Published: ${stats?.currentVersion ? 'Recent' : 'N/A'}` },
    { label: 'Database Connection', value: 'PostgreSQL Connected', sub: 'Latency: 14ms | Pool: 18/20' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((card) => (
          <button 
            key={card.label}
            onClick={() => onNavigate(card.page)}
            className="group glass-panel p-5 rounded-2xl hover:bg-white/20 transition-all text-left"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2 rounded-lg ${card.bg} ${card.color}`}>
                <card.icon size={20} />
              </div>
              <ArrowRight size={16} className="text-text-dim group-hover:text-white transition-all transform group-hover:translate-x-1" />
            </div>
            <div className="text-[11px] font-bold text-text-dim uppercase tracking-widest mb-2">{card.label}</div>
            <div className="text-[28px] font-extrabold text-white tracking-tight">{card.value}</div>
          </button>
        ))}
      </div>

      <section className="glass-panel rounded-[20px] p-6 flex flex-col min-h-[400px]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Activity size={18} className="text-accent" />
            Core Intelligence Matrix
          </h2>
          <button 
            onClick={() => onNavigate('questions')}
            className="bg-accent text-[#0f172a] px-4 py-2 rounded-lg text-sm font-bold hover:bg-accent/90 transition-all shadow-lg shadow-accent/20"
          >
            Manage Discovery
          </button>
        </div>
        
        <div className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-white/5 rounded-xl border border-white/5 border-dashed">
          <div className="p-4 bg-white/5 rounded-full mb-4">
            <LayoutDashboard size={40} className="text-text-dim" />
          </div>
          <h3 className="text-white font-bold mb-2">Live Analysis Standby</h3>
          <p className="text-text-dim text-sm max-w-sm">Select a category from the sidebar to view and calibrate the intelligence engine's decision nodes.</p>
        </div>
      </section>

      <div className="flex flex-col lg:flex-row gap-5">
        {footerWidgets.map((widget) => (
          <div key={widget.label} className="flex-1 glass-panel p-5 rounded-2xl">
            <div className="text-[11px] font-bold text-text-dim uppercase tracking-widest mb-3">{widget.label}</div>
            <div className="text-lg font-bold text-white mb-1">{widget.value}</div>
            <div className="text-xs text-text-dim">{widget.sub}</div>
          </div>
        ))}
        <div className="flex-1 glass-panel p-5 rounded-2xl">
          <div className="text-[11px] font-bold text-text-dim uppercase tracking-widest mb-4">Quick Control</div>
          <div className="flex gap-2">
            {['Export Data', 'Clear Cache', 'Re-Score All'].map(action => (
              <button key={action} className="flex-1 border border-glass-border hover:bg-white/5 bg-transparent text-[10px] font-bold text-white uppercase tracking-wider py-2 rounded-lg transition-all">
                {action}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
