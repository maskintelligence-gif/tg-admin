import { useState, useEffect } from 'react';
import { Package, MessageCircle, DollarSign, Truck, TrendingUp, AlertTriangle, ChevronRight, Zap, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { AdminTab } from './AdminNav';

interface HomeProps {
  onNavigate: (tab: AdminTab) => void;
}

interface Stats {
  pendingOrders: number;
  pendingOrderIds: string[];
  unreadMessages: number;
  todayRevenue: number;
  todayOrders: number;
  activeDeliveries: number;
  lowStockCount: number;
  confirmedOrders: number;
}

function StatCard({ label, value, sub, color, Icon }: any) {
  return (
    <div className="rounded-2xl p-4 flex items-start justify-between"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div>
        <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text3)' }}>{label}</p>
        <p className="text-2xl font-display font-bold" style={{ color: 'var(--text)' }}>{value}</p>
        {sub && <p className="text-xs mt-1" style={{ color: 'var(--text2)' }}>{sub}</p>}
      </div>
      <div className="rounded-xl p-2.5" style={{ background: `${color}18` }}>
        <Icon size={18} style={{ color }} />
      </div>
    </div>
  );
}

function AlertCard({ icon: Icon, color, title, sub, onTap }: any) {
  return (
    <button onClick={onTap}
      className="w-full flex items-center gap-3 p-4 rounded-2xl transition-all active:scale-98 text-left"
      style={{ background: 'var(--surface2)', border: `1px solid var(--border)` }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}20`, border: `1px solid ${color}30` }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{title}</p>
        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text2)' }}>{sub}</p>
      </div>
      <ChevronRight size={16} style={{ color: 'var(--text3)' }} />
    </button>
  );
}

function fmtUGX(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

function now() {
  return new Date().toLocaleString('en-UG', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
}

export function HomeScreen({ onNavigate }: HomeProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState(now());

  useEffect(() => {
    const t = setInterval(() => setTime(now()), 30000);
    return () => clearInterval(t);
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const today = new Date(); today.setHours(0,0,0,0);

      const [ordersRes, msgsRes, delivRes, stockRes, confirmedRes] = await Promise.all([
        supabase.from('orders').select('order_id, order_number, order_status, total_amount, created_at').eq('order_status', 'pending_confirmation'),
        supabase.from('messages').select('message_id').eq('sender_type', 'customer').is('read_at', null),
        supabase.from('orders').select('order_id').eq('order_status', 'in_delivery'),
        supabase.from('products').select('product_id').lt('stock_quantity', 5).gt('stock_quantity', 0),
        supabase.from('orders').select('total_amount').eq('order_status', 'confirmed').gte('created_at', today.toISOString()),
      ]);

      // Today's all orders for revenue
      const { data: todayOrders } = await supabase.from('orders').select('total_amount, order_status')
        .gte('created_at', today.toISOString());

      const revenue = (todayOrders ?? []).reduce((s: number, o: any) => s + (o.total_amount || 0), 0);

      setStats({
        pendingOrders: ordersRes.data?.length ?? 0,
        pendingOrderIds: (ordersRes.data ?? []).map((o: any) => o.order_number).slice(0, 3),
        unreadMessages: msgsRes.data?.length ?? 0,
        todayRevenue: revenue,
        todayOrders: todayOrders?.length ?? 0,
        activeDeliveries: delivRes.data?.length ?? 0,
        lowStockCount: stockRes.data?.length ?? 0,
        confirmedOrders: confirmedRes.data?.length ?? 0,
      });
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Real-time: refresh on new orders
  useEffect(() => {
    const ch = supabase.channel('home-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="sticky top-0 z-40 px-4 pt-4 pb-3 flex items-center justify-between"
        style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--accent)' }}>
              <Zap size={14} color="white" fill="white" />
            </div>
            <h1 className="font-display font-bold text-lg" style={{ color: 'var(--text)' }}>TG Admin</h1>
          </div>
          <p className="text-xs mt-0.5 ml-9" style={{ color: 'var(--text3)' }}>{time}</p>
        </div>
        <button onClick={load} className="p-2 rounded-xl transition-all active:scale-90"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <RefreshCw size={16} style={{ color: 'var(--text2)' }} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="px-4 py-4 space-y-5">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Today's Revenue" value={`UGX ${fmtUGX(stats?.todayRevenue ?? 0)}`}
            sub={`${stats?.todayOrders ?? 0} orders placed`} color="var(--emerald)" Icon={TrendingUp} />
          <StatCard label="Pending Orders" value={stats?.pendingOrders ?? '—'}
            sub="Need confirmation" color="var(--amber)" Icon={Package} />
          <StatCard label="Unread Messages" value={stats?.unreadMessages ?? '—'}
            sub="From customers" color="var(--accent)" Icon={MessageCircle} />
          <StatCard label="In Delivery" value={stats?.activeDeliveries ?? '—'}
            sub="Active riders" color="var(--purple)" Icon={Truck} />
        </div>

        {/* Alerts */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} style={{ color: 'var(--amber)' }} />
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text2)' }}>
              Needs Attention
            </p>
          </div>
          <div className="space-y-2">
            {(stats?.pendingOrders ?? 0) > 0 && (
              <AlertCard
                icon={Package} color="var(--amber)"
                title={`${stats?.pendingOrders} Pending Order${stats?.pendingOrders !== 1 ? 's' : ''}`}
                sub={stats?.pendingOrderIds.join(', ') || 'Tap to confirm'}
                onTap={() => onNavigate('orders')}
              />
            )}
            {(stats?.unreadMessages ?? 0) > 0 && (
              <AlertCard
                icon={MessageCircle} color="var(--accent)"
                title={`${stats?.unreadMessages} Unread Message${stats?.unreadMessages !== 1 ? 's' : ''}`}
                sub="Customers waiting for a reply"
                onTap={() => onNavigate('chat')}
              />
            )}
            {(stats?.activeDeliveries ?? 0) > 0 && (
              <AlertCard
                icon={Truck} color="var(--purple)"
                title={`${stats?.activeDeliveries} Delivery In Route`}
                sub="Tap to view delivery status"
                onTap={() => onNavigate('orders')}
              />
            )}
            {(stats?.lowStockCount ?? 0) > 0 && (
              <AlertCard
                icon={AlertTriangle} color="var(--rose)"
                title={`${stats?.lowStockCount} Low Stock Item${stats?.lowStockCount !== 1 ? 's' : ''}`}
                sub="Less than 5 units remaining"
                onTap={() => onNavigate('products')}
              />
            )}
            {!loading && !stats?.pendingOrders && !stats?.unreadMessages && !stats?.activeDeliveries && !stats?.lowStockCount && (
              <div className="rounded-2xl p-5 text-center"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p className="text-sm" style={{ color: 'var(--text2)' }}>✓ All clear — no action needed</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text2)' }}>
            Quick Actions
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Confirm Orders', tab: 'orders', icon: Package, color: 'var(--amber)' },
              { label: 'Reply to Chats', tab: 'chat', icon: MessageCircle, color: 'var(--accent)' },
              { label: 'Mark Payments', tab: 'payments', icon: DollarSign, color: 'var(--emerald)' },
              { label: 'Add Product', tab: 'products', icon: Zap, color: 'var(--purple)' },
            ].map(({ label, tab, icon: Icon, color }) => (
              <button key={tab}
                onClick={() => onNavigate(tab as AdminTab)}
                className="flex items-center gap-2.5 p-3.5 rounded-2xl transition-all active:scale-95 text-left"
                style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${color}20` }}>
                  <Icon size={15} style={{ color }} />
                </div>
                <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
