import { formatINR } from './format';

const BRAND_COLOR = '#7c3a1d';
const SITE_NAME = 'Aruhi Handlooms';

function wrapper(bodyHtml: string) {
  return `
  <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 560px; margin: 0 auto; color: #2b2320;">
    <div style="background: ${BRAND_COLOR}; padding: 24px; text-align: center;">
      <h1 style="color: #fff; margin: 0; font-size: 22px; letter-spacing: 0.05em;">${SITE_NAME}</h1>
    </div>
    <div style="padding: 28px 24px; background: #fffaf5;">
      ${bodyHtml}
    </div>
    <div style="padding: 16px 24px; text-align: center; font-size: 11px; color: #9a8f87;">
      You're receiving this email because of a recent activity on ${SITE_NAME}.
    </div>
  </div>`;
}

function itemsTable(items: any[]) {
  const rows = (items || [])
    .map(
      (it) => `
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
          ${it.product_name || it.name || 'Item'}${it.size ? ` <span style="color:#9a8f87;">(Size: ${it.size})</span>` : ''}
        </td>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: center;">x${it.quantity || 1}</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${formatINR((it.price || 0) * (it.quantity || 1))}</td>
      </tr>`
    )
    .join('');
  return `<table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px;">${rows}</table>`;
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
    <p style="font-size:12px; color:#9a8f87;">If the button doesn't work, copy and paste this link into your browser:<br />${user.verify_url}</p>
    <p style="font-size:12px; color:#9a8f87;">This link expires shortly. If you didn't create this account, you can ignore this email.</p>
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
  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">Thank you for your order, ${order.customer_name || 'there'}!</h2>
    <p>We've received your order <strong>#${order.id.slice(0, 8)}</strong> and it's being prepared.</p>
    ${itemsTable(order.items)}
    <p style="text-align:right; font-size:16px; font-weight:bold;">Total: ${formatINR(order.total_amount)}</p>
    <p style="font-size:13px; color:#6b5f57;">
      Payment method: ${order.payment_method === 'cod' ? 'Cash on Delivery' : 'Paid Online'}
    </p>
    <p>You can track your order anytime from your account's Order History page.</p>
  `);
  return { subject, html };
}

export function orderShippedEmail(order: {
  id: string;
  customer_name?: string;
  tracking_number?: string | null;
  courier_name?: string | null;
}) {
  const subject = `Your order has shipped — #${order.id.slice(0, 8)}`;
  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">Good news, ${order.customer_name || 'there'} — it's on the way!</h2>
    <p>Your order <strong>#${order.id.slice(0, 8)}</strong> has been shipped${order.courier_name ? ` via ${order.courier_name}` : ''}.</p>
    ${order.tracking_number ? `<p style="font-size:16px;"><strong>Tracking number:</strong> ${order.tracking_number}</p>` : ''}
    <p>You can track live status from your account's Order History page.</p>
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

// ---------------------------------------------------------------------
// Phase 13 — Lifecycle / drip automation: welcome series + win-back
// ---------------------------------------------------------------------

export function welcomeSeriesEmail(user: { full_name?: string; coupon_code: string }) {
  const subject = `Welcome to ${SITE_NAME}${user.full_name ? `, ${user.full_name}` : ''}!`;
  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">Welcome${user.full_name ? `, ${user.full_name}` : ''}!</h2>
    <p>Thanks for joining ${SITE_NAME}. We handpick every saree, lehenga and ethnic piece from master weavers across India — glad to have you here.</p>
    <p style="text-align:center; margin: 20px 0;">
      <span style="display:inline-block; border: 2px dashed ${BRAND_COLOR}; padding: 12px 24px; font-size: 18px; font-weight: bold; letter-spacing: 1px; color: ${BRAND_COLOR};">
        ${user.coupon_code}
      </span>
    </p>
    <p style="text-align:center; font-size: 13px; color:#6b5f57;">Use this code at checkout for a welcome discount on your first order.</p>
    <p style="text-align:center; margin-top: 20px;">
      <a href="${process.env.NEXT_PUBLIC_SITE_URL || ''}/shop" style="background:${BRAND_COLOR}; color:#fff; padding: 12px 28px; text-decoration:none; border-radius: 4px; font-size: 14px;">
        Start shopping
      </a>
    </p>
  `);
  return { subject, html };
}

export function winbackEmail(user: { full_name?: string; coupon_code: string }) {
  const subject = `We miss you${user.full_name ? `, ${user.full_name}` : ''} — here's something for you`;
  const html = wrapper(`
    <h2 style="margin-top:0; color:${BRAND_COLOR};">It's been a while!</h2>
    <p>We've added new handwoven pieces since your last visit, and wanted to welcome you back with a little something.</p>
    <p style="text-align:center; margin: 20px 0;">
      <span style="display:inline-block; border: 2px dashed ${BRAND_COLOR}; padding: 12px 24px; font-size: 18px; font-weight: bold; letter-spacing: 1px; color: ${BRAND_COLOR};">
        ${user.coupon_code}
      </span>
    </p>
    <p style="text-align:center; font-size: 13px; color:#6b5f57;">Apply this code at checkout on your next order.</p>
    <p style="text-align:center; margin-top: 20px;">
      <a href="${process.env.NEXT_PUBLIC_SITE_URL || ''}/shop" style="background:${BRAND_COLOR}; color:#fff; padding: 12px 28px; text-decoration:none; border-radius: 4px; font-size: 14px;">
        See what's new
      </a>
    </p>
  `);
  return { subject, html };
}
