import { ReactNode } from 'react';

interface TableProps {
  headers: string[];
  children: ReactNode;
}

export function Table({ headers, children }: TableProps) {
  return (
    <div className="glass-panel rounded-2xl overflow-hidden shadow-2xl">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/5 border-b border-glass-border">
              {headers.map((h) => (
                <th key={h} className="px-6 py-4 text-[11px] font-bold text-text-dim uppercase tracking-widest whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {children}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Badge({ children, type = 'gray' }: { children: ReactNode, type?: 'green' | 'red' | 'amber' | 'blue' | 'purple' | 'gray' | 'teal' }) {
  const styles : any = {
    green: 'bg-accent/10 text-accent border-accent/20',
    red: 'bg-[#f0545a]/10 text-[#f0545a] border-[#f0545a]/20',
    amber: 'bg-[#f5a623]/10 text-[#f5a623] border-[#f5a623]/20',
    blue: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
    purple: 'bg-purple-400/10 text-purple-400 border-purple-400/20',
    teal: 'bg-teal-400/10 text-teal-400 border-teal-400/20',
    gray: 'bg-white/5 text-text-dim border-white/10',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold border ${styles[type]} uppercase tracking-wider`}>
      {children}
    </span>
  );
}
