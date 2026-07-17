import { useEffect, useState } from 'react';
import { api, getToken, setToken, clearToken } from './api';
import type { Shop, User } from './types';
import { Login } from './Login';
import { ShopList } from './ShopList';
import { Workbook } from './Workbook';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<'loading' | 'login' | 'shops' | 'workbook'>('loading');
  const [shop, setShop] = useState<Shop | null>(null);
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));

  useEffect(() => {
    if (getToken()) {
      api.me().then(u => { setUser(u); setView('shops'); }).catch(() => { clearToken(); setView('login'); });
    } else {
      setView('login');
    }
  }, []);

  if (view === 'loading') return <div className="p-8 text-slate-100">加载中…</div>;
  if (view === 'login') {
    return <Login onLogin={(u, t) => { setToken(t); setUser(u); setView('shops'); }} />;
  }
  if (view === 'workbook' && shop) {
    return <Workbook shop={shop} period={period} onPeriod={setPeriod} onBack={() => setView('shops')} />;
  }
  return (
    <ShopList
      user={user}
      period={period}
      onPeriod={setPeriod}
      onPick={s => { setShop(s); setView('workbook'); }}
      onLogout={() => { clearToken(); setUser(null); setView('login'); }}
    />
  );
}
