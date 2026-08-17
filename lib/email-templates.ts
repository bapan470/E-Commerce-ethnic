import { formatINR } from './format';

const BRAND_COLOR = '#7c3a1d';
const BRAND_COLOR_DARK = '#5c2a14';
const GOLD_ACCENT = '#c9a15a';
const SITE_NAME = 'AruhiHandlooms';

// Shared shell for every transactional email in the app. Redesigned to
// look like an actual boutique brand sent it (full html/body doc so
// clients never fall back to a default white/grey canvas around the
// card, a proper wordmark + gold rule instead of a flat colour bar, a
// bordered/rounded "card" for the body, and a real footer with an
// address/GSTIN line + support contact instead of one throwaway
// sentence) -- this is what previously made every email in the app
// (not just the COD->prepaid one) read as generic/templated enough that
// a customer could reasonably mistake it for spam.
function wrapper(
  bodyHtml: string,
  opts: { footerNote?: string; store?: { address?: string; gstin?: string; support_email?: string; support_phone?: string } } = {}
) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
  const store = opts.store;
  const footerNote = opts.footerNote || `You're receiving this email because of a recent activity on your ${SITE_NAME} account.`;
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${SITE_NAME}</title>
  </head>
  <body style="margin:0; padding:0; background:#f2ebe3; font-family: Georgia, 'Times New Roman', serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2ebe3; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px; max-width:100%; background:#ffffff; border-radius:10px; overflow:hidden; border:1px solid #ecdfd2; box-shadow: 0 2px 10px rgba(92,42,20,0.06);">
            <tr>
              <td style="background:linear-gradient(135deg, ${BRAND_COLOR} 0%, ${BRAND_COLOR_DARK} 100%); padding: 30px 24px; text-align:center;">
                <div style="font-family: Georgia, 'Times New Roman', serif; color:#fff; font-size: 24px; font-weight:bold; letter-spacing: 0.08em; text-transform: uppercase;">${SITE_NAME}</div>
                <div style="margin: 6px auto 0; width: 48px; border-top: 2px solid ${GOLD_ACCENT};"></div>
                <div style="margin-top: 8px; color: rgba(255,255,255,0.75); font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;">Handwoven Ethnic Wear</div>
              </td>
            </tr>
            <tr>
              <td style="padding: 32px 32px 28px; background:#fffaf5; color:#2b2320; font-size: 15px; line-height: 1.6;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding: 20px 32px; background:#fbf6f0; border-top: 1px solid #ecdfd2;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size: 12px; color: #8a7c72; line-height: 1.6;">
                      ${
                        store?.support_email || store?.support_phone
                          ? `<p style="margin:0 0 6px;">Need help? <strong style="color:${BRAND_COLOR};">${
                              store?.support_email ? `Email <a href="mailto:${store.support_email}" style="color:${BRAND_COLOR};">${store.support_email}</a>` : ''
                            }${store?.support_email && store?.support_phone ? ' or ' : ''}${
                              store?.support_phone ? `call ${store.support_phone}` : ''
                            }</strong></p>`
                          : ''
                      }
                      <p style="margin:0 0 6px;">${footerNote}</p>
                      ${store?.address ? `<p style="margin:0 0 4px;">${store.address}</p>` : ''}
                      ${store?.gstin ? `<p style="margin:0 0 4px;">GSTIN: ${store.gstin}</p>` : ''}
                      <p style="margin:8px 0 0; color:#a89a8f;">© ${year} ${SITE_NAME}. All rights reserved.${siteUrl ? ` · <a href="${siteUrl}" style="color:#a89a8f;">${siteUrl.replace(/^https?:\/\//, '')}</a>` : ''}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function itemsTable(items: any[]) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
  const rows = (items || [])
    .map((it) => {
      const img = it.image_url || it.image || it.images?.[0] || '';
      const thumb = img
        ? `<img src="${img}" alt="" width="52" height="52" style="width:52px; height:52px; object-fit:cover; border-radius:8px; border:1px solid #ecdfd2; display:block;" />`
        : `<div style="width:52px; height:52px; border-radius:8px; background:#f1e9e2;"></div>`;
      // Links straight to the exact colour/variant the customer bought
      // (it.slug is the variant's own SEO slug, saved on the order item at
      // checkout) rather than a generic product page, so "click the item"
      // from an email always opens what was actually ordered.
      const productUrl = it.slug ? `${siteUrl}/product/${it.slug}` : null;
      const name = `${it.product_name || it.name || 'Item'}${it.size ? ` <span style="color:#9a8f87; font-size:12px;">(Size: ${it.size})</span>` : ''}`;
      const thumbCell = productUrl ? `<a href="${productUrl}">${thumb}</a>` : thumb;
      const nameCell = productUrl
        ? `<a href="${productUrl}" style="color:#2b2320; text-decoration:none; font-weight:500;">${name}</a>`
        : `<span style="font-weight:500;">${name}</span>`;
      return `
      <tr>
        <td style="padding: 10px 10px 10px 0; border-bottom: 1px solid #f1e9e2; width:52px;">${thumbCell}</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #f1e9e2; font-size: 14px;">
          ${nameCell}
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid #f1e9e2; text-align: center; font-size: 13px; color:#6b5f57;">x${it.quantity || 1}</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #f1e9e2; text-align: right; font-size: 14px; font-weight:500;">${formatINR((it.price || 0) * (it.quantity || 1))}</td>
      </tr>`;
    })
    .join('');
  return `<table role="presentation" style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <tr>
      <td colspan="2" style="padding: 0 0 6px; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #a89a8f; border-bottom: 1px solid #ecdfd2;">Item</td>
      <td style="padding: 0 0 6px; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #a89a8f; text-align:center; border-bottom: 1px solid #ecdfd2;">Qty</td>
      <td style="padding: 0 0 6px; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #a89a8f; text-align:right; border-bottom: 1px solid #ecdfd2;">Price</td>
    </tr>
    ${rows}
  </table>`;
}

export function signupVerificationEmail(user: { full_name?: string; verify_url: string }) {
  const subject = `Confirm your email — ${SITE_NAME}`;
  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">Welcome${user.full_name ? `, ${user.full_name}` : ''}!</h2>
    <p>Thanks for creating an account with ${SITE_NAME}. Please confirm your email address to activate your account.</p>
    <p style="text-align:center; margin-top: 20px;">
      <a href="${user.verify_url}" style="background:${BRAND_COLOR}; color:#fff; padding: 12px 28px; text-decoration:none; border-radius: 4px; font-size: 14px; display:inline-block;">
        Confirm my email
      </a>
    </p>
    <p style="font-size:12px; color:#9a8f87;">This link expires shortly. If you didn't create this account, you can ignore this email.</p>
  `);
  return { subject, html };
}

export function otpLoginEmail(data: { email: string; code: string }) {
  const subject = `${data.code} is your login code — ${SITE_NAME}`;
  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">Your login code</h2>
    <p>Use the code below to log in to your ${SITE_NAME} account. This code expires shortly and can only be used once.</p>
    <p style="text-align:center; margin: 24px 0;">
      <span style="display:inline-block; background:#fff; border:1px solid ${BRAND_COLOR}; color:${BRAND_COLOR}; font-size: 28px; font-weight: bold; letter-spacing: 0.3em; padding: 14px 20px; border-radius: 6px;">
        ${data.code}
      </span>
    </p>
    <p style="font-size:12px; color:#9a8f87;">If you didn't request this code, you can safely ignore this email — no one can access your account without it.</p>
  `);
  return { subject, html };
}

export function passwordResetEmail(user: { full_name?: string; reset_url: string }) {
  const subject = `Reset your password — ${SITE_NAME}`;
  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">Reset your password${user.full_name ? `, ${user.full_name}` : ''}</h2>
    <p>We received a request to reset the password for your ${SITE_NAME} account. Click the button below to choose a new one.</p>
    <p style="text-align:center; margin-top: 20px;">
      <a href="${user.reset_url}" style="background:${BRAND_COLOR}; color:#fff; padding: 12px 28px; text-decoration:none; border-radius: 4px; font-size: 14px; display:inline-block;">
        Reset my password
      </a>
    </p>
    <p style="font-size:12px; color:#9a8f87;">This link expires shortly. If you didn't request a password reset, you can ignore this email.</p>
  `);
  return { subject, html };
}

export function orderConfirmationEmail(order: {
  id: string;
  customer_name?: string;
  items: any[];
  total_amount: number;
  payment_method?: string;
}) {
  const subject = `Order confirmed — #${order.id.slice(0, 8)}`;
  // Emails can't run JS or POST to our API directly, so this links back to
  // the order-confirmation page (works with no login for guest orders --
  // see app/api/orders/[id]/cancel/route.ts) where the actual Cancel
  // Order button lives, with its own confirmation dialog.
  const orderUrl = `${process.env.NEXT_PUBLIC_SITE_URL || ''}/order-confirmation/${order.id}`;
  const trackUrl = `${process.env.NEXT_PUBLIC_SITE_URL || ''}/track/${order.id}`;
  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">Thank you for your order, ${order.customer_name || 'there'}!</h2>
    <p>We've received your order <strong>#${order.id.slice(0, 8)}</strong> and it's being prepared.</p>
    ${itemsTable(order.items)}
    <p style="text-align:right; font-size:16px; font-weight:bold;">Total: ${formatINR(order.total_amount)}</p>
    <p style="font-size:13px; color:#6b5f57;">
      Payment method: ${order.payment_method === 'cod' ? 'Cash on Delivery' : 'Paid Online'}
    </p>
    <p style="text-align:center; margin-top: 20px;">
      <a href="${trackUrl}" style="background:${BRAND_COLOR}; color:#fff; padding: 12px 28px; text-decoration:none; border-radius: 4px; font-size: 14px; display:inline-block;">
        Track My Order
      </a>
    </p>
    <p style="font-size:13px; color:#6b5f57; text-align:center;">
      Need to cancel or view the full invoice? <a href="${orderUrl}" style="color:${BRAND_COLOR};">Open your order page</a>.
    </p>
    <p>No account or login needed — the link above always works, even for a guest checkout.</p>
  `);
  return { subject, html };
}

export function newOrderAdminNotification(order: {
  id: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  items: any[];
  total_amount: number;
  payment_method?: string;
}) {
  const shortId = `#${order.id.slice(0, 8).toUpperCase()}`;
  const subject = `New order ${shortId} — ${formatINR(order.total_amount)}`;
  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">You've got a new order!</h2>
    <div style="margin:16px 0; padding:14px 16px; background:#fff; border-left:3px solid ${BRAND_COLOR}; border-radius:4px;">
      <p style="margin:0 0 6px;"><strong>Order:</strong> ${shortId}</p>
      <p style="margin:0 0 6px;"><strong>Customer:</strong> ${order.customer_name || 'Guest'}${order.customer_email ? ` (${order.customer_email})` : ''}</p>
      ${order.customer_phone ? `<p style="margin:0 0 6px;"><strong>Phone:</strong> ${order.customer_phone}</p>` : ''}
      <p style="margin:0 0 6px;"><strong>Payment:</strong> ${order.payment_method === 'cod' ? 'Cash on Delivery' : 'Paid Online'}</p>
    </div>
    ${itemsTable(order.items)}
    <p style="text-align:right; font-size:16px; font-weight:bold;">Total: ${formatINR(order.total_amount)}</p>
    <p style="font-size:13px; color:#6b5f57;">View full details from Admin &gt; Orders.</p>
  `);
  return { subject, html };
}

export function orderTrackingSummaryEmail(order: {
  id: string;
  customer_name?: string;
  status: string;
  courier_name?: string | null;
  tracking_number?: string | null;
  current_location?: string | null;
  expected_delivery_date?: string | null;
  items: any[];
  total_amount: number;
}) {
  const shortId = `#${order.id.slice(0, 8).toUpperCase()}`;
  const subject = `Your order ${shortId} — current status`;
  const expected = order.expected_delivery_date
    ? new Date(order.expected_delivery_date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;
  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">Hi${order.customer_name ? ` ${order.customer_name}` : ''}, here's your order status</h2>
    <p>Order <strong>${shortId}</strong> is currently: <strong style="color:${BRAND_COLOR};">${order.status}</strong></p>
    ${
      order.tracking_number
        ? `<p style="font-size:14px;">Courier: <strong>${order.courier_name || 'Assigned courier'}</strong><br />Tracking number: <strong>${order.tracking_number}</strong>${order.current_location ? `<br />Last known location: <strong>${order.current_location}</strong>` : ''}</p>`
        : `<p style="font-size:14px; color:#6b5f57;">A tracking number will be shared here as soon as your order ships.</p>`
    }
    ${expected ? `<p style="font-size:14px;">Expected delivery: <strong>${expected}</strong></p>` : ''}
    ${itemsTable(order.items)}
    <p style="text-align:right; font-size:16px; font-weight:bold;">Total: ${formatINR(order.total_amount)}</p>
    <p style="text-align:center; margin-top: 16px;">
      <a href="${process.env.NEXT_PUBLIC_SITE_URL || ''}/track/${order.id}" style="background:${BRAND_COLOR}; color:#fff; padding: 12px 28px; text-decoration:none; border-radius: 4px; font-size: 14px; display:inline-block;">
        Track My Order
      </a>
    </p>
    <p style="font-size:13px; color:#6b5f57; text-align:center;">No login needed — this works for guest orders too.</p>
  `);
  return { subject, html };
}

export function supportTicketConfirmationEmail(ticket: {
  id: string;
  subject: string;
  message: string;
  customer_name?: string;
}) {
  const shortId = `#${ticket.id.slice(0, 8).toUpperCase()}`;
  const subject = `We've received your request ${shortId} — ${SITE_NAME}`;
  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">Thanks${ticket.customer_name ? `, ${ticket.customer_name}` : ''} — we've got it</h2>
    <p>Your support request <strong>${shortId}</strong> has been raised and our team will get back to you shortly.</p>
    <div style="margin:16px 0; padding:14px 16px; background:#fff; border-left:3px solid ${BRAND_COLOR}; border-radius:4px;">
      <p style="margin:0 0 6px; font-weight:bold;">${ticket.subject}</p>
      <p style="margin:0; color:#6b5f57; font-size:14px;">${ticket.message}</p>
    </div>
    <p style="font-size:13px; color:#6b5f57;">Need to add more info? Just reply to this email or reach us on WhatsApp.</p>
  `);
  return { subject, html };
}

export function contactMessageAdminNotification(msg: {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}) {
  const shortId = `#${msg.id.slice(0, 8).toUpperCase()}`;
  const subject = `New contact message ${shortId} — ${msg.subject}`;
  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">New message from the Contact Us page</h2>
    <div style="margin:16px 0; padding:14px 16px; background:#fff; border-left:3px solid ${BRAND_COLOR}; border-radius:4px;">
      <p style="margin:0 0 6px;"><strong>From:</strong> ${msg.name} (${msg.email})</p>
      ${msg.phone ? `<p style="margin:0 0 6px;"><strong>Phone:</strong> ${msg.phone}</p>` : ''}
      <p style="margin:0 0 6px;"><strong>Subject:</strong> ${msg.subject}</p>
      <p style="margin:0; color:#6b5f57; font-size:14px; white-space:pre-wrap;">${msg.message}</p>
    </div>
    <p style="font-size:13px; color:#6b5f57;">Reply from Admin &gt; Contact Messages.</p>
  `);
  return { subject, html };
}

export function contactMessageAutoReply(msg: { name?: string; subject: string }) {
  const subject = `We've received your message — ${SITE_NAME}`;
  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">Thanks${msg.name ? `, ${msg.name}` : ''} — we've got it</h2>
    <p>Your message about "<strong>${msg.subject}</strong>" has reached our team. We usually reply within 24 hours.</p>
    <p style="font-size:13px; color:#6b5f57;">Need to add more info? Just reply to this email or reach us on WhatsApp.</p>
  `);
  return { subject, html };
}

export function contactMessageReplyEmail(reply: { customer_name?: string; original_subject: string; reply_message: string }) {
  const subject = `Re: ${reply.original_subject} — ${SITE_NAME}`;
  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">Hi${reply.customer_name ? ` ${reply.customer_name}` : ''},</h2>
    <p style="white-space:pre-wrap;">${reply.reply_message}</p>
    <p style="font-size:13px; color:#6b5f57; margin-top:20px;">— Team ${SITE_NAME}</p>
  `);
  return { subject, html };
}

export function giftCardEmail(card: {
  code: string;
  amount: number;
  recipientName?: string | null;
  purchaserName?: string | null;
  message?: string | null;
  expiresAt?: string | null;
}) {
  const subject = `You've received a ${SITE_NAME} gift card! 🎁`;
  const expiry = card.expiresAt
    ? new Date(card.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;
  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">Hi${card.recipientName ? ` ${card.recipientName}` : ''}, you've got a gift card!</h2>
    <p>${card.purchaserName ? `${card.purchaserName} has sent you` : 'You have'} a gift card worth <strong>${formatINR(card.amount)}</strong> to spend at ${SITE_NAME}.</p>
    ${card.message ? `<p style="font-style:italic; color:#6b5f57; border-left:3px solid ${BRAND_COLOR}; padding-left:12px;">"${card.message}"</p>` : ''}
    <div style="margin:20px 0; padding:16px; background:#fff; border:1px dashed ${BRAND_COLOR}; text-align:center; border-radius:8px;">
      <p style="margin:0 0 4px; font-size:12px; letter-spacing:0.1em; text-transform:uppercase; color:#9a8f87;">Gift card code</p>
      <p style="margin:0; font-size:22px; font-weight:bold; letter-spacing:0.05em; color:${BRAND_COLOR};">${card.code}</p>
    </div>
    <p>Enter this code at checkout under "Apply gift card code" to redeem it.</p>
    ${expiry ? `<p style="font-size:13px; color:#6b5f57;">Valid until ${expiry}.</p>` : ''}
  `);
  return { subject, html };
}

export function orderShippedEmail(order: {
  id: string;
  customer_name?: string;
  tracking_number?: string | null;
  courier_name?: string | null;
  items?: any[];
  total_amount?: number;
}) {
  const subject = `Your order has shipped — #${order.id.slice(0, 8)}`;
  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">Good news, ${order.customer_name || 'there'} — it's on the way!</h2>
    <p>Your order <strong>#${order.id.slice(0, 8)}</strong> has been shipped${order.courier_name ? ` via ${order.courier_name}` : ''}.</p>
    ${order.tracking_number ? `<p style="font-size:16px;"><strong>Tracking number:</strong> ${order.tracking_number}</p>` : ''}
    ${order.items?.length ? itemsTable(order.items) : ''}
    ${
      order.items?.length && typeof order.total_amount === 'number'
        ? `<p style="text-align:right; font-size:16px; font-weight:bold;">Total: ${formatINR(order.total_amount)}</p>`
        : ''
    }
    <p style="text-align:center; margin-top: 16px;">
      <a href="${process.env.NEXT_PUBLIC_SITE_URL || ''}/track/${order.id}" style="background:${BRAND_COLOR}; color:#fff; padding: 12px 28px; text-decoration:none; border-radius: 4px; font-size: 14px; display:inline-block;">
        Track My Order
      </a>
    </p>
    <p style="font-size:13px; color:#6b5f57; text-align:center;">No login needed — this works for guest orders too.</p>
  `);
  return { subject, html };
}

// Generic "your order status changed" email — sent on every status change
// made from Admin -> Orders (the status dropdown / order detail view),
// covering statuses that don't already have a dedicated email (paid,
// delivered, cancelled, failed, pending/back-to-pending). 'shipped' also
// goes through here when the admin flips status manually on an order that
// already has a tracking number; the dedicated "just shipped from
// Delhivery" email (orderShippedEmail) is still sent separately by the
// create-shipment route the first time a waybill is generated.
export function orderStatusUpdateEmail(order: {
  id: string;
  customer_name?: string;
  status: string;
  tracking_number?: string | null;
  courier_name?: string | null;
  items?: any[];
  total_amount?: number;
}) {
  const shortId = `#${order.id.slice(0, 8).toUpperCase()}`;
  const name = order.customer_name || 'there';

  const copy: Record<string, { subject: string; heading: string; body: string }> = {
    pending: {
      subject: `Order ${shortId} is now pending`,
      heading: `Hi ${name}, your order is pending`,
      body: `Your order <strong>${shortId}</strong> has been moved back to <strong>pending</strong>. We'll update you again as soon as it progresses.`,
    },
    paid: {
      subject: `Payment confirmed — ${shortId}`,
      heading: `Thanks, ${name} — payment received!`,
      body: `We've confirmed payment for your order <strong>${shortId}</strong> and it's now being prepared.
        <br /><br />
        Sorry for the inconvenience, but a couple of our pieces are made/kept ready only once an order comes
        in, rather than sitting pre-packed at all times — so preparing your order for shipment may take a
        little extra time. We'll email you the moment it ships, and you're welcome to check the latest
        status here any time.`,
    },
    shipped: {
      subject: `Your order has shipped — ${shortId}`,
      heading: `Good news, ${name} — it's on the way!`,
      body: `Your order <strong>${shortId}</strong> has been shipped${order.courier_name ? ` via ${order.courier_name}` : ''}.${order.tracking_number ? ` <br/><strong>Tracking number:</strong> ${order.tracking_number}` : ''}`,
    },
    delivered: {
      subject: `Delivered! — ${shortId}`,
      heading: `Your order has arrived, ${name}!`,
      body: `Your order <strong>${shortId}</strong> has been marked as <strong>delivered</strong>. We hope you love it — thank you for shopping with us.`,
    },
    cancelled: {
      subject: `Order cancelled — ${shortId}`,
      heading: `Your order has been cancelled`,
      body: `Your order <strong>${shortId}</strong> has been <strong>cancelled</strong>. If you've already paid online, any eligible refund will be processed to your original payment method. If you didn't request this, please reply to this email or contact support.`,
    },
    failed: {
      subject: `Payment issue with order ${shortId}`,
      heading: `There was an issue with your order`,
      body: `We weren't able to confirm payment for your order <strong>${shortId}</strong>. Please try again or contact support if you were charged.`,
    },
  };

  const c = copy[order.status] || {
    subject: `Order ${shortId} update`,
    heading: `Update on your order, ${name}`,
    body: `The status of your order <strong>${shortId}</strong> is now <strong>${order.status}</strong>.`,
  };

  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">${c.heading}</h2>
    <p>${c.body}</p>
    ${order.items?.length ? itemsTable(order.items) : ''}
    ${
      order.items?.length && typeof order.total_amount === 'number'
        ? `<p style="text-align:right; font-size:16px; font-weight:bold;">Total: ${formatINR(order.total_amount)}</p>`
        : ''
    }
    <p style="text-align:center; margin-top: 16px;">
      <a href="${process.env.NEXT_PUBLIC_SITE_URL || ''}/track/${order.id}" style="background:${BRAND_COLOR}; color:#fff; padding: 12px 28px; text-decoration:none; border-radius: 4px; font-size: 14px; display:inline-block;">
        Track My Order
      </a>
    </p>
    <p style="font-size:13px; color:#6b5f57; text-align:center;">No login needed — this works for guest orders too.</p>
  `);
  return { subject: c.subject, html };
}

// Sent once, automatically, as soon as we learn (from the courier's live
// tracking response) what date the shipment is expected to arrive --
// i.e. before it's actually delivered. Deduped by orders.arriving_email_sent_at
// (see lib/cron-jobs.ts -> runForwardShipmentTrackingJob) so it only ever
// goes out once per order, even though the cron job checks tracking every
// ~15 minutes.
export function orderArrivingEmail(order: {
  id: string;
  customer_name?: string;
  expected_delivery_date: string;
  courier_name?: string | null;
  tracking_number?: string | null;
  items?: any[];
  total_amount?: number;
}) {
  const shortId = `#${order.id.slice(0, 8).toUpperCase()}`;
  const name = order.customer_name || 'there';
  const expected = new Date(order.expected_delivery_date).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const subject = `Arriving ${expected} — your order ${shortId}`;
  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">Hi ${name}, your order is on its way!</h2>
    <p>Your order <strong>${shortId}</strong> is expected to be delivered on <strong>${expected}</strong>.</p>
    ${order.tracking_number ? `<p style="font-size:13px; color:#6b5f57;">Tracking number: <strong>${order.tracking_number}</strong>${order.courier_name ? ` (${order.courier_name})` : ''}</p>` : ''}
    ${order.items?.length ? itemsTable(order.items) : ''}
    ${
      order.items?.length && typeof order.total_amount === 'number'
        ? `<p style="text-align:right; font-size:16px; font-weight:bold;">Total: ${formatINR(order.total_amount)}</p>`
        : ''
    }
    <p>We'll email you again once it's out for delivery, and once more the moment it's delivered — no need to keep checking.</p>
    <p style="text-align:center; margin-top: 16px;">
      <a href="${process.env.NEXT_PUBLIC_SITE_URL || ''}/track/${order.id}" style="background:${BRAND_COLOR}; color:#fff; padding: 12px 28px; text-decoration:none; border-radius: 4px; font-size: 14px; display:inline-block;">
        Track My Order
      </a>
    </p>
  `);
  return { subject, html };
}

// Sent once, automatically, the moment the courier's live tracking status
// first shows "out for delivery" -- the closest same-day, near-real-time
// signal we get from Delhivery's polling API that the package is genuinely
// close (courier's don't expose a precise ETA, so this is the practical
// stand-in for "shortly before it arrives"). Deduped by
// orders.out_for_delivery_email_sent_at.
export function orderOutForDeliveryEmail(order: {
  id: string;
  customer_name?: string;
  courier_name?: string | null;
  tracking_number?: string | null;
  items?: any[];
  total_amount?: number;
}) {
  const shortId = `#${order.id.slice(0, 8).toUpperCase()}`;
  const name = order.customer_name || 'there';
  const subject = `Out for delivery today — ${shortId}`;
  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">Hi ${name}, your order is out for delivery!</h2>
    <p>Your order <strong>${shortId}</strong> is with our delivery partner${order.courier_name ? ` (${order.courier_name})` : ''} and should reach you shortly today. Please keep your phone nearby in case the delivery person needs to reach you.</p>
    ${order.tracking_number ? `<p style="font-size:13px; color:#6b5f57;">Tracking number: <strong>${order.tracking_number}</strong></p>` : ''}
    ${order.items?.length ? itemsTable(order.items) : ''}
    ${
      order.items?.length && typeof order.total_amount === 'number'
        ? `<p style="text-align:right; font-size:16px; font-weight:bold;">Total: ${formatINR(order.total_amount)}</p>`
        : ''
    }
    <p style="text-align:center; margin-top: 16px;">
      <a href="${process.env.NEXT_PUBLIC_SITE_URL || ''}/track/${order.id}" style="background:${BRAND_COLOR}; color:#fff; padding: 12px 28px; text-decoration:none; border-radius: 4px; font-size: 14px; display:inline-block;">
        Track My Order
      </a>
    </p>
  `);
  return { subject, html };
}

export function returnStatusEmail(ret: {
  id: string;
  order_id: string;
  type: string;
  status: string;
  admin_notes?: string | null;
  refund_amount?: number | null;
}) {
  const statusLabelMap: Record<string, string> = {
    approved: 'approved',
    rejected: 'declined',
    refunded: 'refunded',
    completed: 'completed',
  };
  const label = statusLabelMap[ret.status] || ret.status;
  const subject = `Your ${ret.type} request has been ${label} — Order #${ret.order_id.slice(0, 8)}`;
  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">Update on your ${ret.type} request</h2>
    <p>Your ${ret.type} request for order <strong>#${ret.order_id.slice(0, 8)}</strong> has been <strong>${label}</strong>.</p>
    ${
      ret.refund_amount
        ? `<p style="font-size:16px;"><strong>Refund amount:</strong> ${formatINR(ret.refund_amount)}</p>`
        : ''
    }
    ${ret.admin_notes ? `<p style="font-size:14px; color:#6b5f57;"><strong>Note from our team:</strong> ${ret.admin_notes}</p>` : ''}
    <p>If you have any questions, just reply to this email.</p>
  `);
  return { subject, html };
}

export function returnRequestedCustomerEmail(ret: {
  id: string;
  order_id: string;
  type: string;
  reason: string;
}) {
  const subject = `We've received your ${ret.type} request — Order #${ret.order_id.slice(0, 8)}`;
  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">Your ${ret.type} request is in</h2>
    <p>We've received your ${ret.type} request for order <strong>#${ret.order_id.slice(0, 8)}</strong> and our team is reviewing it.</p>
    <p style="font-size:14px; color:#6b5f57;"><strong>Reason:</strong> ${ret.reason}</p>
    <p>You'll get an email the moment it's approved, when pickup is arranged, and again once your refund/exchange is processed — no need to follow up.</p>
  `);
  return { subject, html };
}

export function returnRequestedAdminNotification(ret: {
  id: string;
  order_id: string;
  type: string;
  reason: string;
  customer_name?: string | null;
  customer_email?: string | null;
}) {
  const shortId = `#${ret.id.slice(0, 8).toUpperCase()}`;
  const subject = `New ${ret.type} request ${shortId} — Order #${ret.order_id.slice(0, 8)}`;
  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">New ${ret.type} request</h2>
    <div style="margin:16px 0; padding:14px 16px; background:#fff; border-left:3px solid ${BRAND_COLOR}; border-radius:4px;">
      <p style="margin:0 0 6px;"><strong>Order:</strong> #${ret.order_id.slice(0, 8)}</p>
      <p style="margin:0 0 6px;"><strong>Customer:</strong> ${ret.customer_name || 'Guest'} (${ret.customer_email || '—'})</p>
      <p style="margin:0; color:#6b5f57; font-size:14px; white-space:pre-wrap;"><strong>Reason:</strong> ${ret.reason}</p>
    </div>
    <p style="font-size:13px; color:#6b5f57;">Review and approve/reject from Admin &gt; Returns.</p>
  `);
  return { subject, html };
}

export function returnPickupScheduledEmail(ret: {
  order_id: string;
  type: string;
  waybill: string;
}) {
  const subject = `Pickup arranged for your ${ret.type} — Order #${ret.order_id.slice(0, 8)}`;
  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">Your pickup is scheduled</h2>
    <p>Your ${ret.type} request for order <strong>#${ret.order_id.slice(0, 8)}</strong> has been approved and a reverse pickup has been arranged with Delhivery.</p>
    <p style="font-size:16px;"><strong>Pickup tracking ID (AWB):</strong> ${ret.waybill}</p>
    <p>A Delhivery agent will visit your delivery address to collect the item. Please keep it packed and ready.</p>
  `);
  return { subject, html };
}

export function returnPickupReceivedEmail(ret: {
  order_id: string;
  type: string;
  online_payment: boolean;
}) {
  const subject = `We've received your return — Order #${ret.order_id.slice(0, 8)}`;
  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">Your item is back with us</h2>
    <p>The item from order <strong>#${ret.order_id.slice(0, 8)}</strong> has reached our warehouse.</p>
    <p>${
      ret.online_payment
        ? "We're now processing your refund — you'll get a confirmation email as soon as it's issued."
        : "Our team is now processing your " + ret.type + " and will update you shortly."
    }</p>
  `);
  return { subject, html };
}

export function returnRefundProcessedEmail(ret: {
  order_id: string;
  refund_amount: number;
  razorpay_refund_id?: string | null;
}) {
  const subject = `Refund processed — Order #${ret.order_id.slice(0, 8)}`;
  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">Your refund is on its way</h2>
    <p>We've processed a refund of <strong>${formatINR(ret.refund_amount)}</strong> for order <strong>#${ret.order_id.slice(0, 8)}</strong> to your original payment method via Razorpay.</p>
    ${ret.razorpay_refund_id ? `<p style="font-size:12px; color:#9a8f87;">Refund reference: ${ret.razorpay_refund_id}</p>` : ''}
    <p>It usually reflects in your account within 5-7 business days, depending on your bank.</p>
  `);
  return { subject, html };
}

export function returnAutomationAdminAlert(alert: {
  returnId: string;
  orderId: string;
  stage: 'pickup' | 'refund';
  error: string;
}) {
  const shortId = `#${alert.returnId.slice(0, 8).toUpperCase()}`;
  const subject = `Action needed — ${alert.stage === 'pickup' ? 'reverse pickup' : 'refund'} failed for return ${shortId}`;
  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">Automation needs your attention</h2>
    <div style="margin:16px 0; padding:14px 16px; background:#fff; border-left:3px solid #b9481f; border-radius:4px;">
      <p style="margin:0 0 6px;"><strong>Return:</strong> ${shortId} (Order #${alert.orderId.slice(0, 8)})</p>
      <p style="margin:0 0 6px;"><strong>Step:</strong> ${alert.stage === 'pickup' ? 'Reverse pickup scheduling' : 'Razorpay refund'}</p>
      <p style="margin:0; color:#6b5f57; font-size:14px;"><strong>Error:</strong> ${alert.error}</p>
    </div>
    <p style="font-size:13px; color:#6b5f57;">Please handle this from Admin &gt; Returns — retry the automated step or complete it manually.</p>
  `);
  return { subject, html };
}

export function restockEmail(product: { name: string; slug: string; price: number; images?: string[] }) {
  const subject = `Back in stock — ${product.name}`;
  const url = `${process.env.NEXT_PUBLIC_SITE_URL || ''}/product/${product.slug}`;
  const image = product.images?.[0];
  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">Good news — it's back!</h2>
    <p><strong>${product.name}</strong> is available again, just the way you wanted it.</p>
    ${image ? `<img src="${image}" alt="${product.name}" style="width:100%; max-width:280px; border-radius:6px; display:block; margin: 12px auto;" />` : ''}
    <p style="text-align:center; font-size:16px; font-weight:bold;">${formatINR(product.price)}</p>
    <p style="text-align:center; margin-top: 20px;">
      <a href="${url}" style="background:${BRAND_COLOR}; color:#fff; padding: 12px 28px; text-decoration:none; border-radius: 4px; font-size: 14px;">
        Shop it now
      </a>
    </p>
    <p style="font-size:12px; color:#9a8f87; text-align:center;">Stock is limited, so grab it before it sells out again.</p>
  `);
  return { subject, html };
}

export function cartRecoveryEmail(cart: { items: any[]; cart_value: number }) {
  const subject = `You left something behind — complete your order`;
  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">Still thinking it over?</h2>
    <p>You left a few items in your cart. They're still waiting for you!</p>
    ${itemsTable(cart.items)}
    <p style="text-align:right; font-size:16px; font-weight:bold;">Cart total: ${formatINR(cart.cart_value)}</p>
    <p style="text-align:center; margin-top: 20px;">
      <a href="${process.env.NEXT_PUBLIC_SITE_URL || ''}/cart" style="background:${BRAND_COLOR}; color:#fff; padding: 12px 28px; text-decoration:none; border-radius: 4px; font-size: 14px;">
        Complete your purchase
      </a>
    </p>
  `);
  return { subject, html };
}

// Unlike cartRecoveryEmail (sent when someone never even reaches checkout),
// this is for an order that WAS created -- stock reserved, address saved --
// but the Razorpay popup was closed/abandoned before payment finished. The
// link goes straight to a resume page for THIS exact order (not /cart), so
// the customer doesn't have to rebuild their cart or re-enter their address.
export function paymentReminderEmail(order: { id: string; items: any[]; total_amount: number; customer_name?: string }) {
  const subject = `Your order is waiting — complete your payment`;
  const resumeUrl = `${process.env.NEXT_PUBLIC_SITE_URL || ''}/checkout/resume/${order.id}`;
  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">Almost there${order.customer_name ? `, ${order.customer_name}` : ''}!</h2>
    <p>We've saved your order below, but the payment didn't go through. No need to start over — just complete the payment to confirm it.</p>
    ${itemsTable(order.items)}
    <p style="text-align:right; font-size:16px; font-weight:bold;">Order total: ${formatINR(order.total_amount)}</p>
    <p style="text-align:center; margin-top: 20px;">
      <a href="${resumeUrl}" style="background:${BRAND_COLOR}; color:#fff; padding: 12px 28px; text-decoration:none; border-radius: 4px; font-size: 14px; display:inline-block;">
        Complete your payment
      </a>
    </p>
    <p style="text-align:center; font-size:12px; color:#9a8f87; margin-top:16px;">
      If you've changed your mind, you can simply ignore this email — nothing further will be charged.
    </p>
  `);
  return { subject, html };
}

// Sent when the admin converts a COD order to "needs online payment first"
// (see app/api/admin/orders/[id]/request-online-payment/route.ts) --
// typically because the exact item isn't kept ready-made and needs to be
// prepared before it can ship, so we ask for payment upfront instead of
// collecting it at the door. Links to the same /checkout/resume/[id] page
// used for abandoned-online-payment reminders, since paying here is the
// same Razorpay flow -- just entered from a different reason.
export function codToPrepaidRequestEmail(order: {
  id: string;
  items: any[];
  total_amount: number;
  customer_name?: string;
  // The id of the 'email_sent' row in order_payment_request_events for
  // THIS particular send -- when present, the CTA link is routed through
  // /api/track/order-payment/click/<trackingId> (so a click can be logged
  // before redirecting to the real resume page) and an invisible pixel is
  // embedded for open tracking. Left undefined for admin "Preview"/"Send
  // test" -- those don't write to the DB, so there's nothing to track.
  trackingId?: string;
  // Store info (Admin > Settings > Store Info) for the footer's support
  // line/address/GSTIN -- optional and best-effort: if the caller doesn't
  // fetch it, the footer just shows fewer lines instead of erroring.
  store?: { address?: string; gstin?: string; support_email?: string; support_phone?: string };
}) {
  const shortId = `#${order.id.slice(0, 8).toUpperCase()}`;
  const name = order.customer_name || 'there';
  const subject = `Action needed on your order ${shortId} — online payment required`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
  const directResumeUrl = `${siteUrl}/checkout/resume/${order.id}`;
  const resumeUrl = order.trackingId
    ? `${siteUrl}/api/track/order-payment/click/${order.trackingId}`
    : directResumeUrl;
  const pixel = order.trackingId
    ? `<img src="${siteUrl}/api/track/order-payment/open/${order.trackingId}" width="1" height="1" alt="" style="display:block;border:0;" />`
    : '';
  const html = wrapper(
    `
    <h2 style="margin:0 0 4px; color:${BRAND_COLOR}; font-size: 21px;">Hi ${name}, one quick thing about your order</h2>
    <p style="margin: 0 0 18px; color:#6b5f57; font-size: 13px;">
      Order <strong style="color:#2b2320;">${shortId}</strong> · placed with ${SITE_NAME}
    </p>

    <table role="presentation" style="width:100%; border-collapse:collapse; margin: 0 0 20px; background:#fbf1e7; border:1px solid #ecdfd2; border-left: 4px solid ${GOLD_ACCENT}; border-radius: 6px;">
      <tr>
        <td style="padding: 14px 16px; font-size: 14px; color:#4a3d34; line-height:1.55;">
          This particular piece isn't kept ready-made at all times — it's specially prepared once an
          order comes in. Because of that, we're not able to offer Cash on Delivery on this order, and
          need the payment made online before we start preparing it.
        </td>
      </tr>
    </table>

    <p style="margin: 0 0 4px; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #a89a8f;">Order Summary</p>
    ${itemsTable(order.items)}
    <table role="presentation" style="width:100%; margin: 4px 0 24px;">
      <tr>
        <td style="text-align:right; font-size:16px; font-weight:bold; padding-top: 6px; border-top: 2px solid ${BRAND_COLOR};">
          Order total: ${formatINR(order.total_amount)}
        </td>
      </tr>
    </table>

    <table role="presentation" style="width:100%;">
      <tr>
        <td align="center">
          <a href="${resumeUrl}" style="background:${BRAND_COLOR}; color:#fff; padding: 14px 36px; text-decoration:none; border-radius: 6px; font-size: 15px; font-weight:bold; display:inline-block; letter-spacing:0.02em;">
            Pay Online to Confirm This Order →
          </a>
        </td>
      </tr>
    </table>

    <p style="text-align:center; font-size:12px; color:#9a8f87; margin: 12px 0 0;">
      Prefer not to click email links? Log in to your account and open
      <a href="${siteUrl}/account/orders/${order.id}" style="color:${BRAND_COLOR}; font-weight:bold;">My Orders → ${shortId}</a> to pay from there instead.
    </p>

    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #ecdfd2; text-align:center;">
      <p style="font-size:13px; color:#6b5f57; margin: 0;">
        Once we receive the payment, we'll start preparing your order right away — thank you for your patience.
      </p>
      <p style="font-size:11px; color:#a89a8f; margin: 10px 0 0;">
        For your security, this link only opens the payment step for order ${shortId} — it will never ask for your ${SITE_NAME} password.
      </p>
    </div>
    ${pixel}
  `,
    { store: order.store }
  );
  return { subject, html };
}

export function welcomeSeriesEmail(user: { full_name?: string; coupon_code?: string }) {
  const subject = `Welcome to ${SITE_NAME}${user.coupon_code ? " — here's 10% off" : ''}`;
  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">Welcome${user.full_name ? `, ${user.full_name}` : ''}!</h2>
    <p>Thanks for joining ${SITE_NAME}. We're glad to have you — explore handpicked sarees, lehengas and ethnic wear from master weavers across India.</p>
    ${
      user.coupon_code
        ? `<div style="margin:20px 0; padding:16px; background:#fff; border:1px dashed ${BRAND_COLOR}; text-align:center; border-radius:8px;">
            <p style="margin:0 0 4px; font-size:12px; letter-spacing:0.1em; text-transform:uppercase; color:#9a8f87;">Your welcome coupon</p>
            <p style="margin:0; font-size:22px; font-weight:bold; letter-spacing:0.05em; color:${BRAND_COLOR};">${user.coupon_code}</p>
          </div>
          <p>Use this code at checkout for a discount on your first order.</p>`
        : ''
    }
    <p style="text-align:center; margin-top: 20px;">
      <a href="${process.env.NEXT_PUBLIC_SITE_URL || ''}/shop" style="background:${BRAND_COLOR}; color:#fff; padding: 12px 28px; text-decoration:none; border-radius: 4px; font-size: 14px; display:inline-block;">
        Start shopping
      </a>
    </p>
  `);
  return { subject, html };
}

export function winbackEmail(user: { full_name?: string; coupon_code?: string }) {
  const subject = `We miss you${user.coupon_code ? ' — here\'s something special' : ''} — ${SITE_NAME}`;
  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">It's been a while, ${user.full_name || 'there'}!</h2>
    <p>We haven't seen you in a bit and wanted to say we'd love to have you back at ${SITE_NAME}.</p>
    ${
      user.coupon_code
        ? `<div style="margin:20px 0; padding:16px; background:#fff; border:1px dashed ${BRAND_COLOR}; text-align:center; border-radius:8px;">
            <p style="margin:0 0 4px; font-size:12px; letter-spacing:0.1em; text-transform:uppercase; color:#9a8f87;">A little something for you</p>
            <p style="margin:0; font-size:22px; font-weight:bold; letter-spacing:0.05em; color:${BRAND_COLOR};">${user.coupon_code}</p>
          </div>
          <p>Use this code at checkout for a discount on your next order.</p>`
        : ''
    }
    <p style="text-align:center; margin-top: 20px;">
      <a href="${process.env.NEXT_PUBLIC_SITE_URL || ''}/shop" style="background:${BRAND_COLOR}; color:#fff; padding: 12px 28px; text-decoration:none; border-radius: 4px; font-size: 14px; display:inline-block;">
        Shop new arrivals
      </a>
    </p>
  `);
  return { subject, html };
}

// ---------------------------------------------------------------------
// Vendor sourcing (internal — vendor is never customer-facing)
// ---------------------------------------------------------------------

/** Sent when the admin approves or rejects a /sell-with-us application. */
export function vendorApplicationStatusEmail(vendor: {
  business_name: string;
  status: 'approved' | 'rejected';
  admin_note?: string | null;
}) {
  const approved = vendor.status === 'approved';
  const subject = approved
    ? `You're approved as a vendor — ${SITE_NAME}`
    : `Update on your vendor application — ${SITE_NAME}`;
  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">${approved ? 'Application approved!' : 'Application update'}</h2>
    <p>Hi ${vendor.business_name},</p>
    ${
      approved
        ? `<p>Good news — your vendor application with ${SITE_NAME} has been approved. You can now log in to your vendor dashboard to start listing products.</p>`
        : `<p>Thanks for applying to sell with ${SITE_NAME}. After reviewing your application, we're not able to move ahead at this time.</p>`
    }
    ${vendor.admin_note ? `<p style="padding:12px; background:#fff; border-left:3px solid ${BRAND_COLOR}; font-size:14px;">${vendor.admin_note}</p>` : ''}
    ${
      approved
        ? `<p style="text-align:center; margin-top: 20px;">
            <a href="${process.env.NEXT_PUBLIC_SITE_URL || ''}/vendor/dashboard" style="background:${BRAND_COLOR}; color:#fff; padding: 12px 28px; text-decoration:none; border-radius: 4px; font-size: 14px; display:inline-block;">
              Go to vendor dashboard
            </a>
          </p>`
        : ''
    }
  `);
  return { subject, html };
}

/** Sent to the customer once the admin approves/rejects/suspends their
 *  affiliate application — exact mirror of vendorApplicationStatusEmail,
 *  pointed at the affiliate dashboard instead of the vendor dashboard. */
export function affiliateApplicationStatusEmail(affiliate: {
  name: string;
  status: 'approved' | 'rejected' | 'suspended';
  commission_percent?: number | null;
}) {
  const approved = affiliate.status === 'approved';
  const suspended = affiliate.status === 'suspended';
  const subject = approved
    ? `You're approved as an affiliate — ${SITE_NAME}`
    : suspended
      ? `Your affiliate account has been suspended — ${SITE_NAME}`
      : `Update on your affiliate application — ${SITE_NAME}`;
  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">${approved ? 'Application approved!' : suspended ? 'Account suspended' : 'Application update'}</h2>
    <p>Hi ${affiliate.name},</p>
    ${
      approved
        ? `<p>Good news — your affiliate application with ${SITE_NAME} has been approved${affiliate.commission_percent != null ? ` at a <strong>${affiliate.commission_percent}%</strong> commission rate` : ''}. Log in to your dashboard to get your referral link and start earning.</p>`
        : suspended
          ? `<p>Your affiliate account with ${SITE_NAME} has been suspended. Any commission already marked as paid is unaffected, but no new referrals will earn commission while your account is suspended.</p>`
          : `<p>Thanks for applying to the ${SITE_NAME} affiliate program. After review, we're not able to approve your application at this time.</p>`
    }
    ${
      approved
        ? `<p style="text-align:center; margin-top: 20px;">
            <a href="${process.env.NEXT_PUBLIC_SITE_URL || ''}/account/affiliate" style="background:${BRAND_COLOR}; color:#fff; padding: 12px 28px; text-decoration:none; border-radius: 4px; font-size: 14px; display:inline-block;">
              Go to affiliate dashboard
            </a>
          </p>`
        : ''
    }
  `);
  return { subject, html };
}

/** Sent to the vendor once the admin approves/rejects their bank-detail change request. */
export function vendorBankUpdateStatusEmail(vendor: {
  business_name: string;
  approved: boolean;
}) {
  const subject = `Bank detail update ${vendor.approved ? 'approved' : 'rejected'} — ${SITE_NAME}`;
  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">Bank detail change ${vendor.approved ? 'approved' : 'rejected'}</h2>
    <p>Hi ${vendor.business_name},</p>
    <p>
      ${
        vendor.approved
          ? 'Your requested bank account change has been verified and applied to your vendor profile.'
          : "Your requested bank account change could not be verified, so it wasn't applied. Please contact us or try again with correct details."
      }
    </p>
  `);
  return { subject, html };
}

// -------------------------------------------------------------------------
// Vendor product AI-processed & live (new listing or edit re-publish)
// -------------------------------------------------------------------------

/** Sent when AI finishes enriching a newly submitted vendor product and it
 *  goes live on the storefront. */
export function vendorProductLiveEmail(input: {
  vendorName: string;
  productName: string;
}) {
  const subject = `Your product is live — ${input.productName} — ${SITE_NAME}`;
  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">Your product is now live!</h2>
    <p>Hi ${input.vendorName},</p>
    <p>
      Great news — your product <strong>${input.productName}</strong> has been processed
      and is now live on the ${SITE_NAME} storefront.
    </p>
    <p>Our AI has filled in the product description, highlights, and SEO details based on
    the photos and information you provided.</p>
    <p style="text-align:center; margin-top: 20px;">
      <a href="${process.env.NEXT_PUBLIC_SITE_URL || ''}/vendor/dashboard/products"
         style="background:${BRAND_COLOR}; color:#fff; padding: 12px 28px; text-decoration:none; border-radius: 4px; font-size: 14px; display:inline-block;">
        View my products
      </a>
    </p>
    <p style="font-size:12px; color:#9a8f87;">
      If any details look off, you can edit the product from your vendor dashboard
      and we'll re-process it automatically.
    </p>
  `);
  return { subject, html };
}

/** Sent when a vendor edits an existing product and AI finishes re-enriching it. */
export function vendorProductEditLiveEmail(input: {
  vendorName: string;
  productName: string;
}) {
  const subject = `Product update live — ${input.productName} — ${SITE_NAME}`;
  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">Your product edit is now live!</h2>
    <p>Hi ${input.vendorName},</p>
    <p>
      Your changes to <strong>${input.productName}</strong> have been processed and the
      updated listing is now live on ${SITE_NAME}.
    </p>
    <p>The product URL has not changed, so any existing links still work.</p>
    <p style="text-align:center; margin-top: 20px;">
      <a href="${process.env.NEXT_PUBLIC_SITE_URL || ''}/vendor/dashboard/products"
         style="background:${BRAND_COLOR}; color:#fff; padding: 12px 28px; text-decoration:none; border-radius: 4px; font-size: 14px; display:inline-block;">
        View my products
      </a>
    </p>
  `);
  return { subject, html };
}

/** Sent to the vendor once the admin approves/rejects one of their product submissions (Phase 2, Part 5). */
export function vendorProductStatusEmail(input: {
  business_name: string;
  product_name: string;
  status: 'awaiting_stock' | 'rejected';
  final_price?: number | null;
  rejection_reason?: string | null;
}) {
  const approved = input.status === 'awaiting_stock';
  const subject = approved
    ? `Product approved — ${input.product_name} — ${SITE_NAME}`
    : `Update on your product submission — ${SITE_NAME}`;
  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">${approved ? 'Product approved!' : 'Submission update'}</h2>
    <p>Hi ${input.business_name},</p>
    ${
      approved
        ? `<p>Your product <strong>${input.product_name}</strong> has been approved${
            input.final_price != null ? ` at a final price of ${formatINR(input.final_price)}` : ''
          }. It will go live once stock is confirmed.</p>`
        : `<p>Your submission for <strong>${input.product_name}</strong> was not approved this time.</p>`
    }
    ${input.rejection_reason ? `<p style="padding:12px; background:#fff; border-left:3px solid ${BRAND_COLOR}; font-size:14px;">${input.rejection_reason}</p>` : ''}
    <p style="text-align:center; margin-top: 20px;">
      <a href="${process.env.NEXT_PUBLIC_SITE_URL || ''}/vendor/dashboard" style="background:${BRAND_COLOR}; color:#fff; padding: 12px 28px; text-decoration:none; border-radius: 4px; font-size: 14px; display:inline-block;">
        View in vendor dashboard
      </a>
    </p>
  `);
  return { subject, html };
}
