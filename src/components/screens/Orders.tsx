import { useState, useEffect } from 'react';
import { Package, ChevronRight, ChevronDown, Phone, MapPin, User, Clock, CheckCircle2, Truck, Store, Loader2, X, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type OrderStatus = 'pending_confirmation' | 'confirmed' | 'in_delivery' | 'ready_for_pickup' | 'complete' | 'cancelled';

interface Order {
  order_id: string;
  order_number: string;
  customer_id: string;
  fulfillment_type: 'delivery' | 'pickup';
  order_items: any[];
  subtotal: number;
  delivery_fee: number;
  total_amount: number;
  order_status: OrderStatus;
  payment_status: string;
  delivery_location: string;
  created_at: string;
  customers?: { name: string; phone: string };
}

const STATUS_TABS: { id: OrderStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pending_confirmation', label: 'Pending' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'in_delivery', label: 'In Delivery' },
  { id: 'complete', label: 'Done' },
];

const STATUS_COLOR: Record<string, string> = {
  pending_confirmation: 'var(--amber)',
  confirmed: 'var(--accent)',
  in_delivery: 'var(--purple)',
  ready_for_pickup: 'var(--accent)',
  complete: 'var(--emerald)',
  cancelled: 'var(--rose)',
};

const STATUS_LABEL: Record<string, string> = {
  pending_confirmation: 'Pending',
  confirmed: 'Confirmed',
  in_delivery: 'In Delivery',
  ready_for_pickup: 'Ready Pickup',
  complete: 'Complete',
  cancelled: 'Cancelled',
};

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Order Detail Modal ───────────────────────────────────────────────────────
function OrderModal({ order, onClose, onStatusChange }: { order: Order; onClose: () => void; onStatusChange: () => void }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  const updateStatus = async (newStatus: OrderStatus, msg?: string) => {
    setLoading(true);
    setSuccess('');
    try {
      const { error: updateError } = await supabase
        .from('orders')
        .update({ order_status: newStatus })
        .eq('order_id', order.order_id);

      if (updateError) throw new Error(updateError.message);

      // If confirming — send receipt message to chat
      if (newStatus === 'confirmed') {
        const { data: conv } = await supabase.from('conversations')
          .select('conversation_id').eq('customer_id', order.customer_id).maybeSingle();
        if (conv) {
          const receipt = `✅ *Order Confirmed!*\n\nOrder: ${order.order_number}\nTotal: UGX ${order.total_amount.toLocaleString()}\nFulfillment: ${order.fulfillment_type === 'delivery' ? 'Door Delivery' : 'In-Store Pickup'}\n\nThank you! We'll be in touch shortly.`;
          await supabase.from('messages').insert({
            conversation_id: conv.conversation_id,
            sender_type: 'admin',
            message_type: 'text',
            content: receipt,
          });
        }
      }

      setSuccess(msg || 'Updated!');
      setTimeout(() => { onStatusChange(); onClose(); }, 1200);
    } catch(e) {
      console.error('updateStatus error:', e);
      setSuccess('Error: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const c = order.customers;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="rounded-t-3xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up"
        style={{ background: 'var(--surface)' }}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border2)' }} />
        </div>

        <div className="overflow-y-auto pb-8 px-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display font-bold text-xl" style={{ color: 'var(--accent)' }}>
                {order.order_number}
              </p>
              <p className="text-xs" style={{ color: 'var(--text3)' }}>{timeAgo(order.created_at)}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl" style={{ background: 'var(--surface2)' }}>
              <X size={18} style={{ color: 'var(--text2)' }} />
            </button>
          </div>

          {/* Customer */}
          <div className="rounded-2xl p-4 space-y-2" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text3)' }}>Customer</p>
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
              <User size={14} style={{ color: 'var(--text3)' }} />{c?.name || 'Unknown'}
            </div>
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
              <Phone size={14} style={{ color: 'var(--text3)' }} />
              <a href={`tel:${c?.phone}`} style={{ color: 'var(--accent)' }}>{c?.phone}</a>
            </div>
            {order.delivery_location && (
              <div className="flex items-start gap-2 text-sm" style={{ color: 'var(--text)' }}>
                <MapPin size={14} style={{ color: 'var(--text3)' }} className="mt-0.5 flex-shrink-0" />
                {order.delivery_location}
              </div>
            )}
          </div>

          {/* Items */}
          <div className="rounded-2xl p-4" style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text3)' }}>Items</p>
            {order.order_items?.map((item: any, i: number) => (
              <div key={i} className="flex justify-between py-2" style={{ borderBottom: i < order.order_items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{item.product_name}</p>
                  <p className="text-xs" style={{ color: 'var(--text3)' }}>× {item.quantity}</p>
                </div>
                <p className="text-sm font-mono font-medium" style={{ color: 'var(--text)' }}>
                  {(item.subtotal || 0).toLocaleString()}
                </p>
              </div>
            ))}
            <div className="pt-3 mt-1 space-y-1.5">
              <div className="flex justify-between text-sm" style={{ color: 'var(--text2)' }}>
                <span>Subtotal</span><span className="font-mono">{order.subtotal?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm" style={{ color: 'var(--text2)' }}>
                <span>Delivery fee</span><span className="font-mono">{order.delivery_fee === 0 ? 'FREE' : order.delivery_fee?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold text-base" style={{ color: 'var(--text)', borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}>
                <span>TOTAL</span><span className="font-mono" style={{ color: 'var(--emerald)' }}>UGX {order.total_amount?.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Fulfillment */}
          <div className="flex items-center gap-3 rounded-2xl p-4"
            style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
            {order.fulfillment_type === 'delivery' ? <Truck size={18} style={{ color: 'var(--purple)' }} /> : <Store size={18} style={{ color: 'var(--accent)' }} />}
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{order.fulfillment_type === 'delivery' ? 'Door Delivery' : 'In-Store Pickup'}</p>
              <p className="text-xs" style={{ color: 'var(--text3)' }}>Cash on {order.fulfillment_type === 'delivery' ? 'delivery' : 'pickup'}</p>
            </div>
          </div>

          {/* Success / Error */}
          {success && (
            <div className="flex items-center gap-2 rounded-2xl p-4"
              style={{
                background: success.startsWith('Error') ? 'rgba(244,63,94,0.15)' : '#10b98120',
                border: `1px solid ${success.startsWith('Error') ? 'var(--rose)' : 'var(--emerald)'}`,
              }}>
              {success.startsWith('Error')
                ? <AlertTriangle size={18} style={{ color: 'var(--rose)' }} />
                : <CheckCircle2 size={18} style={{ color: 'var(--emerald)' }} />}
              <p className="text-sm font-medium"
                style={{ color: success.startsWith('Error') ? 'var(--rose)' : 'var(--emerald)' }}>
                {success}
              </p>
            </div>
          )}

          {/* Action buttons based on status */}
          {order.order_status === 'pending_confirmation' && (
            <button onClick={() => updateStatus('confirmed', 'Order confirmed & receipt sent!')}
              disabled={loading}
              className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-98"
              style={{ background: 'var(--accent)', color: 'white', opacity: loading ? 0.7 : 1 }}>
              {loading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
              Confirm & Send Receipt
            </button>
          )}

          {order.order_status === 'confirmed' && order.fulfillment_type === 'delivery' && (
            <button onClick={() => updateStatus('in_delivery', 'Marked as In Delivery!')}
              disabled={loading}
              className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-98"
              style={{ background: 'var(--purple)', color: 'white', opacity: loading ? 0.7 : 1 }}>
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Truck size={18} />}
              Mark In Delivery
            </button>
          )}

          {order.order_status === 'confirmed' && order.fulfillment_type === 'pickup' && (
            <button onClick={() => updateStatus('ready_for_pickup', 'Marked as Ready!')}
              disabled={loading}
              className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-98"
              style={{ background: 'var(--accent)', color: 'white', opacity: loading ? 0.7 : 1 }}>
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Store size={18} />}
              Mark Ready for Pickup
            </button>
          )}

          {(order.order_status === 'in_delivery' || order.order_status === 'ready_for_pickup') && (
            <button onClick={() => updateStatus('complete', 'Order complete!')}
              disabled={loading}
              className="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-98"
              style={{ background: 'var(--emerald)', color: 'white', opacity: loading ? 0.7 : 1 }}>
              {loading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
              Mark Complete
            </button>
          )}

          {!['complete', 'cancelled'].includes(order.order_status) && (
            <button onClick={() => updateStatus('cancelled', 'Order cancelled.')}
              disabled={loading}
              className="w-full py-3 rounded-2xl font-medium text-sm flex items-center justify-center gap-2"
              style={{ background: 'transparent', color: 'var(--rose)', border: '1px solid var(--rose)33' }}>
              Cancel Order
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Order Card ───────────────────────────────────────────────────────────────
function OrderCard({ order, onTap }: { order: Order; onTap: () => void }) {
  const color = STATUS_COLOR[order.order_status] || 'var(--text2)';
  const label = STATUS_LABEL[order.order_status] || order.order_status;
  const itemCount = order.order_items?.reduce((s: number, i: any) => s + i.quantity, 0) ?? 0;

  return (
    <button onClick={onTap}
      className="w-full text-left rounded-2xl p-4 flex items-center gap-3 transition-all active:scale-98"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}18` }}>
        <Package size={18} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <p className="font-display font-bold" style={{ color: 'var(--accent)', fontSize: '15px' }}>
            {order.order_number}
          </p>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: `${color}20`, color }}>
            {label}
          </span>
        </div>
        <p className="text-sm truncate" style={{ color: 'var(--text)' }}>
          {order.customers?.name || 'Unknown customer'}
        </p>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs font-mono font-medium" style={{ color: 'var(--emerald)' }}>
            UGX {order.total_amount?.toLocaleString()}
          </span>
          <span className="text-xs" style={{ color: 'var(--text3)' }}>{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
          <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text3)' }}>
            <Clock size={10} />{timeAgo(order.created_at)}
          </span>
        </div>
      </div>
      <ChevronRight size={16} style={{ color: 'var(--text3)' }} />
    </button>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export function OrdersScreen() {
  const [activeTab, setActiveTab] = useState<OrderStatus | 'all'>('pending_confirmation');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Order | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      let q = supabase.from('orders')
        .select('*, customers(name, phone)')
        .order('created_at', { ascending: false })
        .limit(50);
      if (activeTab !== 'all') q = q.eq('order_status', activeTab);
      const { data } = await q;
      setOrders((data as Order[]) ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [activeTab]);

  useEffect(() => {
    const ch = supabase.channel('orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeTab]);

  const counts = orders.reduce((acc: any, o) => { acc[o.order_status] = (acc[o.order_status] || 0) + 1; return acc; }, {});

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--bg)' }}>
      <div className="sticky top-0 z-40 pt-4 pb-2 px-4"
        style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <h1 className="font-display font-bold text-xl mb-3" style={{ color: 'var(--text)' }}>Orders</h1>

        {/* Status tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {STATUS_TABS.map(({ id, label }) => {
            const isActive = activeTab === id;
            const count = id === 'all' ? orders.length : counts[id] || 0;
            return (
              <button key={id} onClick={() => setActiveTab(id)}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                style={{
                  background: isActive ? 'var(--accent)' : 'var(--surface)',
                  color: isActive ? 'white' : 'var(--text2)',
                  border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                }}>
                {label}
                {count > 0 && <span className="font-mono">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 py-3 space-y-2">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} style={{ color: 'var(--accent)' }} className="animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <Package size={40} style={{ color: 'var(--text3)' }} className="mx-auto mb-3" />
            <p style={{ color: 'var(--text2)' }}>No orders found</p>
          </div>
        ) : (
          orders.map(order => (
            <OrderCard key={order.order_id} order={order} onTap={() => setSelected(order)} />
          ))
        )}
      </div>

      {selected && (
        <OrderModal
          order={selected}
          onClose={() => setSelected(null)}
          onStatusChange={() => { setSelected(null); load(); }}
        />
      )}
    </div>
  );
}
