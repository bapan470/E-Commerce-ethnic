ADMIN ORDERS — REFUND STATUS BADGE
====================================

2 files, matching your repo's folder structure. Copy each into the same
path in your project (overwrite the existing ones), then `git push`.

WHAT THIS SOLVES
----------------
Your admin Orders table showed "cancelled" as the order status, but
nothing about whether the online payment behind it was actually
refunded yet. This adds a small "Refund: ..." badge right under the
Status dropdown on every order row.

1. lib/orders-api.ts (MODIFIED)
   Your DB already tracks refund status in two separate places, and
   this just reads both instead of ignoring them:
     - orders.refund_status — set automatically when a customer
       self-cancels a paid online order (app/api/orders/[id]/cancel).
     - returns.refund_status — set when a RETURN/exchange's refund is
       processed (app/api/admin/returns/[id]/refund, or the return
       automation cron). This is a SEPARATE table row, linked by
       order_id, so it was never showing up on the Orders page at all.
   fetchOrders() now also looks up each order's most recent linked
   return (if any) and attaches its status/refund_status.

2. components/admin/orders-panel.tsx (MODIFIED)
   Renders the badge. Logic: if this order has a linked return, show
   THAT return's refund_status (it's the current/relevant one); else
   fall back to the order's own refund_status (the cancellation path).
   Nothing shows for COD orders, orders that were never paid online,
   or once refund_status is genuinely "not_applicable"/null.

WHAT THE BADGE WILL SAY
------------------------
  Refund: Pending           — refund initiated, not yet confirmed
  Refund: Processing        — return refund actively being processed
  Refund: Manual Pending    — auto-refund is off / failed once;
                               needs the admin to process it by hand
                               (returns: use the "Process Refund Now"
                               button on that return; cancellations:
                               currently no in-app retry — see note below)
  Refund: Refunded          — done, money back with the customer
  Refund: Failed            — the automatic Razorpay refund call
                               failed; needs manual handling

NOTE — one gap this does NOT fix
---------------------------------
For a CANCELLED order (not a return) whose refund_status is "failed"
or "pending_manual", there's currently no button in the admin Orders
panel to retry that refund from here — you'd need the Razorpay
dashboard, or to build a small "Retry Refund" action (same pattern as
the returns panel already has). This change only adds VISIBILITY of
the status; say the word if you also want a retry button added for the
cancellation path.

VERIFIED
--------
Ran `tsc --noEmit` (full project type-check) after these changes —
0 errors.
