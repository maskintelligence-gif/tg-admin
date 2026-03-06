-- ─────────────────────────────────────────────────────────────────────────────
-- TG Admin — Supabase Notification Triggers
-- Run this entire file in Supabase SQL Editor
-- Replace YOUR_SERVER_URL and YOUR_WEBHOOK_SECRET with your actual values
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable pg_net extension (skip if already enabled)
create extension if not exists pg_net;

-- ── 1. New order notification ─────────────────────────────────────────────────

create or replace function notify_new_order()
returns trigger language plpgsql as $$
begin
  -- Only fire on INSERT of a new pending order
  if TG_OP = 'INSERT' and NEW.order_status = 'pending_confirmation' then
    perform net.http_post(
      url     := 'tg-admin-lovat.vercel.app/webhook/new-order',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body    := json_build_object(
        'secret', 'tg-admin-secret-2026',
        'record', row_to_json(NEW)
      )::text
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists on_new_order on orders;
create trigger on_new_order
  after insert on orders
  for each row execute procedure notify_new_order();


-- ── 2. New customer message notification ──────────────────────────────────────

create or replace function notify_new_message()
returns trigger language plpgsql as $$
begin
  -- Only notify for customer messages, not admin replies
  if NEW.sender_type = 'customer' then
    perform net.http_post(
      url     := 'tg-admin-lovat.vercel.app/webhook/new-message',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body    := json_build_object(
        'secret', 'tg-admin-secret-2026',
        'record', row_to_json(NEW)
      )::text
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists on_new_message on messages;
create trigger on_new_message
  after insert on messages
  for each row execute procedure notify_new_message();


-- ── 3. Low stock notification ─────────────────────────────────────────────────

create or replace function notify_low_stock()
returns trigger language plpgsql as $$
begin
  -- Fire when stock drops below 5 and wasn't below 5 before
  if NEW.stock_quantity < 5 and OLD.stock_quantity >= 5 then
    perform net.http_post(
      url     := 'tg-admin-lovat.vercel.app/webhook/low-stock',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body    := json_build_object(
        'secret', 'tg-admin-secret-2026',
        'record', row_to_json(NEW)
      )::text
    );
  end if;
  return NEW;
end;
$$;

drop trigger if exists on_low_stock on products;
create trigger on_low_stock
  after update on products
  for each row execute procedure notify_low_stock();


-- ── Verify triggers were created ──────────────────────────────────────────────
select trigger_name, event_object_table, action_timing, event_manipulation
from information_schema.triggers
where trigger_name in ('on_new_order', 'on_new_message', 'on_low_stock');
