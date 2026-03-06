const express = require('express');
const admin = require('firebase-admin');

const app = express();
app.use(express.json());

// ── Firebase Admin init ───────────────────────────────────────────────────────
// FIREBASE_SERVICE_ACCOUNT is injected as an env var from GitHub Secrets
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// ── Webhook secret (set this in your env too) ─────────────────────────────────
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'changeme';

// ── Helper: send FCM notification to all tokens ───────────────────────────────
async function sendToAll(tokens, title, body, data = {}) {
  if (!tokens || tokens.length === 0) {
    console.log('No tokens to send to');
    return;
  }

  const results = await Promise.allSettled(
    tokens.map((token) =>
      admin.messaging().send({
        token,
        notification: { title, body },
        data,
        android: {
          priority: 'high',
          notification: {
            channelId: 'tg_admin_alerts',
            sound: 'default',
            priority: 'high',
            defaultVibrateTimings: true,
          },
        },
      })
    )
  );

  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`Failed to send to token ${i}:`, r.reason?.message);
    } else {
      console.log(`✅ Sent to token ${i}`);
    }
  });
}

// ── Routes ────────────────────────────────────────────────────────────────────

// Health check
app.get('/', (req, res) => res.json({ status: 'TG Notification Server running' }));

// Register FCM token from device
app.post('/register-token', async (req, res) => {
  const { secret, token } = req.body;
  if (secret !== WEBHOOK_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  if (!token) return res.status(400).json({ error: 'token required' });

  try {
    // Store token in Supabase via REST
    const response = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/admin_devices`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({ fcm_token: token, updated_at: new Date().toISOString() }),
      }
    );
    if (!response.ok) throw new Error(await response.text());
    res.json({ success: true });
  } catch (e) {
    console.error('register-token error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Supabase webhook: new order
app.post('/webhook/new-order', async (req, res) => {
  const { secret, record } = req.body;
  if (secret !== WEBHOOK_SECRET) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const tokens = await getTokens();
    const order = record;
    await sendToAll(
      tokens,
      '🛒 New Order!',
      `Order ${order.order_number} — UGX ${Number(order.total_amount).toLocaleString()}`,
      { type: 'new_order', order_id: order.order_id, tab: 'orders' }
    );
    res.json({ success: true });
  } catch (e) {
    console.error('webhook/new-order error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Supabase webhook: new message
app.post('/webhook/new-message', async (req, res) => {
  const { secret, record } = req.body;
  if (secret !== WEBHOOK_SECRET) return res.status(401).json({ error: 'Unauthorized' });

  // Only notify for customer messages, not admin replies
  if (record.sender_type !== 'customer') return res.json({ skipped: true });

  try {
    const tokens = await getTokens();
    await sendToAll(
      tokens,
      '💬 New Message',
      record.content?.slice(0, 80) || 'New customer message',
      { type: 'new_message', conversation_id: record.conversation_id, tab: 'chat' }
    );
    res.json({ success: true });
  } catch (e) {
    console.error('webhook/new-message error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Supabase webhook: low stock
app.post('/webhook/low-stock', async (req, res) => {
  const { secret, record } = req.body;
  if (secret !== WEBHOOK_SECRET) return res.status(401).json({ error: 'Unauthorized' });

  // Only alert when stock drops below 5
  if (record.stock_quantity >= 5) return res.json({ skipped: true });

  try {
    const tokens = await getTokens();
    await sendToAll(
      tokens,
      '⚠️ Low Stock Alert',
      `${record.product_name} has only ${record.stock_quantity} units left`,
      { type: 'low_stock', product_id: record.product_id, tab: 'products' }
    );
    res.json({ success: true });
  } catch (e) {
    console.error('webhook/low-stock error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Helper: fetch all FCM tokens from Supabase ────────────────────────────────
async function getTokens() {
  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/admin_devices?select=fcm_token`,
    {
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
      },
    }
  );
  if (!response.ok) throw new Error('Failed to fetch tokens');
  const rows = await response.json();
  return rows.map((r) => r.fcm_token);
}

// ── Start (local dev) / Export (Vercel) ──────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`🔔 Notification server running on port ${PORT}`));
}

module.exports = app;
