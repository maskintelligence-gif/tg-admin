import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Loader2, MessageCircle, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Conversation {
  conversation_id: string;
  customer_id: string;
  last_message_preview: string;
  unread_count: number;
  updated_at: string;
  customers?: { name: string; phone: string };
}

interface Message {
  message_id: string;
  sender_type: 'customer' | 'admin';
  content: string;
  created_at: string;
  read_at: string | null;
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'yesterday';
  return `${days}d`;
}

// ─── Chat view ────────────────────────────────────────────────────────────────
function ChatView({ conv, onBack }: { conv: Conversation; onBack: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const c = conv.customers;

  const scrollDown = () => endRef.current?.scrollIntoView({ behavior: 'smooth' });

  const loadMessages = async () => {
    const { data } = await supabase.from('messages')
      .select('*').eq('conversation_id', conv.conversation_id)
      .order('created_at', { ascending: true }).limit(100);
    setMessages((data as Message[]) ?? []);
    setLoading(false);

    // Mark all customer messages as read
    await supabase.from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conv.conversation_id)
      .eq('sender_type', 'customer')
      .is('read_at', null);
  };

  useEffect(() => { loadMessages(); }, [conv.conversation_id]);
  useEffect(() => { scrollDown(); }, [messages]);

  // Real-time
  useEffect(() => {
    const ch = supabase.channel(`chat-${conv.conversation_id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${conv.conversation_id}`,
      }, (p) => {
        const msg = p.new as Message;
        setMessages(prev => prev.find(m => m.message_id === msg.message_id) ? prev : [...prev, msg]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conv.conversation_id]);

  const send = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    try {
      await supabase.from('messages').insert({
        conversation_id: conv.conversation_id,
        sender_type: 'admin',
        message_type: 'text',
        content: text,
      });
      // Update conversation last message
      await supabase.from('conversations').update({
        last_message_preview: text.slice(0, 100),
        updated_at: new Date().toISOString(),
        unread_count: 0,
      }).eq('conversation_id', conv.conversation_id);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col z-40" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <button onClick={onBack} className="p-2 rounded-xl active:scale-90"
          style={{ background: 'var(--surface2)' }}>
          <ArrowLeft size={18} style={{ color: 'var(--text)' }} />
        </button>
        <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
          style={{ background: 'var(--accent)', color: 'white' }}>
          {(c?.name || 'U')[0].toUpperCase()}
        </div>
        <div>
          <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{c?.name || 'Customer'}</p>
          <p className="text-xs" style={{ color: 'var(--text3)' }}>{c?.phone || ''}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={24} style={{ color: 'var(--accent)' }} className="animate-spin" />
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.message_id} className={`flex ${msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[80%] rounded-2xl px-4 py-3"
                style={{
                  background: msg.sender_type === 'admin' ? 'var(--accent)' : 'var(--surface)',
                  color: msg.sender_type === 'admin' ? 'white' : 'var(--text)',
                  borderBottomRightRadius: msg.sender_type === 'admin' ? '4px' : '16px',
                  borderBottomLeftRadius: msg.sender_type === 'customer' ? '4px' : '16px',
                  border: msg.sender_type === 'customer' ? '1px solid var(--border)' : 'none',
                }}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p className="text-[10px] mt-1" style={{ opacity: 0.6, textAlign: 'right' }}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {msg.sender_type === 'admin' && msg.read_at && ' ✓✓'}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {/* Quick replies */}
      <div className="px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar"
        style={{ borderTop: '1px solid var(--border)' }}>
        {['Your order is confirmed ✅', 'On the way 🛵', 'Ready for pickup 📦', 'Call us: 0700000000'].map(r => (
          <button key={r} onClick={() => setInput(r)}
            className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full transition-all active:scale-95"
            style={{ background: 'var(--surface2)', color: 'var(--text2)', border: '1px solid var(--border)' }}>
            {r}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="px-4 py-3 flex gap-2 safe-bottom"
        style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Reply to customer..."
          className="flex-1 px-4 py-2.5 rounded-xl text-sm focus:outline-none"
          style={{
            background: 'var(--surface2)', color: 'var(--text)',
            border: '1px solid var(--border)',
          }}
        />
        <button onClick={send} disabled={!input.trim() || sending}
          className="w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-90"
          style={{ background: input.trim() ? 'var(--accent)' : 'var(--surface2)' }}>
          {sending ? <Loader2 size={16} className="animate-spin" color="white" /> : <Send size={16} color="white" />}
        </button>
      </div>
    </div>
  );
}

// ─── Conversation list ────────────────────────────────────────────────────────
export function ChatScreen() {
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Conversation | null>(null);

  const load = async () => {
    const { data } = await supabase.from('conversations')
      .select('*, customers(name, phone)')
      .order('updated_at', { ascending: false })
      .limit(50);
    setConvs((data as Conversation[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const ch = supabase.channel('convs-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, load)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  if (selected) return <ChatView conv={selected} onBack={() => { setSelected(null); load(); }} />;

  const totalUnread = convs.reduce((s, c) => s + (c.unread_count || 0), 0);

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--bg)' }}>
      <div className="sticky top-0 z-40 pt-4 pb-3 px-4"
        style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <h1 className="font-display font-bold text-xl" style={{ color: 'var(--text)' }}>Messages</h1>
          {totalUnread > 0 && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: 'var(--rose)', color: 'white' }}>
              {totalUnread} unread
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} style={{ color: 'var(--accent)' }} className="animate-spin" />
        </div>
      ) : convs.length === 0 ? (
        <div className="text-center py-16">
          <MessageCircle size={40} style={{ color: 'var(--text3)' }} className="mx-auto mb-3" />
          <p style={{ color: 'var(--text2)' }}>No conversations yet</p>
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {convs.map(conv => {
            const c = conv.customers;
            const hasUnread = (conv.unread_count || 0) > 0;
            return (
              <button key={conv.conversation_id}
                onClick={() => setSelected(conv)}
                className="w-full flex items-center gap-3 px-4 py-4 transition-all active:scale-98 text-left"
                style={{ background: hasUnread ? 'rgba(37,99,235,0.05)' : 'transparent' }}>
                <div className="relative flex-shrink-0">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold"
                    style={{ background: 'var(--surface2)', color: 'var(--accent)', fontSize: '16px' }}>
                    {(c?.name || 'U')[0].toUpperCase()}
                  </div>
                  {hasUnread && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center"
                      style={{ background: 'var(--accent)', borderColor: 'var(--bg)' }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
                      {c?.name || 'Unknown'}
                    </p>
                    <span className="text-xs ml-2 flex-shrink-0" style={{ color: 'var(--text3)' }}>
                      {timeAgo(conv.updated_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs truncate" style={{ color: hasUnread ? 'var(--text)' : 'var(--text3)', fontWeight: hasUnread ? '500' : '400' }}>
                      {conv.last_message_preview || 'No messages yet'}
                    </p>
                    {hasUnread && (
                      <span className="ml-2 flex-shrink-0 text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: 'var(--accent)', color: 'white' }}>
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
