import { useState, useEffect } from 'react';
import { TrendingUp, Package, MessageCircle, DollarSign, Loader2, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';

function fmtUGX(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString();
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

export function ReportsScreen() {
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

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

      // Top products
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

  const periodLabel = period === 'today' ? "Today" : period === 'week' ? 'Last 7 Days' : 'This Month';

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--bg)' }}>
      <div className="sticky top-0 z-40 pt-4 pb-2 px-4"
        style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <h1 className="font-display font-bold text-xl mb-3" style={{ color: 'var(--text)' }}>Reports</h1>
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
          {/* Hero card */}
          <div className="rounded-2xl p-5 text-center"
            style={{ background: 'linear-gradient(135deg, var(--surface) 0%, var(--surface2) 100%)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text3)' }}>
              {periodLabel} Revenue
            </p>
            <p className="font-display font-bold text-4xl mb-1" style={{ color: 'var(--emerald)' }}>
              UGX {fmtUGX(data.totalRevenue)}
            </p>
            <p className="text-sm" style={{ color: 'var(--text2)' }}>
              from {data.totalOrders} order{data.totalOrders !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Orders breakdown */}
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
              <p className="font-display font-bold" style={{ color: 'var(--accent)' }}>UGX {fmtUGX(data.averageOrderValue)}</p>
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
              <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text3)' }}>
                Top Products
              </p>
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
                    <p className="text-xs font-mono font-bold" style={{ color: 'var(--emerald)' }}>
                      {fmtUGX(p.revenue)}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text3)' }}>{p.count} sold</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
