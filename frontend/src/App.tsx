import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { 
  LayoutDashboard, 
  BookOpen, 
  HelpCircle, 
  BookText, 
  TrendingUp, 
  Star, 
  Layers, 
  ShieldAlert, 
  FileCheck, 
  Users, 
  MessageSquare, 
  Settings, 
  History,
  LogOut,
  ChevronRight,
  Menu,
  X,
  FileJson,
  BrainCircuit,
  Bot
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Dashboard from './pages/Dashboard';
import Services from './pages/Services';
import Questions from './pages/Questions';
import Playbooks from './pages/Playbooks';
import Rankings from './pages/Rankings';
import Scoring from './pages/Scoring';
import Thresholds from './pages/Thresholds';
import Escalation from './pages/Escalation';
import ProposalGates from './pages/ProposalGates';
import Leads from './pages/Leads';
import Objections from './pages/Objections';
import Versions from './pages/Versions';
import AuditLog from './pages/AuditLog';
import Chunker from './pages/Chunker';
import KnowledgeBase from './pages/KnowledgeBase';
import LoginPage from './pages/LoginPage';
import Conversations from './pages/Conversations';
import InternalTrainingBot from './pages/InternalTrainingBot';

type Page = 'dashboard' | 'services' | 'questions' | 'playbooks' | 'rankings' | 'scoring' | 'thresholds' | 'escalation' | 'proposal' | 'leads' | 'conversations' | 'objections' | 'versions' | 'audit' | 'chunker' | 'knowledge' | 'internal_bot';

function AppContent() {
  const { isAuthenticated, logout, user } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard onNavigate={setCurrentPage} />;
      case 'services': return <Services />;
      case 'questions': return <Questions />;
      case 'playbooks': return <Playbooks />;
      case 'rankings': return <Rankings />;
      case 'scoring': return <Scoring />;
      case 'thresholds': return <Thresholds />;
      case 'escalation': return <Escalation />;
      case 'proposal': return <ProposalGates />;
      case 'leads': return <Leads />;
      case 'conversations': return <Conversations />;
      case 'objections': return <Objections />;
      case 'versions': return <Versions />;
      case 'audit': return <AuditLog />;
      case 'chunker': return <Chunker />;
      case 'knowledge': return <KnowledgeBase />;
      case 'internal_bot': return <InternalTrainingBot />;
      default: return <Dashboard onNavigate={setCurrentPage} />;
    }
  };

  const navItems = [
    { section: 'Overview', items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'chunker', label: 'Chunk Creation', icon: FileJson },
      { id: 'knowledge', label: 'Entity Brain', icon: BrainCircuit },
    ]},
    { section: 'Knowledge', items: [
      { id: 'services', label: 'Services', icon: BookOpen },
      { id: 'questions', label: 'Discovery Q\'s', icon: HelpCircle },
      { id: 'playbooks', label: 'Playbooks', icon: BookText },
      { id: 'rankings', label: 'Rankings', icon: TrendingUp },
    ]},
    { section: 'Scoring', items: [
      { id: 'scoring', label: 'Scoring Rules', icon: Star },
      { id: 'thresholds', label: 'Thresholds', icon: Layers },
      { id: 'escalation', label: 'Escalation', icon: ShieldAlert },
      { id: 'proposal', label: 'Proposal Gates', icon: FileCheck },
    ]},
    { section: 'CRM', items: [
      { id: 'leads', label: 'Leads', icon: Users },
      { id: 'conversations', label: 'Conversations', icon: MessageSquare },
      { id: 'objections', label: 'Objections', icon: MessageSquare },
    ]},
    { section: 'System', items: [
      { id: 'versions', label: 'Versions', icon: Settings },
      { id: 'internal_bot', label: 'Internal Bot', icon: Bot },
      { id: 'audit', label: 'Audit Log', icon: History },
    ]}
  ];

  return (
    <div className="flex h-screen overflow-hidden relative">
      <div className="mesh-bg" />
      
      {/* Mobile Backdrop */}
      {!isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(true)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 glass-sidebar transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          <div className="p-8 pb-10">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 bg-accent rounded-lg shadow-[0_0_15px_rgba(74,222,128,0.3)]"></div>
              <div className="text-white font-extrabold tracking-tight text-xl">AIM ADMIN</div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto custom-scrollbar py-4 px-3">
            {navItems.map((section) => (
              <div key={section.section} className="mb-6">
                <div className="px-5 mb-2 text-[10px] font-bold text-text-dim uppercase tracking-widest">
                  {section.section}
                </div>
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setCurrentPage(item.id as Page);
                      if (window.innerWidth < 1024) setIsSidebarOpen(false);
                    }}
                    className={`
                      w-full flex items-center gap-3 px-5 py-3 rounded-lg text-sm transition-all mb-1
                      ${currentPage === item.id 
                        ? 'bg-white/10 text-white font-semibold' 
                        : 'text-text-dim hover:text-white hover:bg-white/5'}
                    `}
                  >
                    <item.icon size={16} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <div className="px-5 py-6">
            <div className="p-4 bg-black/20 rounded-xl border border-white/5">
              <div className="text-[10px] font-bold text-text-dim uppercase tracking-widest mb-2">Logged in as</div>
              <div className="text-xs font-semibold text-white truncate">{user?.name}</div>
              <button 
                onClick={logout}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs text-[#f0545a] hover:bg-[#f0545a]/10 transition-all font-bold uppercase tracking-wider"
              >
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative z-10">
        <header className="h-14 flex items-center px-4 lg:px-8 shrink-0 sticky top-0 z-30">
          <button 
            className="p-2 -ml-2 text-text-dim lg:hidden"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          
          <h1 className="text-xl font-bold text-white ml-2 lg:ml-0">
             {currentPage === 'dashboard' ? 'Intelligence Control Center' : currentPage.replace('-', ' ')}
          </h1>
          
          <div className="ml-auto flex items-center gap-4">
            <div className="bg-accent/10 border border-accent/20 px-3 py-1 rounded-full flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent shadow-[0_0_8px_rgba(74,222,128,0.5)]"></span>
              <span className="text-[11px] font-bold text-accent uppercase tracking-wider">API v1.0.0 Stable</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="max-w-7xl mx-auto w-full"
            >
              {renderPage()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
