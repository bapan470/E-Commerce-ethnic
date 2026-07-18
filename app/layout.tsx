import './globals.css';
import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import Script from 'next/script';
import Providers from '@/components/providers';
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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://saaj.example';

const DEFAULT_SEO: SeoSettings = {
  site_title: 'Saaj — Handwoven Indian Ethnic Wear & Sarees',
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
  meta_pixel_enabled: false,
  meta_pixel_id: '',
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
      template: '%s | Saaj Boutique',
    },
    description: seo.meta_description,
    keywords,
    alternates: {
      canonical: '/',
    },
    openGraph: {
      title: seo.site_title,
      description: seo.meta_description,
      siteName: 'Saaj Boutique',
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
  const pixelId = analytics.meta_pixel_enabled ? analytics.meta_pixel_id.trim() : '';

  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <head>
        <script src="https://checkout.razorpay.com/v1/checkout.js" async />

        {gaId && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
            <Script id="ga4-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaId}');
              `}
            </Script>
          </>
        )}

        {pixelId && (
          <Script id="meta-pixel-init" strategy="afterInteractive">
            {`
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${pixelId}');
              fbq('track', 'PageView');
            `}
          </Script>
        )}
      </head>
      <body className="font-sans antialiased">
        {pixelId && (
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: 'none' }}
              src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        )}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
