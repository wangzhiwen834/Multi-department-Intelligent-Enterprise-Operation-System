import { useEffect, useState } from 'react';
import { api } from './api';
import type { Shop, User } from './types';

export function ShopList({
  user, period, onPeriod, onPick, onLogout,
}: {
  user: User | null;
  period: string;
  onPeriod: (p: string) => void;
  onPick: (s: Shop) => void;
  onLogout: () => void;
}) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.shops().then(setShops).catch(e => setErr(e.message));
  }, []);

  return (
    <div className="h-full bg-slate-900 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-700 p-4">
        <h1 className="text-lg">店铺列表</h1>
        <div className="flex items-center gap-3 text-sm">
          <input type="month" value={period} onChange={e => onPeriod(e.target.value)} className="rounded bg-slate-800 px-2 py-1" />
          <span>{user?.name}</span>
          <button onClick={onLogout} className="text-cyan-400">退出</button>
        </div>
      </header>
      <main className="grid grid-cols-2 gap-4 p-6 md:grid-cols-3">
        {err && <div className="text-red-400">{err}</div>}
        {shops.map(s => (
          <button key={s.id} onClick={() => onPick(s)} className="rounded-xl bg-slate-800 p-6 text-left hover:ring-2 hover:ring-cyan-500">
            <div className="text-base font-medium">{s.name}</div>
            <div className="text-xs text-slate-400">{s.business_name}</div>
          </button>
        ))}
      </main>
    </div>
  );
}
