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
    <p style="font-size:13px; color:#6b5f57;">You can also check live status anytime from My Account &gt; Orders.</p>
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
