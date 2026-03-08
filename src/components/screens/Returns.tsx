"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { RotateCcw, ChevronDown, ChevronUp, Loader2, CheckCircle2, XCircle, Clock, RefreshCw, Trash2 } from 'lucide-react';

interface ReturnItem {
  product_name: string;
  quantity: number;
  subtotal: number;
}

interface ReturnRequest {
  return_id: string;
  order_id: string;
  customer_id: string;
  order_number: string;
  items: ReturnItem[];
  reason: string;
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   color: 'bg-amber-100 text-amber-700',   icon: Clock },
  approved:  { label: 'Approved',  color: 'bg-blue-100 text-blue-700',     icon: CheckCircle2 },
  rejected:  { label: 'Rejected',  color: 'bg-red-100 text-red-700',       icon: XCircle },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
};

function ReturnCard({ req, onUpdate, onDelete }: { req: ReturnRequest; onUpdate: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [adminNotes, setAdminNotes] = useState(req.admin_notes ?? '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const cfg = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;

  const handleDelete = async () => {
    if (!confirm(`Delete return request ${req.order_number}? This cannot be undone.`)) return;
    setDeleting(true);
    const { error } = await supabase.from('return_requests').delete().eq('return_id', req.return_id);
    if (error) { alert('Delete failed: ' + error.message); setDeleting(false); return; }
    onDelete();
  };
  const date = new Date(req.created_at).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const [saveError, setSaveError] = useState('');

  const updateStatus = async (status: ReturnRequest['status']) => {
    setSaving(true);
    setSaveError('');
    try {
      // Step 1: update return request status
      const { error } = await supabase
        .from('return_requests')
        .update({ status, admin_notes: adminNotes || null })
        .eq('return_id', req.return_id);
      if (error) throw new Error(`Status update failed: ${error.message}`);

      // Step 2: send chat message for approved / rejected
      if (status === 'approved' || status === 'rejected') {
        const { data: conv, error: convErr } = await supabase
          .from('conversations')
          .select('conversation_id')
          .eq('customer_id', req.customer_id)
          .maybeSingle();

        if (convErr) throw new Error(`Conversation lookup failed: ${convErr.message}`);
        if (!conv) throw new Error(`No chat conversation found for customer_id: ${req.customer_id}. Customer must open chat first.`);

        const itemList = req.items.map(i => `• ${i.product_name} ×${i.quantity}`).join('\n');
        const message = status === 'approved'
          ? `✅ *Return Request Approved!*\n\nYour return request for order ${req.order_number} has been approved.\n\nItems:\n${itemList}\n\nPlease bring the item(s) to our store or contact us to arrange a pickup. Your refund will be processed within 5–7 business days after we receive the items.${adminNotes ? `\n\nNote: ${adminNotes}` : ''}`
          : `❌ *Return Request Rejected*\n\nUnfortunately your return request for order ${req.order_number} could not be approved.\n\nItems:\n${itemList}${adminNotes ? `\n\nReason: ${adminNotes}` : "\n\nIf you have questions, please reply to this message and we'll be happy to help."}`;

        const { error: msgErr } = await supabase.from('messages').insert({
          conversation_id: conv.conversation_id,
          sender_type: 'admin',
          message_type: 'text',
          content: message,
        });
        if (msgErr) throw new Error(`Message insert failed: ${msgErr.message}`);
      }

      onUpdate();
    } catch (err) {
      setSaveError((err as Error).message);
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-50 rounded-lg flex-shrink-0">
              <RotateCcw size={16} className="text-rose-500" />
            </div>
            <div>
              <p className="font-black text-blue-600 text-base tracking-tight">{req.order_number}</p>
              <p className="text-xs text-gray-400">{date} · {time}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${cfg.color}`}>
              <Icon size={11} />
              {cfg.label}
            </span>
            <button onClick={handleDelete} disabled={deleting}
              className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40">
              {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            </button>
            <button onClick={() => setExpanded(!expanded)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {/* Quick summary */}
        <div className="mt-3 flex gap-4 text-xs text-gray-500">
          <span><span className="font-semibold text-gray-700">{req.items.length}</span> item type{req.items.length !== 1 ? 's' : ''}</span>
          <span>·</span>
          <span className="truncate max-w-[200px]">{req.reason}</span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-4">
          {/* Items */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Items requested</p>
            <div className="space-y-2">
              {req.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 font-medium">{item.product_name}</span>
                  <span className="text-gray-400">× {item.quantity} · UGX {item.subtotal?.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Reason & Notes */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Reason</p>
            <p className="text-sm text-gray-700">{req.reason}</p>
          </div>
          {req.notes && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Customer notes</p>
              <p className="text-sm text-gray-600 bg-white rounded-lg p-3 border border-gray-200">{req.notes}</p>
            </div>
          )}

          {/* Admin notes */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Admin notes</p>
            <textarea
              value={adminNotes}
              onChange={e => setAdminNotes(e.target.value)}
              placeholder="Add internal notes..."
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none transition-colors"
            />
          </div>

          {saveError && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 mt-1">
              ⚠️ {saveError}
            </div>
          )}

          {/* Actions */}
          {req.status === 'pending' && (
            <div className="flex gap-2 pt-1">
              <button onClick={() => updateStatus('approved')} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors disabled:opacity-50">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                Approve
              </button>
              <button onClick={() => updateStatus('rejected')} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-sm border border-red-200 transition-colors disabled:opacity-50">
                <XCircle size={15} />
                Reject
              </button>
            </div>
          )}
          {req.status === 'approved' && (
            <button onClick={() => updateStatus('completed')} disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors disabled:opacity-50">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              Mark as Completed
            </button>
          )}
          {(req.status === 'rejected' || req.status === 'completed') && (
            <button onClick={() => updateStatus('pending')} disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-100 font-medium text-sm transition-colors disabled:opacity-50">
              <RefreshCw size={14} />
              Reopen
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function Returns() {
  const [requests, setRequests] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | ReturnRequest['status']>('all');

  const fetch = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('return_requests')
        .select('*')
        .order('created_at', { ascending: false });
      setRequests((data as ReturnRequest[]) ?? []);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, []);

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);
  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="p-6 max-w-3xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Returns</h1>
          {pendingCount > 0 && (
            <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full">
              {pendingCount} pending
            </span>
          )}
        </div>
        <button onClick={fetch} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 overflow-x-auto">
        {(['all', 'pending', 'approved', 'rejected', 'completed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {f === 'all' ? `All (${requests.length})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${requests.filter(r => r.status === f).length})`}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={32} className="animate-spin text-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <RotateCcw size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No {filter === 'all' ? '' : filter} return requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => (
            <ReturnCard key={req.return_id} req={req} onUpdate={fetch} onDelete={fetch} />
          ))}
        </div>
      )}
    </div>
  );
}
