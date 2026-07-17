import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { setupUniver, buildFromTemplate, extractForSync } from './univer';
import type { Shop, Template, SyncResult, User } from './types';

const SHEET_KEY = 'daily_ops'; // v1:工作簿编辑会话用单把锁(daily_ops),后端支持按表扩展

export function Workbook({
  shop, period, onBack, onPeriod,
}: {
  shop: Shop;
  period: string;
  onPeriod: (p: string) => void;
  onBack: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const univerRef = useRef<ReturnType<typeof setupUniver> | null>(null);
  const fwbRef = useRef<any>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wbIdRef = useRef<number>(0);
  const templateRef = useRef<Template | null>(null);
  const meRef = useRef<User | null>(null);

  const [editing, setEditing] = useState(false);
  const [holder, setHolder] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [busy, setBusy] = useState(false);

  const stopHeartbeat = () => {
    if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
  };
  const releaseIfMine = async () => {
    stopHeartbeat();
    try { await api.releaseLock(wbIdRef.current, SHEET_KEY); } catch { /* ignore */ }
  };

  const startHeartbeat = () => {
    stopHeartbeat();
    heartbeatRef.current = setInterval(async () => {
      try {
        const h = await api.heartbeat(wbIdRef.current, SHEET_KEY);
        if (!h.renewed) { setEditing(false); setHolder('他人'); stopHeartbeat(); setMsg('锁已失效,请重新获取'); }
      } catch {
        stopHeartbeat(); setEditing(false); setMsg('心跳失败,锁可能已失效');
      }
    }, 15000);
  };

  const startEdit = async () => {
    try {
      const r = await api.acquireLock(wbIdRef.current, SHEET_KEY);
      if (r.acquired) { setEditing(true); setHolder(null); startHeartbeat(); }
      else setHolder(r.heldBy?.user_name ?? '他人');
    } catch (e: any) { setMsg(e.message); }
  };
  const endEdit = async () => { await releaseIfMine(); setEditing(false); setHolder(null); };
  const takeover = async () => {
    try {
      const r = await api.takeoverLock(wbIdRef.current, SHEET_KEY);
      if (r.acquired) { setEditing(true); setHolder(null); startHeartbeat(); }
      else setHolder(r.heldBy?.user_name ?? '他人');
    } catch (e: any) { setMsg(e.message); }
  };

  const save = async () => {
    if (!editing) { setMsg('请先进入编辑(获取锁)'); return; }
    setBusy(true); setMsg('');
    try {
      const fwb = fwbRef.current;
      const snapshot = fwb.save();
      await api.putSnapshot(wbIdRef.current, snapshot);
      const { dailyMetrics, expenses } = extractForSync(fwb, templateRef.current!.definition);
      const res = await api.sync(wbIdRef.current, { dailyMetrics, expenses });
      setSyncResult(res);
      setMsg(`已保存并同步${res.errors.length ? `,${res.errors.length} 项校验错误` : ''}`);
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };

  useEffect(() => {
    (async () => {
      const me = await api.me().catch(() => null);
      meRef.current = me;
      const wb = await api.createWorkbook(shop.id, period);
      wbIdRef.current = wb.id;
      const tpl = await api.template(shop.business_code);
      templateRef.current = tpl;
      const snap = await api.getSnapshot(wb.id);
      const handle = setupUniver(containerRef.current!);
      univerRef.current = handle;
      fwbRef.current = snap?.data
        ? handle.univerAPI.createWorkbook(snap.data as any)
        : buildFromTemplate(handle.univerAPI, tpl.definition, `${shop.name} ${period}`);
      const st = await api.lockStatus(wb.id, SHEET_KEY);
      if ((st as any).held === false) { setHolder(null); setEditing(false); }
      else if ((st as any).user_name && (st as any).user_name !== me?.username) setHolder((st as any).user_name);
      else setHolder(null);
    })();
    return () => { void releaseIfMine(); univerRef.current?.dispose(); univerRef.current = null; };
  }, [shop.id, period]);

  return (
    <div className="flex h-full flex-col bg-slate-900 text-slate-100">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-700 p-3 text-sm">
        <button onClick={onBack} className="text-cyan-400">← 返回</button>
        <input type="month" value={period} onChange={e => onPeriod(e.target.value)} className="rounded bg-slate-800 px-2 py-1" />
        <span className="font-medium">{shop.name}</span>
        {editing
          ? <span className="rounded bg-green-600 px-2 py-0.5 text-xs">编辑中</span>
          : holder
            ? <span className="rounded bg-amber-600 px-2 py-0.5 text-xs">只读 · {holder} 正在编辑</span>
            : <span className="rounded bg-slate-600 px-2 py-0.5 text-xs">查看</span>}
        <div className="flex-1" />
        {!editing && !holder && <button onClick={startEdit} className="rounded bg-cyan-500 px-3 py-1">编辑</button>}
        {editing && <button onClick={endEdit} className="rounded bg-slate-700 px-3 py-1">退出编辑</button>}
        {holder && <button onClick={takeover} className="rounded bg-amber-600 px-3 py-1">接管</button>}
        <button onClick={save} disabled={!editing || busy} className="rounded bg-green-600 px-3 py-1 disabled:opacity-40">保存并同步</button>
      </header>
      {msg && <div className="bg-slate-800 px-4 py-1 text-sm text-cyan-300">{msg}</div>}
      {syncResult?.errors.length ? (
        <div className="bg-red-900/40 px-4 py-2 text-xs text-red-300">
          校验错误:{syncResult.errors.map((e, i) => <span key={i} className="mr-3">{e.sheetKey}/{e.date} {e.key}:{e.msg}</span>)}
        </div>
      ) : null}
      <div ref={containerRef} className="flex-1" />
    </div>
  );
}
