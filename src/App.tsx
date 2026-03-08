import { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { AdminNav, AdminTab } from './components/AdminNav';
import { HomeScreen } from './components/screens/Home';
import { OrdersScreen } from './components/screens/Orders';
import { ChatScreen } from './components/screens/Chat';
import { PaymentsScreen } from './components/screens/Payments';
import { ProductsScreen } from './components/screens/Products';
import { MediaLibrary } from './components/screens/MediaLibrary';
import { Returns } from './components/screens/Returns';
import { ReportsScreen } from './components/screens/Reports';
import { supabase } from './lib/supabase';
import { useNotifications } from './lib/useNotifications';
import { WifiOff, Loader2 } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';

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
      const [pending, unread, unpaid, pendingReturns] = await Promise.all([
        supabase.from('orders').select('order_id', { count: 'exact', head: true }).eq('order_status', 'pending_confirmation'),
        supabase.from('messages').select('message_id', { count: 'exact', head: true }).eq('sender_type', 'customer').is('read_at', null),
        supabase.from('orders').select('order_id', { count: 'exact', head: true }).eq('payment_status', 'pending_payment').not('order_status', 'eq', 'cancelled'),
        supabase.from('return_requests').select('return_id', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);
      setBadges({
        orders: pending.count || 0,
        chat: unread.count || 0,
        payments: unpaid.count || 0,
        returns: pendingReturns.count || 0,
      });
    } catch {}
  };

  useEffect(() => { loadBadges(); }, [tab]);

  useEffect(() => {
    const ch = supabase.channel('badges-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, loadBadges)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, loadBadges)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'return_requests' }, loadBadges)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return badges;
}

export default function App() {
  // null = still checking, Session = logged in, false = not logged in
  const [session, setSession] = useState<Session | null | false>(null);
  const [tab, setTab] = useState<AdminTab>('home');
  const online = useOnline();
  const badges = useBadges(tab);

  // Only register for push notifications once we have a confirmed session
  useNotifications(
    session !== null && session !== false
      ? (data) => { if (data?.tab) setTab(data.tab as AdminTab); }
      : undefined
  );

  useEffect(() => {
    // Check for existing session on mount
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? false);
    });

    // Listen for login / logout / token refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Still checking session — show a neutral loading screen
  if (session === null) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <Loader2 size={28} style={{ color: 'var(--accent)' }} className="animate-spin" />
      </div>
    );
  }

  // Not authenticated — show login
  if (session === false) {
    return <Login onLogin={() => {}} />;
    // onLogin is a no-op: onAuthStateChange fires automatically after signIn
  }

  // Authenticated — show dashboard
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {!online && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 py-2 text-xs font-bold"
          style={{ background: 'var(--rose)', color: 'white' }}>
          <WifiOff size={14} /> OFFLINE — Working with cached data
        </div>
      )}

      <div style={{ paddingTop: !online ? '32px' : '0', minHeight: '100vh' }}>
        {tab === 'home'     && <HomeScreen onNavigate={setTab} />}
        {tab === 'orders'   && <OrdersScreen />}
        {tab === 'chat'     && <ChatScreen />}
        {tab === 'payments' && <PaymentsScreen />}
        {tab === 'products' && <ProductsScreen />}
        {tab === 'returns'  && <Returns />}
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
