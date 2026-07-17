import { useState } from 'react';
import { api } from './api';
import type { User } from './types';

export function Login({ onLogin }: { onLogin: (u: User, token: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await api.login(username, password);
      onLogin(r.user, r.token);
    } catch (e: any) {
      setErr(e.message);
    }
  };

  return (
    <div className="flex h-full items-center justify-center bg-slate-900 text-slate-100">
      <form onSubmit={submit} className="w-80 rounded-xl bg-slate-800 p-6 shadow-xl">
        <h1 className="mb-4 text-xl">足浴经营系统 · 登录</h1>
        <input className="mb-3 w-full rounded bg-slate-700 px-3 py-2 outline-none" placeholder="账号" value={username} onChange={e => setUsername(e.target.value)} />
        <input className="mb-3 w-full rounded bg-slate-700 px-3 py-2 outline-none" type="password" placeholder="密码" value={password} onChange={e => setPassword(e.target.value)} />
        {err && <div className="mb-3 text-sm text-red-400">{err}</div>}
        <button className="w-full rounded bg-cyan-500 py-2 font-medium">登录</button>
      </form>
    </div>
  );
}
