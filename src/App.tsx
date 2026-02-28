import { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { AdminNav, AdminTab } from './components/AdminNav';
import { HomeScreen } from './components/screens/Home';
import { OrdersScreen } from './components/screens/Orders';
import { ChatScreen } from './components/screens/Chat';
import { PaymentsScreen } from './components/screens/Payments';
import { ProductsScreen } from './components/screens/Products';
import { MediaLibrary } from './components/screens/MediaLibrary';
import { ReportsScreen } from './components/screens/Reports';
import { supabase } from './lib/supabase';
import { WifiOff } from 'lucide-react';

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

function useBadges(tab: AdminTab) {
  const [badges, setBadges] = useState<Partial<Record<AdminTab, number>>>({});

  const loadBadges = async () => {
    try {
      const [pending, unread, unpaid] = await Promise.all([
        supabase.from('orders').select('order_id', { count: 'exact', head: true }).eq('order_status', 'pending_confirmation'),
        supabase.from('messages').select('message_id', { count: 'exact', head: true }).eq('sender_type', 'customer').is('read_at', null),
        supabase.from('orders').select('order_id', { count: 'exact', head: true }).eq('payment_status', 'pending_payment').not('order_status', 'eq', 'cancelled'),
      ]);
      setBadges({
        orders: pending.count || 0,
        chat: unread.count || 0,
        payments: unpaid.count || 0,
      });
    } catch {}
  };

  useEffect(() => { loadBadges(); }, [tab]);

  useEffect(() => {
    const ch = supabase.channel('badges-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, loadBadges)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, loadBadges)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return badges;
}

export default function App() {
  const [authed, setAuthed] = useState(() => {
    try { return localStorage.getItem('tg_admin_auth') === '1'; } catch { return false; }
  });
  const [tab, setTab] = useState<AdminTab>('home');
  const online = useOnline();
  const badges = useBadges(tab);

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Offline banner */}
      {!online && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 py-2 text-xs font-bold"
          style={{ background: 'var(--rose)', color: 'white' }}>
          <WifiOff size={14} /> OFFLINE — Working with cached data
        </div>
      )}

      {/* Screen content — media screen gets full height for scrolling */}
      <div style={{ paddingTop: !online ? '32px' : '0', minHeight: '100vh' }}>
        {tab === 'home'     && <HomeScreen onNavigate={setTab} />}
        {tab === 'orders'   && <OrdersScreen />}
        {tab === 'chat'     && <ChatScreen />}
        {tab === 'payments' && <PaymentsScreen />}
        {tab === 'products' && <ProductsScreen />}
        {tab === 'reports'  && <ReportsScreen />}
        {tab === 'media'    && (
          <div className="flex flex-col pb-20" style={{ minHeight: '100vh' }}>
            <MediaLibrary />
          </div>
        )}
      </div>

      <AdminNav active={tab} onChange={setTab} badges={badges} />
    </div>
  );
}
