import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

interface InvoiceOrderItem {
  product_name: string;
  size?: string;
  quantity: number;
  price: number;
}

interface InvoiceOrder {
  id: string;
  created_at: string;
  items: InvoiceOrderItem[];
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  shipping_address: {
    address?: string;
    address2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  } | null;
  subtotal: number | null;
  coupon_code: string | null;
  coupon_discount: number | null;
  shipping_charge: number | null;
  gst_amount: number | null;
  total_amount: number;
}

interface StoreInfo {
  name?: string;
  address?: string;
  gstin?: string;
  support_email?: string;
  support_phone?: string;
}

const rupee = (n: number) => `Rs. ${n.toLocaleString('en-IN')}`;

/**
 * Renders a simple, single-page GST invoice as a PDF and returns the raw
 * bytes. Kept deliberately plain (one font, one column layout) so it stays
 * legible without extra dependencies.
 */
export async function generateInvoicePdf(order: InvoiceOrder, store: StoreInfo): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  const pageWidth = page.getWidth();
  let y = page.getHeight() - margin;

  const primary = rgb(0.49, 0.23, 0.11); // matches the storefront's brand tone
  const muted = rgb(0.45, 0.45, 0.45);
  const black = rgb(0.1, 0.1, 0.1);

  const draw = (
    text: string,
    x: number,
    yPos: number,
    opts: { size?: number; f?: typeof font; color?: ReturnType<typeof rgb> } = {}
  ) => {
    page.drawText(text, {
      x,
      y: yPos,
      size: opts.size ?? 10,
      font: opts.f ?? font,
      color: opts.color ?? black,
    });
  };

  // ---- Header ----
  draw(store.name || 'Aruhi Handlooms', margin, y, { size: 20, f: bold, color: primary });
  y -= 16;
  if (store.address) {
    draw(store.address, margin, y, { size: 9, color: muted });
    y -= 12;
  }
  if (store.gstin) {
    draw(`GSTIN: ${store.gstin}`, margin, y, { size: 9, color: muted });
    y -= 12;
  }

  draw('TAX INVOICE', pageWidth - margin - 110, page.getHeight() - margin, { size: 14, f: bold, color: primary });
  draw(`Invoice #: ${order.id.slice(0, 8).toUpperCase()}`, pageWidth - margin - 150, page.getHeight() - margin - 18, {
    size: 9,
  });
  draw(
    `Date: ${new Date(order.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}`,
    pageWidth - margin - 150,
    page.getHeight() - margin - 30,
    { size: 9 }
  );

  y -= 20;
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: muted });
  y -= 24;

  // ---- Billing / shipping ----
  draw('Billed & Shipped To', margin, y, { size: 10, f: bold, color: primary });
  y -= 14;
  draw(order.customer_name || '-', margin, y, { size: 9 });
  y -= 12;
  const addr = order.shipping_address;
  if (addr) {
    const line1 = [addr.address, addr.address2].filter(Boolean).join(', ');
    if (line1) {
      draw(line1, margin, y, { size: 9, color: muted });
      y -= 12;
    }
    const line2 = [addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
    if (line2) {
      draw(line2, margin, y, { size: 9, color: muted });
      y -= 12;
    }
  }
  if (order.customer_phone) {
    draw(`Phone: ${order.customer_phone}`, margin, y, { size: 9, color: muted });
    y -= 12;
  }
  if (order.customer_email) {
    draw(`Email: ${order.customer_email}`, margin, y, { size: 9, color: muted });
    y -= 12;
  }

  y -= 16;

  // ---- Items table header ----
  const col = { item: margin, size: 300, qty: 370, price: 420, amount: 490 };
  draw('Item', col.item, y, { size: 9, f: bold });
  draw('Size', col.size, y, { size: 9, f: bold });
  draw('Qty', col.qty, y, { size: 9, f: bold });
  draw('Price', col.price, y, { size: 9, f: bold });
  draw('Amount', col.amount, y, { size: 9, f: bold });
  y -= 8;
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: muted });
  y -= 16;

  for (const item of order.items) {
    const amount = item.price * item.quantity;
    const name = item.product_name.length > 40 ? `${item.product_name.slice(0, 37)}...` : item.product_name;
    draw(name, col.item, y, { size: 9 });
    draw(item.size || '-', col.size, y, { size: 9 });
    draw(String(item.quantity), col.qty, y, { size: 9 });
    draw(rupee(item.price), col.price, y, { size: 9 });
    draw(rupee(amount), col.amount, y, { size: 9 });
    y -= 18;
    if (y < 200) break; // guard against absurdly long carts overflowing the page
  }

  y -= 8;
  page.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: muted });
  y -= 20;

  // ---- Totals ----
  const totalsX = 300;
  const subtotal = order.subtotal ?? order.items.reduce((s, i) => s + i.price * i.quantity, 0);

  const totalsRow = (label: string, value: string, opts: { f?: typeof font; color?: ReturnType<typeof rgb> } = {}) => {
    draw(label, totalsX, y, { size: 9, color: muted });
    draw(value, col.amount, y, { size: 9, ...opts });
    y -= 15;
  };

  totalsRow('Subtotal', rupee(subtotal));
  if (order.coupon_discount && order.coupon_discount > 0) {
    const code = order.coupon_code || '';
    const label = code.length > 14 ? `Coupon (${code.slice(0, 12)}...)` : `Coupon (${code})`;
    totalsRow(label, `-${rupee(order.coupon_discount)}`);
  }
  totalsRow('Shipping', order.shipping_charge ? rupee(order.shipping_charge) : 'FREE');
  totalsRow('GST (5%, included)', rupee(order.gst_amount ?? 0));
  y -= 4;
  page.drawLine({ start: { x: totalsX, y }, end: { x: pageWidth - margin, y }, thickness: 0.5, color: muted });
  y -= 16;
  draw('Total', totalsX, y, { size: 11, f: bold, color: primary });
  draw(rupee(order.total_amount), col.amount, y, { size: 11, f: bold, color: primary });

  // ---- Footer ----
  const footerY = 60;
  page.drawLine({ start: { x: margin, y: footerY + 20 }, end: { x: pageWidth - margin, y: footerY + 20 }, thickness: 0.5, color: muted });
  draw('This is a computer-generated invoice and does not require a signature.', margin, footerY, {
    size: 8,
    color: muted,
  });
  if (store.support_email || store.support_phone) {
    draw(
      `Questions? ${store.support_email || ''} ${store.support_phone ? `· ${store.support_phone}` : ''}`.trim(),
      margin,
      footerY - 12,
      { size: 8, color: muted }
    );
  }

  return doc.save();
}
