import React from 'react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-slate-800 text-slate-200 h-full overflow-y-auto">
      {children}
    </div>
  );
}
