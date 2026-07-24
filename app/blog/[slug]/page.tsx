import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  fetchPublishedBlogPostsServer,
  fetchPublishedBlogPostBySlugServer,
} from '@/lib/blog-api-server';
import { fetchCategoriesServer } from '@/lib/products-api-server';
import { blurDataURL } from '@/lib/utils';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.aruhihandlooms.com';

type Params = { params: { slug: string } };

export async function generateStaticParams() {
  const posts = await fetchPublishedBlogPostsServer();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const post = await fetchPublishedBlogPostBySlugServer(params.slug);
  if (!post) {
    return { title: 'Post not found | Aruhi Handlooms', robots: { index: false, follow: true } };
  }

  const url = `${SITE_URL}/blog/${post.slug}`;
  const title = `${post.title} | Aruhi Handlooms`;

  return {
    title,
    description: post.excerpt,
    keywords: post.keywords,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: post.excerpt,
      url,
      siteName: 'Aruhi Handlooms',
      type: 'article',
      images: [{ url: post.cover_image, width: 1200, height: 630, alt: post.title }],
      publishedTime: post.published_at,
      modifiedTime: post.updated_at || post.published_at,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: post.excerpt,
      images: [post.cover_image],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
    },
  };
}

export default async function BlogPostPage({ params }: Params) {
  const post = await fetchPublishedBlogPostBySlugServer(params.slug);
  if (!post) notFound();

  // Resolve the post's related category to its real slug so the CTA at the
  // bottom links to the SEO category page (/category/[slug]) rather than
  // hardcoding a URL that could drift if the category is renamed.
  let relatedCategorySlug: string | null = null;
  if (post.related_category_name) {
    const categories = await fetchCategoriesServer();
    relatedCategorySlug =
      categories.find((c) => c.name === post.related_category_name)?.slug ?? null;
  }

  const url = `${SITE_URL}/blog/${post.slug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    image: post.cover_image,
    datePublished: post.published_at,
    dateModified: post.updated_at || post.published_at,
    author: { '@type': 'Organization', name: 'Aruhi Handlooms' },
    publisher: { '@type': 'Organization', name: 'Aruhi Handlooms' },
    mainEntityOfPage: url,
  };

  return (
    <article className="container-boutique max-w-3xl py-8 pb-24 md:pb-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="mb-4 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-primary">
          Home
        </Link>
        {' / '}
        <Link href="/blog" className="hover:text-primary">
          Blog
        </Link>
      </nav>

      <h1 className="font-serif text-2xl font-bold text-primary sm:text-4xl">{post.title}</h1>
      <p className="mt-2 text-xs text-muted-foreground">
        {new Date(post.published_at).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}
        {' · '}
        {post.read_minutes} min read
      </p>

      <div className="relative mt-6 aspect-[16/9] w-full overflow-hidden rounded-2xl bg-muted">
        <Image
          src={post.cover_image}
          alt={post.title}
          fill
          sizes="(max-width: 768px) 100vw, 768px"
          placeholder="blur"
          blurDataURL={blurDataURL(32, 18)}
          className="object-cover"
          priority
        />
      </div>

      <div className="mt-8 max-w-none text-foreground">
        {post.body_paragraphs.map((para, i) => (
          <p key={i} className="mb-4 leading-relaxed text-foreground/90">
            {para}
          </p>
        ))}
      </div>

      {relatedCategorySlug && (
        <div className="mt-10 rounded-2xl border border-border bg-muted/40 p-6 text-center">
          <p className="font-serif text-lg font-semibold text-foreground">
            Shop the {post.related_category_name} collection
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Handpicked pieces, straight from the weavers.
          </p>
          <Link
            href={`/category/${relatedCategorySlug}`}
            className="mt-4 inline-block rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Browse {post.related_category_name}
          </Link>
        </div>
      )}

      <div className="mt-8">
        <Link href="/blog" className="text-sm font-medium text-primary underline">
          ← Back to all guides
        </Link>
      </div>
    </article>
  );
}
