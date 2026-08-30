-- New-order confirmation/admin-notification emails (added in
-- app/api/order-confirm/route.ts) previously never fired at all -- the
-- templates orderConfirmationEmail() / newOrderAdminNotification() existed
-- in lib/email-templates.ts but nothing ever called them, so customers got
-- no "thank you for your order" email and admin got no "new order" email.
--
-- /api/order-confirm is called once from app/checkout/page.tsx right after
-- a COD order is placed, and again right after an online payment is
-- verified -- but it's a fire-and-forget `fetch(...).catch(() => {})` call,
-- so it can legitimately be retried by the browser (flaky network, user
-- double-tapping "Place order", etc). This column makes the email send
-- idempotent so a retry never results in the customer/admin getting the
-- same "order confirmed" email twice.
alter table public.orders
  add column if not exists confirmation_email_sent_at timestamptz;
