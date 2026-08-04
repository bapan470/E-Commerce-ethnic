import { formatINR, discountPct } from './format';

// The send-campaign route swaps this for a real, per-recipient tracking
// pixel (<img src=".../api/track/open/<id>" .../>) right before sending,
// so "open" is tracked per customer, per send.
export const TRACKING_PIXEL_PLACEHOLDER = '__TRACKING_PIXEL__';

// The send-campaign route swaps this for a real, per-recipient unsubscribe
// link (/api/unsubscribe/<send id>) right before sending -- same per-send
// uuid the tracking pixel reuses, so the link is unique per recipient and
// clicking it can only ever opt out that one person.
export const UNSUBSCRIBE_LINK_PLACEHOLDER = '__UNSUBSCRIBE_LINK__';

const BRAND_COLOR = '#7c3a1d';
const SITE_NAME = 'AruhiHandlooms';

export interface CampaignProduct {
  id?: string;
  name: string;
  slug: string;
  price: number;
  mrp?: number | null;
  image: string | null;
  url: string;
  category_name?: string | null;
}

export interface CampaignCategory {
  name: string;
  slug: string;
  image: string | null;
  url: string;
}

export type CampaignTemplateId = 'festive' | 'new-arrivals' | 'minimal' | 'introduction';

export const CAMPAIGN_TEMPLATES: { id: CampaignTemplateId; label: string; description: string }[] = [
  {
    id: 'introduction',
    label: 'Welcome Introduction',
    description: 'First-contact email for imported contacts — names the store they bought from, introduces us, clear opt-out',
  },
  {
    id: 'festive',
    label: 'Festive Sale',
    description: 'Bold banner + discount badge — best for offers/sale campaigns',
  },
  {
    id: 'new-arrivals',
    label: 'New Arrivals',
    description: 'Clean grid spotlighting fresh products — best for "just launched"',
  },
  {
    id: 'minimal',
    label: 'Minimal & Elegant',
    description: 'Quiet, editorial layout — best for storytelling / brand intro',
  },
];

// `sourceStoreName` is optional so existing calls (and the plain-text send
// path) keep working without it -- when present it makes the disclosure
// specific ("...from mishaboutique.com") instead of the generic fallback.
function unsubscribeFooter(sourceStoreName?: string) {
  const sourceClause = sourceStoreName
    ? `you previously purchased from <strong>${sourceStoreName}</strong>`
    : 'you previously purchased from one of our partner stores';
  return `
    <tr>
      <td style="padding: 20px 24px; text-align: center; font-size: 11px; color: #9a8f87; background:#fffaf5;">
        You're receiving this email because ${sourceClause}.
        <br/>
        <a href="${UNSUBSCRIBE_LINK_PLACEHOLDER}" style="color:#9a8f87; text-decoration:underline;">
          Not interested? Click here and we'll never email you again.
        </a>
        ${TRACKING_PIXEL_PLACEHOLDER}
      </td>
    </tr>`;
}

function header() {
  return `
    <tr>
      <td style="background:${BRAND_COLOR}; padding: 26px 24px; text-align: center;">
        <span style="color:#fff; font-family: Georgia, 'Times New Roman', serif; font-size: 24px; letter-spacing: 0.08em; text-transform: uppercase;">
          ${SITE_NAME}
        </span>
      </td>
    </tr>`;
}

// Mirrors the homepage's "Shop by Category" row — round thumbnails, name
// below, each one a real, clickable link straight to that category page.
// Email clients render <table> layouts far more reliably than flexbox, so
// this is built the same way the product grid is: a table of fixed-width
// cells, wrapped so it naturally goes to a new line every 4 categories.
function categorySection(categories: CampaignCategory[]) {
  if (!categories.length) return '';
  const shown = categories.slice(0, 8);

  // 4 categories per row (mirrors the homepage's 4-per-row mobile grid).
  const rows: string[] = [];
  for (let i = 0; i < shown.length; i += 4) {
    const rowCells = shown.slice(i, i + 4).map(
      (c) => `
      <td width="25%" style="padding: 6px 4px; text-align:center; vertical-align:top;">
        <a href="${c.url}" style="text-decoration:none; color:#2b2320;">
          ${
            c.image
              ? `<img src="${c.image}" width="64" height="64" alt="${c.name}" style="width:64px; height:64px; border-radius:50%; object-fit:cover; display:block; margin:0 auto; border:1px solid #eee2d8;" />`
              : `<div style="width:64px; height:64px; border-radius:50%; background:#f1e9e1; margin:0 auto;"></div>`
          }
          <p style="margin:6px 0 0; font-size:11px; font-weight:600; line-height:1.3;">${c.name}</p>
        </a>
      </td>`
    );
    const pad = 4 - rowCells.length;
    rows.push(`<tr>${rowCells.join('')}${'<td width="25%"></td>'.repeat(pad)}</tr>`);
  }

  return `
    <tr>
      <td style="padding: 6px 16px 4px;">
        <p style="margin:0 0 10px; text-align:center; font-size:11px; letter-spacing:0.15em; text-transform:uppercase; color:${BRAND_COLOR}; font-weight:bold;">Shop by Category</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join('')}</table>
      </td>
    </tr>`;
}

function productCard(p: CampaignProduct) {
  const pct = discountPct(p.price, p.mrp);
  const imgTag = p.image
    ? `<img src="${p.image}" width="240" alt="${p.name}" style="width:100%; max-width:240px; height:auto; display:block; border-radius: 6px 6px 0 0;" />`
    : `<div style="width:100%; height:180px; background:#f1e9e1; border-radius: 6px 6px 0 0;"></div>`;
  return `
    <td width="50%" style="padding: 8px; vertical-align: top;">
      <a href="${p.url}" style="text-decoration:none; color:#2b2320;">
        <div style="border:1px solid #eee2d8; border-radius:6px; overflow:hidden; background:#fff;">
          ${imgTag}
          <div style="padding: 10px 12px;">
            <p style="margin:0 0 4px; font-size: 13px; font-weight: 600; line-height:1.35; height: 34px; overflow:hidden;">${p.name}</p>
            <p style="margin:0; font-size: 13px;">
              <span style="font-weight:bold; color:${BRAND_COLOR};">${formatINR(p.price)}</span>
              ${p.mrp && pct > 0 ? `<span style="text-decoration:line-through; color:#9a8f87; margin-left:6px; font-size:12px;">${formatINR(p.mrp)}</span> <span style="color:#1f8a4c; font-size:12px;">(${pct}% off)</span>` : ''}
            </p>
            <p style="margin: 8px 0 0; font-size: 12px; color:${BRAND_COLOR}; font-weight:600;">Shop This →</p>
          </div>
        </div>
      </a>
    </td>`;
}

function productGrid(products: CampaignProduct[]) {
  const rows: string[] = [];
  for (let i = 0; i < products.length; i += 2) {
    const pair = products.slice(i, i + 2);
    rows.push(`
      <tr>
        ${pair.map(productCard).join('')}
        ${pair.length === 1 ? '<td width="50%" style="padding:8px;"></td>' : ''}
      </tr>`);
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join('')}</table>`;
}

function wrapDocument(bodyRows: string) {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0; padding:0; background:#f4efe9;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4efe9;">
      <tr>
        <td align="center" style="padding: 24px 12px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px; max-width:100%; background:#fffaf5; font-family: Georgia, 'Times New Roman', serif; color:#2b2320;">
            ${bodyRows}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function festiveTemplate(opts: {
  headline: string;
  subheadline?: string;
  discountBadge?: string;
  heroImage?: string | null;
  products: CampaignProduct[];
  categories: CampaignCategory[];
  ctaUrl: string;
  sourceStoreName?: string;
}) {
  const hero = opts.heroImage
    ? `<img src="${opts.heroImage}" width="600" alt="" style="width:100%; max-width:600px; display:block;" />`
    : '';
  return wrapDocument(`
    ${header()}
    <tr>
      <td style="padding:0;">
        ${hero}
        <div style="padding: 28px 24px 8px; text-align:center;">
          ${opts.discountBadge ? `<span style="display:inline-block; background:#fdece0; color:${BRAND_COLOR}; font-weight:bold; font-size:13px; letter-spacing:0.05em; padding:6px 14px; border-radius: 20px; margin-bottom:14px;">${opts.discountBadge}</span>` : ''}
          <h1 style="margin: 0 0 8px; font-size: 26px; color:${BRAND_COLOR};">${opts.headline}</h1>
          ${opts.subheadline ? `<p style="margin:0 0 18px; font-size:14px; color:#6b5f57;">${opts.subheadline}</p>` : ''}
          <a href="${opts.ctaUrl}" style="display:inline-block; background:${BRAND_COLOR}; color:#fff; padding:12px 32px; text-decoration:none; border-radius:4px; font-size:14px; font-weight:bold; margin-bottom: 20px;">Shop Now</a>
        </div>
      </td>
    </tr>
    ${categorySection(opts.categories)}
    <tr>
      <td style="padding: 8px 16px 20px;">
        ${productGrid(opts.products)}
      </td>
    </tr>
    ${unsubscribeFooter(opts.sourceStoreName)}
  `);
}

function newArrivalsTemplate(opts: {
  headline: string;
  subheadline?: string;
  products: CampaignProduct[];
  categories: CampaignCategory[];
  ctaUrl: string;
  sourceStoreName?: string;
}) {
  return wrapDocument(`
    ${header()}
    <tr>
      <td style="padding: 28px 24px 8px; text-align:center;">
        <p style="margin:0 0 6px; font-size:12px; letter-spacing:0.15em; text-transform:uppercase; color:${BRAND_COLOR};">Just In</p>
        <h1 style="margin: 0 0 8px; font-size: 24px; color:#2b2320;">${opts.headline}</h1>
        ${opts.subheadline ? `<p style="margin:0 0 18px; font-size:14px; color:#6b5f57;">${opts.subheadline}</p>` : ''}
      </td>
    </tr>
    ${categorySection(opts.categories)}
    <tr>
      <td style="padding: 8px 16px 12px;">
        ${productGrid(opts.products)}
      </td>
    </tr>
    <tr>
      <td style="padding: 8px 24px 24px; text-align:center;">
        <a href="${opts.ctaUrl}" style="display:inline-block; background:${BRAND_COLOR}; color:#fff; padding:12px 32px; text-decoration:none; border-radius:4px; font-size:14px; font-weight:bold;">View Full Collection</a>
      </td>
    </tr>
    ${unsubscribeFooter(opts.sourceStoreName)}
  `);
}

function minimalTemplate(opts: {
  headline: string;
  subheadline?: string;
  products: CampaignProduct[];
  categories: CampaignCategory[];
  ctaUrl: string;
  sourceStoreName?: string;
}) {
  return wrapDocument(`
    ${header()}
    <tr>
      <td style="padding: 36px 32px 12px; text-align:center;">
        <h1 style="margin: 0 0 10px; font-size: 22px; font-weight:normal; color:#2b2320;">${opts.headline}</h1>
        ${opts.subheadline ? `<p style="margin:0 0 22px; font-size:14px; color:#6b5f57; line-height:1.6;">${opts.subheadline}</p>` : ''}
      </td>
    </tr>
    ${categorySection(opts.categories)}
    <tr>
      <td style="padding: 0 16px 8px;">
        ${productGrid(opts.products)}
      </td>
    </tr>
    <tr>
      <td style="padding: 16px 24px 28px; text-align:center;">
        <a href="${opts.ctaUrl}" style="display:inline-block; border:1px solid ${BRAND_COLOR}; color:${BRAND_COLOR}; padding:11px 30px; text-decoration:none; border-radius:4px; font-size:13px; letter-spacing:0.05em;">Explore ${SITE_NAME}</a>
      </td>
    </tr>
    ${unsubscribeFooter(opts.sourceStoreName)}
  `);
}

// First-contact email for someone imported from another store's WooCommerce
// orders who has never interacted with us before. Its whole job is honest
// re-introduction, not selling: name the store they actually bought from,
// say plainly who we are and why we're emailing, then a real, prominent
// opt-out -- separate from (and above) the small print in the footer --
// so "not interested" is at least as easy to find as "shop now".
function introductionTemplate(opts: {
  headline: string;
  subheadline?: string;
  products: CampaignProduct[];
  categories: CampaignCategory[];
  ctaUrl: string;
  sourceStoreName?: string;
}) {
  const sourceLine = opts.sourceStoreName
    ? `you previously shopped at <strong>${opts.sourceStoreName}</strong>`
    : 'you previously shopped with one of our partner stores';
  return wrapDocument(`
    ${header()}
    <tr>
      <td style="padding: 32px 28px 4px; text-align:center;">
        <h1 style="margin: 0 0 12px; font-size: 22px; font-weight:normal; color:#2b2320;">${opts.headline}</h1>
        <p style="margin:0 0 18px; font-size:14px; color:#6b5f57; line-height:1.7;">
          We're reaching out because ${sourceLine}. ${SITE_NAME} is a separate,
          new store${opts.sourceStoreName ? ` — not ${opts.sourceStoreName}` : ''} — and this is the only email
          you'll get introducing us.
          ${opts.subheadline ? opts.subheadline : ''}
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 0 24px 24px; text-align:center;">
        <a href="${opts.ctaUrl}" style="display:inline-block; background:${BRAND_COLOR}; color:#fff; padding:12px 32px; text-decoration:none; border-radius:4px; font-size:14px; font-weight:bold; margin-right:10px;">Take A Look</a>
        <a href="${UNSUBSCRIBE_LINK_PLACEHOLDER}" style="display:inline-block; border:1px solid #9a8f87; color:#6b5f57; padding:11px 24px; text-decoration:none; border-radius:4px; font-size:13px;">Not Interested</a>
      </td>
    </tr>
    ${categorySection(opts.categories)}
    <tr>
      <td style="padding: 8px 16px 20px;">
        ${productGrid(opts.products)}
      </td>
    </tr>
    ${unsubscribeFooter(opts.sourceStoreName)}
  `);
}

export function buildPremiumCampaignHtml(opts: {
  templateId: CampaignTemplateId;
  headline: string;
  subheadline?: string;
  discountBadge?: string;
  products: CampaignProduct[];
  categories?: CampaignCategory[];
  heroImage?: string | null;
  sourceStoreName?: string;
}): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
  const ctaUrl = `${siteUrl}/shop`;
  const categories = opts.categories ?? [];

  switch (opts.templateId) {
    case 'introduction':
      return introductionTemplate({ ...opts, categories, ctaUrl });
    case 'festive':
      return festiveTemplate({ ...opts, categories, ctaUrl });
    case 'new-arrivals':
      return newArrivalsTemplate({ ...opts, categories, ctaUrl });
    case 'minimal':
    default:
      return minimalTemplate({ ...opts, categories, ctaUrl });
  }
}
