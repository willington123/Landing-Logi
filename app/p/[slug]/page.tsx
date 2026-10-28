import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PublicLanding from '@/components/landings/PublicLanding';
import { cloudEnabled, getPublicLanding } from '@/lib/server/db';
import type { LandingPageConfig } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function load(slug: string): Promise<LandingPageConfig | null> {
  if (!cloudEnabled()) return null;
  try {
    return await getPublicLanding(slug);
  } catch {
    return null;
  }
}

const plain = (t?: string) => (t || '').replace(/\*\*/g, '');

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const l = await load(params.slug);
  if (!l) return { title: 'Oferta' };
  const title = plain(l.seoTitle) || l.productName;
  const description = plain(l.seoDescription) || plain(l.subheadline);
  const image = l.mainImage?.startsWith('http') ? l.mainImage : undefined;
  return {
    title,
    description,
    openGraph: { title, description, images: image ? [image] : undefined, type: 'website' },
    twitter: { card: 'summary_large_image', title, description, images: image ? [image] : undefined },
  };
}

export default async function PublicLandingPage({ params }: { params: { slug: string } }) {
  const cloud = cloudEnabled();
  const landing = await load(params.slug);
  // With the database on, a missing landing is a real 404 (better for Google and ads review).
  if (cloud && !landing) notFound();
  return <PublicLanding initial={landing} slug={params.slug} cloud={cloud} />;
}
