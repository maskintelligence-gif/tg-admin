import { useState, useEffect } from 'react';
import { DollarSign, CheckCircle2, Loader2, TrendingUp, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Order {
  order_id: string;
  order_number: string;
  order_status: string;
  payment_status: string;
  total_amount: number;
  fulfillment_type: string;
  created_at: string;
  customers?: { name: string; phone: string };
}

function fmtUGX(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M UGX`;
  return `${n.toLocaleString()} UGX`;
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `${Math.floor(diff / 60000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function PaymentsScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState<string | null>(null);
  const [tab, setTab] = useState<'unpaid' | 'paid'>('unpaid');

  const load = async () => {
    setLoading(true);
    try {
      const statusFilter = tab === 'unpaid' ? 'pending_payment' : 'paid';
      const { data } = await supabase.from('orders')
        .select('*, customers(name, phone)')
        .eq('payment_status', statusFilter)
        .not('order_status', 'eq', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(50);
      setOrders((data as Order[]) ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tab]);

  const markPaid = async (order: Order) => {
    setMarking(order.order_id);
    try {
      await supabase.from('orders')
        .update({ payment_status: 'paid', order_status: order.order_status === 'in_delivery' || order.order_status === 'ready_for_pickup' ? 'complete' : order.order_status })
        .eq('order_id', order.order_id);

      // Insert payment record
      await supabase.from('payments').insert({
        order_id: order.order_id,
        amount: order.total_amount,
        payment_method: order.fulfillment_type === 'delivery' ? 'cash_on_delivery' : 'cash_at_shop',
        payment_status: 'received',
      });

      setOrders(prev => prev.filter(o => o.order_id !== order.order_id));
    } catch(e) {
      console.error(e);
    } finally {
      setMarking(null);
    }
  };

  const totalUnpaid = orders.filter(o => tab === 'unpaid').reduce((s, o) => s + o.total_amount, 0);

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--bg)' }}>
      <div className="sticky top-0 z-40 pt-4 pb-2 px-4"
        style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <h1 className="font-display font-bold text-xl mb-3" style={{ color: 'var(--text)' }}>Payments</h1>

        <div className="flex gap-2">
          {(['unpaid', 'paid'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-2 rounded-xl text-sm font-bold transition-all"
              style={{
                background: tab === t ? 'var(--accent)' : 'var(--surface)',
                color: tab === t ? 'white' : 'var(--text2)',
                border: `1px solid ${tab === t ? 'var(--accent)' : 'var(--border)'}`,
              }}>
              {t === 'unpaid' ? '⏳ Unpaid' : '✅ Paid'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Summary card for unpaid */}
        {tab === 'unpaid' && totalUnpaid > 0 && (
          <div className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: 'var(--surface)', border: '1px solid var(--amber)33' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--amber)20' }}>
              <TrendingUp size={18} style={{ color: 'var(--amber)' }} />
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text3)' }}>Total Outstanding</p>
              <p className="font-display font-bold text-lg" style={{ color: 'var(--amber)' }}>
                {fmtUGX(totalUnpaid)}
              </p>
              <p className="text-xs" style={{ color: 'var(--text3)' }}>
                {orders.length} order{orders.length !== 1 ? 's' : ''} pending payment
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} style={{ color: 'var(--accent)' }} className="animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle2 size={40} style={{ color: tab === 'paid' ? 'var(--emerald)' : 'var(--text3)' }} className="mx-auto mb-3" />
            <p style={{ color: 'var(--text2)' }}>
              {tab === 'paid' ? 'No payments recorded yet' : 'All payments collected!'}
            </p>
          </div>
        ) : (
          orders.map(order => (
            <div key={order.order_id} className="rounded-2xl p-4"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-display font-bold" style={{ color: 'var(--accent)' }}>
                    {order.order_number}
                  </p>
                  <p className="text-sm" style={{ color: 'var(--text)' }}>
                    {order.customers?.name || 'Unknown'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--surface2)', color: 'var(--text3)' }}>
                      {order.fulfillment_type === 'delivery' ? '🛵 Delivery' : '🏪 Pickup'}
                    </span>
                    <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text3)' }}>
                      <Clock size={10} />{timeAgo(order.created_at)}
                    </span>
                  </div>
                </div>
                <p className="font-display font-bold text-lg" style={{ color: 'var(--emerald)' }}>
                  {fmtUGX(order.total_amount)}
                </p>
              </div>

              {tab === 'unpaid' && (
                <button
                  onClick={() => markPaid(order)}
                  disabled={marking === order.order_id}
                  className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-98"
                  style={{ background: 'var(--emerald)', color: 'white', opacity: marking === order.order_id ? 0.7 : 1 }}>
                  {marking === order.order_id
                    ? <><Loader2 size={16} className="animate-spin" /> Marking...</>
                    : <><CheckCircle2 size={16} /> Mark as Paid</>}
                </button>
              )}

              {tab === 'paid' && (
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--emerald)' }}>
                  <CheckCircle2 size={14} />
                  Payment received
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
