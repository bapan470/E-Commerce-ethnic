import './globals.css';
import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import Script from 'next/script';
import Providers from '@/components/providers';
import AnalyticsScripts from '@/components/analytics-scripts';
import { getServerSupabase } from '@/lib/supabase-server';
import { SeoSettings, AnalyticsSettings } from '@/lib/marketing-api';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.aruhihandlooms.com';

// Without this, Next.js statically renders this layout at build time and
// caches the getSeoSettings()/getAnalyticsSettings() Supabase reads below
// indefinitely (the Data Cache) -- so toggling GA4/GTM/Meta Pixel etc. in
// Admin > Marketing > Analytics writes to the DB immediately but the LIVE
// site keeps serving the old cached <script> tags until the next deploy.
// force-dynamic makes every request re-fetch these settings fresh, so
// admin changes take effect on the very next page load.
export const dynamic = 'force-dynamic';

const DEFAULT_SEO: SeoSettings = {
  site_title: 'AruhiHandlooms — Handwoven Indian Ethnic Wear & Sarees',
  meta_description:
    'Discover handpicked sarees, lehengas and ethnic wear from master weavers across India. Timeless craftsmanship, modern convenience.',
  keywords:
    'saree, ethnic wear, Indian boutique, handwoven sarees, lehenga, silk saree, banarasi, kanjivaram, bridal saree',
  og_image: '',
  google_site_verification: '',
  favicon_url: '',
};

// Reads Admin > Marketing > SEO settings (falls back to sensible defaults
// if nothing has been saved yet, or if Supabase is briefly unreachable).
async function getSeoSettings(): Promise<SeoSettings> {
  try {
    const supabase = getServerSupabase();
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'seo_settings')
      .maybeSingle();
    return { ...DEFAULT_SEO, ...((data?.value as Partial<SeoSettings>) || {}) };
  } catch {
    return DEFAULT_SEO;
  }
}

const DEFAULT_ANALYTICS: AnalyticsSettings = {
  ga_enabled: false,
  ga_measurement_id: '',
  gtm_enabled: false,
  gtm_container_id: '',
  google_ads_id: '',
  meta_pixel_enabled: false,
  meta_pixel_id: '',
  trustpilot_enabled: false,
  trustpilot_integration_key: '',
};

// Reads Admin > Marketing > Analytics settings (Google Analytics + Meta
// Pixel). Scripts are only injected when enabled and an ID is present.
async function getAnalyticsSettings(): Promise<AnalyticsSettings> {
  try {
    const supabase = getServerSupabase();
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'analytics_settings')
      .maybeSingle();
    return { ...DEFAULT_ANALYTICS, ...((data?.value as Partial<AnalyticsSettings>) || {}) };
  } catch {
    return DEFAULT_ANALYTICS;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const seo = await getSeoSettings();
  const keywords = seo.keywords
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: seo.site_title,
      template: '%s | AruhiHandlooms',
    },
    description: seo.meta_description,
    keywords,
    alternates: {
      canonical: '/',
    },
    openGraph: {
      title: seo.site_title,
      description: seo.meta_description,
      siteName: 'AruhiHandlooms',
      type: 'website',
      url: SITE_URL,
      images: seo.og_image ? [{ url: seo.og_image }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.site_title,
      description: seo.meta_description,
      images: seo.og_image ? [seo.og_image] : undefined,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
      },
    },
    verification: seo.google_site_verification
      ? { google: seo.google_site_verification }
      : undefined,
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const analytics = await getAnalyticsSettings();
  const gaId = analytics.ga_enabled ? analytics.ga_measurement_id.trim() : '';
  const gtmId = analytics.gtm_enabled ? analytics.gtm_container_id.trim() : '';
  const googleAdsId = analytics.google_ads_id.trim();
  const pixelId = analytics.meta_pixel_enabled ? analytics.meta_pixel_id.trim() : '';
  const trustpilotKey = analytics.trustpilot_enabled ? analytics.trustpilot_integration_key.trim() : '';

  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <head>
        <script src="https://checkout.razorpay.com/v1/checkout.js" async />

        {/* Trustpilot base script — registers window.tp() so
           <TrustpilotInvitation> (order confirmation page) can create
           review-invitation emails after a purchase. Key + on/off toggle
           live in Admin > Marketing > Analytics. */}
        {trustpilotKey && (
          <Script id="trustpilot-init" strategy="afterInteractive">
            {`
              (function(w,d,s,r,n){w.TrustpilotObject=n;w[n]=w[n]||function(){(w[n].q=w[n].q||[]).push(arguments)};
              a=d.createElement(s);a.async=1;a.src=r;a.type='text/java'+s;f=d.getElementsByTagName(s)[0];
              f.parentNode.insertBefore(a,f)})(window,document,'script','https://invitejs.trustpilot.com/tp.min.js','tp');
              tp('register', '${trustpilotKey}');
            `}
          </Script>
        )}

        {/* GTM / GA4 / Meta Pixel — gated so they never fire on /admin
            routes. See components/analytics-scripts.tsx. */}
        <AnalyticsScripts gaId={gaId} gtmId={gtmId} googleAdsId={googleAdsId} pixelId={pixelId} />
      </head>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
