import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import PublicLanding from '@/components/landings/PublicLanding';
import { cloudEnabled, getPublicLandingWithOrg } from '@/lib/server/db';
import type { LandingPageConfig } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function load(slug: string): Promise<LandingPageConfig | null> {
  if (!cloudEnabled()) return null;
  try {
    const found = await getPublicLandingWithOrg(slug);
    // On a store's own domain, only that store's landings.
    const domainOrg = headers().get('x-kx-domain-org');
    if (found && domainOrg && found.orgId !== domainOrg) return null;
    return found?.landing || null;
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
