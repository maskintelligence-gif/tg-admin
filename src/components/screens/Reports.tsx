import { useState, useEffect } from 'react';
import { TrendingUp, Loader2, Trash2, AlertTriangle, ChevronDown, Calendar, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

function fmtUGX(n: number) {
  if (n >= 1_000_000) return `UGX ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `UGX ${Math.round(n / 1_000)}K`;
  return `UGX ${n.toLocaleString()}`;
}

interface ReportData {
  totalRevenue: number;
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  deliveryOrders: number;
  pickupOrders: number;
  totalMessages: number;
  newCustomers: number;
  averageOrderValue: number;
  topProducts: { name: string; count: number; revenue: number }[];
}

function StatRow({ label, value, sub, color }: any) {
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--border)' }}>
      <div>
        <p className="text-sm" style={{ color: 'var(--text)' }}>{label}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>{sub}</p>}
      </div>
      <p className="font-display font-bold text-base" style={{ color: color || 'var(--text)' }}>{value}</p>
    </div>
  );
}

// ─── Clear Data Modal ─────────────────────────────────────────────────────────

type ClearMode = 'today' | 'week' | 'month' | 'custom' | 'all';

interface ClearModalProps {
  onClose: () => void;
  onCleared: () => void;
}

function ClearModal({ onClose, onCleared }: ClearModalProps) {
  const [mode, setMode] = useState<ClearMode>('today');
  const [customDate, setCustomDate] = useState('');
  const [targets, setTargets] = useState({ orders: true, messages: false, customers: false });
  const [step, setStep] = useState<'configure' | 'confirm'>('configure');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmText, setConfirmText] = useState('');

  const modeLabel: Record<ClearMode, string> = {
    today: "Today's data",
    week: "Last 7 days",
    month: "This month",
    custom: customDate ? `From ${customDate} onwards` : 'Custom date',
    all: 'ALL data ever',
  };

  const getFromDate = (): string | null => {
    const now = new Date();
    if (mode === 'all') return null;
    if (mode === 'today') { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString(); }
    if (mode === 'week') { const d = new Date(); d.setDate(now.getDate() - 7); return d.toISOString(); }
    if (mode === 'month') { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d.toISOString(); }
    if (mode === 'custom' && customDate) { return new Date(customDate).toISOString(); }
    return null;
  };

  const nothingSelected = !targets.orders && !targets.messages && !targets.customers;
  const needsDate = mode === 'custom' && !customDate;

  const handleClear = async () => {
    if (confirmText !== 'DELETE') return;
    setLoading(true);
    setError('');
    try {
      const from = getFromDate();

      if (targets.orders) {
        let q = supabase.from('orders').delete();
        if (from) q = q.gte('created_at', from) as any;
        else q = q.neq('order_id', '00000000-0000-0000-0000-000000000000') as any; // delete all
        const { error: e } = await q;
        if (e) throw new Error(`Orders: ${e.message}`);
      }

      if (targets.messages) {
        let q = supabase.from('messages').delete();
        if (from) q = q.gte('created_at', from) as any;
        else q = q.neq('message_id', '00000000-0000-0000-0000-000000000000') as any;
        const { error: e } = await q;
        if (e) throw new Error(`Messages: ${e.message}`);
      }

      if (targets.customers) {
        let q = supabase.from('customers').delete();
        if (from) q = q.gte('created_at', from) as any;
        else q = q.neq('customer_id', '00000000-0000-0000-0000-000000000000') as any;
        const { error: e } = await q;
        if (e) throw new Error(`Customers: ${e.message}`);
      }

      onCleared();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end" style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full rounded-t-3xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up"
        style={{ background: 'var(--surface)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 className="font-display font-bold text-lg" style={{ color: 'var(--text)' }}>Clear Data</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>Permanently delete records from the database</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl" style={{ background: 'var(--surface2)' }}>
            <X size={17} style={{ color: 'var(--text2)' }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {step === 'configure' ? (
            <>
              {/* Period */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text3)' }}>
                  Time Range
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(['today', 'week', 'month', 'custom', 'all'] as ClearMode[]).map(m => (
                    <button key={m} onClick={() => setMode(m)}
                      className="py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
                      style={{
                        background: mode === m ? (m === 'all' ? 'var(--rose)' : 'var(--accent)') : 'var(--surface2)',
                        color: mode === m ? 'white' : 'var(--text2)',
                        border: `1px solid ${mode === m ? (m === 'all' ? 'var(--rose)' : 'var(--accent)') : 'var(--border)'}`,
                        gridColumn: m === 'all' ? 'span 2' : undefined,
                      }}>
                      {m === 'today' ? 'Today' : m === 'week' ? 'Last 7 Days' : m === 'month' ? 'This Month' : m === 'custom' ? 'Custom Date' : '⚠ Clear Everything'}
                    </button>
                  ))}
                </div>

                {/* Custom date picker */}
                {mode === 'custom' && (
                  <div className="mt-3">
                    <p className="text-xs mb-1.5" style={{ color: 'var(--text3)' }}>Delete records from this date onwards:</p>
                    <input
                      type="date"
                      value={customDate}
                      onChange={e => setCustomDate(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
                      style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid var(--border)' }}
                    />
                  </div>
                )}
              </div>

              {/* What to delete */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text3)' }}>
                  What to Delete
                </p>
                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  {[
                    { key: 'orders', label: 'Orders', sub: 'Order records, timeline, order items' },
                    { key: 'messages', label: 'Messages', sub: 'Chat messages and conversations' },
                    { key: 'customers', label: 'Customers', sub: 'Customer accounts and addresses' },
                  ].map(({ key, label, sub }, i) => (
                    <button key={key}
                      onClick={() => setTargets(t => ({ ...t, [key]: !t[key as keyof typeof t] }))}
                      className="w-full flex items-center justify-between px-4 py-3.5 text-left transition-all active:scale-98"
                      style={{
                        background: targets[key as keyof typeof targets] ? 'rgba(244,63,94,0.08)' : 'var(--surface2)',
                        borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                      }}>
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{label}</p>
                        <p className="text-xs" style={{ color: 'var(--text3)' }}>{sub}</p>
                      </div>
                      <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ml-3"
                        style={{
                          background: targets[key as keyof typeof targets] ? 'var(--rose)' : 'var(--border2)',
                          border: `2px solid ${targets[key as keyof typeof targets] ? 'var(--rose)' : 'var(--border)'}`,
                        }}>
                        {targets[key as keyof typeof targets] && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M1.5 5l2.5 2.5L8.5 2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Warning */}
              {mode === 'all' && (
                <div className="flex items-start gap-3 p-4 rounded-2xl"
                  style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid var(--rose)' }}>
                  <AlertTriangle size={16} style={{ color: 'var(--rose)', flexShrink: 0, marginTop: 1 }} />
                  <p className="text-sm" style={{ color: 'var(--rose)' }}>
                    This will delete ALL records permanently. This cannot be undone.
                  </p>
                </div>
              )}
            </>
          ) : (
            /* Confirm step */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl" style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid var(--rose)' }}>
                <p className="font-bold text-sm mb-2" style={{ color: 'var(--rose)' }}>You are about to permanently delete:</p>
                <p className="text-sm" style={{ color: 'var(--text2)' }}>
                  <strong>Range:</strong> {modeLabel[mode]}
                </p>
                <p className="text-sm" style={{ color: 'var(--text2)' }}>
                  <strong>Data:</strong> {Object.entries(targets).filter(([,v]) => v).map(([k]) => k).join(', ')}
                </p>
              </div>

              <div>
                <p className="text-sm mb-2" style={{ color: 'var(--text2)' }}>
                  Type <strong style={{ color: 'var(--rose)' }}>DELETE</strong> to confirm:
                </p>
                <input
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none font-mono"
                  style={{
                    background: 'var(--surface2)', color: 'var(--text)',
                    border: `1px solid ${confirmText === 'DELETE' ? 'var(--rose)' : 'var(--border)'}`,
                  }}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl"
                  style={{ background: 'rgba(244,63,94,0.15)', border: '1px solid var(--rose)' }}>
                  <AlertTriangle size={13} style={{ color: 'var(--rose)' }} />
                  <p className="text-xs font-mono" style={{ color: 'var(--rose)' }}>{error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex gap-3 flex-shrink-0 safe-bottom"
          style={{ borderTop: '1px solid var(--border)' }}>
          {step === 'configure' ? (
            <>
              <button onClick={onClose}
                className="flex-1 py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-95"
                style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>
                Cancel
              </button>
              <button
                onClick={() => setStep('confirm')}
                disabled={nothingSelected || needsDate}
                className="flex-1 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                style={{
                  background: nothingSelected || needsDate ? 'var(--border2)' : 'var(--rose)',
                  color: 'white',
                  opacity: nothingSelected || needsDate ? 0.5 : 1,
                }}>
                <Trash2 size={15} /> Continue
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setStep('configure'); setConfirmText(''); setError(''); }}
                disabled={loading}
                className="flex-1 py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-95"
                style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>
                Back
              </button>
              <button
                onClick={handleClear}
                disabled={confirmText !== 'DELETE' || loading}
                className="flex-1 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                style={{
                  background: confirmText === 'DELETE' ? 'var(--rose)' : 'var(--border2)',
                  color: 'white',
                  opacity: confirmText === 'DELETE' && !loading ? 1 : 0.5,
                }}>
                {loading
                  ? <><Loader2 size={15} className="animate-spin" /> Deleting…</>
                  : <><Trash2 size={15} /> Confirm Delete</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function ReportsScreen() {
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showClear, setShowClear] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let from = new Date();
      if (period === 'today') { from.setHours(0, 0, 0, 0); }
      else if (period === 'week') { from.setDate(now.getDate() - 7); }
      else { from.setDate(1); from.setHours(0, 0, 0, 0); }

      const { data: orders } = await supabase.from('orders')
        .select('order_status, total_amount, fulfillment_type, order_items, created_at')
        .gte('created_at', from.toISOString());

      const { data: msgs } = await supabase.from('messages')
        .select('message_id').gte('created_at', from.toISOString()).eq('sender_type', 'customer');

      const { data: custs } = await supabase.from('customers')
        .select('customer_id').gte('created_at', from.toISOString());

      const all = orders ?? [];
      const notCancelled = all.filter((o: any) => o.order_status !== 'cancelled');
      const revenue = notCancelled.reduce((s: number, o: any) => s + (o.total_amount || 0), 0);

      const productMap: Record<string, { name: string; count: number; revenue: number }> = {};
      all.forEach((o: any) => {
        (o.order_items || []).forEach((item: any) => {
          if (!productMap[item.product_name]) productMap[item.product_name] = { name: item.product_name, count: 0, revenue: 0 };
          productMap[item.product_name].count += item.quantity || 1;
          productMap[item.product_name].revenue += item.subtotal || 0;
        });
      });
      const topProducts = Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

      setData({
        totalRevenue: revenue,
        totalOrders: all.length,
        completedOrders: all.filter((o: any) => o.order_status === 'complete').length,
        pendingOrders: all.filter((o: any) => o.order_status === 'pending_confirmation').length,
        cancelledOrders: all.filter((o: any) => o.order_status === 'cancelled').length,
        deliveryOrders: all.filter((o: any) => o.fulfillment_type === 'delivery').length,
        pickupOrders: all.filter((o: any) => o.fulfillment_type === 'pickup').length,
        totalMessages: msgs?.length ?? 0,
        newCustomers: custs?.length ?? 0,
        averageOrderValue: notCancelled.length > 0 ? revenue / notCancelled.length : 0,
        topProducts,
      });
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [period]);

  const periodLabel = period === 'today' ? 'Today' : period === 'week' ? 'Last 7 Days' : 'This Month';

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--bg)' }}>
      <div className="sticky top-0 z-40 pt-4 pb-2 px-4"
        style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-3">
          <h1 className="font-display font-bold text-xl" style={{ color: 'var(--text)' }}>Reports</h1>
          <button onClick={() => setShowClear(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
            style={{ background: 'rgba(244,63,94,0.12)', color: 'var(--rose)', border: '1px solid rgba(244,63,94,0.3)' }}>
            <Trash2 size={13} /> Clear Data
          </button>
        </div>
        <div className="flex gap-2">
          {(['today', 'week', 'month'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
              style={{
                background: period === p ? 'var(--accent)' : 'var(--surface)',
                color: period === p ? 'white' : 'var(--text2)',
                border: `1px solid ${period === p ? 'var(--accent)' : 'var(--border)'}`,
              }}>
              {p === 'today' ? 'Today' : p === 'week' ? '7 Days' : 'Month'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} style={{ color: 'var(--accent)' }} className="animate-spin" />
        </div>
      ) : data ? (
        <div className="px-4 py-3 space-y-4">
          {/* Hero */}
          <div className="rounded-2xl p-5 text-center"
            style={{ background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text3)' }}>
              {periodLabel} Revenue
            </p>
            <p className="font-display font-bold text-4xl mb-1" style={{ color: 'var(--emerald)' }}>
              {fmtUGX(data.totalRevenue)}
            </p>
            <p className="text-sm" style={{ color: 'var(--text2)' }}>
              from {data.totalOrders} order{data.totalOrders !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Orders */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text3)' }}>Orders</p>
            <StatRow label="Total Orders" value={data.totalOrders} />
            <StatRow label="Completed" value={data.completedOrders} color="var(--emerald)" />
            <StatRow label="Pending" value={data.pendingOrders} color="var(--amber)" />
            <StatRow label="Cancelled" value={data.cancelledOrders} color="var(--rose)" />
            <StatRow label="Delivery" value={data.deliveryOrders} sub="Door delivery orders" />
            <StatRow label="Pickup" value={data.pickupOrders} sub="In-store pickup" />
            <div className="flex justify-between pt-3">
              <p className="text-sm" style={{ color: 'var(--text)' }}>Avg. Order Value</p>
              <p className="font-display font-bold" style={{ color: 'var(--accent)' }}>{fmtUGX(data.averageOrderValue)}</p>
            </div>
          </div>

          {/* Customers & Messages */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl p-4 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="font-display font-bold text-2xl" style={{ color: 'var(--accent)' }}>{data.newCustomers}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text3)' }}>New Customers</p>
            </div>
            <div className="rounded-2xl p-4 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="font-display font-bold text-2xl" style={{ color: 'var(--purple)' }}>{data.totalMessages}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text3)' }}>Customer Messages</p>
            </div>
          </div>

          {/* Top products */}
          {data.topProducts.length > 0 && (
            <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text3)' }}>Top Products</p>
              {data.topProducts.map((p, i) => (
                <div key={i} className="flex items-center justify-between py-2.5"
                  style={{ borderBottom: i < data.topProducts.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                      style={{ background: i === 0 ? 'var(--amber)20' : 'var(--surface2)', color: i === 0 ? 'var(--amber)' : 'var(--text3)' }}>
                      {i + 1}
                    </span>
                    <p className="text-sm truncate max-w-[160px]" style={{ color: 'var(--text)' }}>{p.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono font-bold" style={{ color: 'var(--emerald)' }}>{fmtUGX(p.revenue)}</p>
                    <p className="text-[10px]" style={{ color: 'var(--text3)' }}>{p.count} sold</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {showClear && (
        <ClearModal
          onClose={() => setShowClear(false)}
          onCleared={() => { load(); }}
        />
      )}
    </div>
  );
}
