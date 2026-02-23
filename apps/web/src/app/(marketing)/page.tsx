import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { isDevMode } from '@/lib/dev-mode';
import { PlasmaBackgroundLoader as PlasmaBackground } from './_components/PlasmaBackgroundLoader';
import { FAQ } from './_components/FAQ';
import { HeroSection } from './_components/HeroSection';
import { TrustBar } from './_components/TrustBar';
import { TestimonialsSection } from './_components/TestimonialsSection';
import { PipelineSection } from './_components/PipelineSection';
import { FeaturesGrid } from './_components/FeaturesGrid';
import { DifferentiatorsSection } from './_components/DifferentiatorsSection';
import { WhatYouGetSection } from './_components/WhatYouGetSection';
import { CTASection } from './_components/CTASection';
import { Footer } from './_components/Footer';

export const metadata: Metadata = {
  title: 'AI-Powered Meal Planning & Macro Tracking',
  description:
    'Join thousands of health-conscious individuals using AI-powered meal plans tailored to your fitness goals and dietary preferences. Free to start.',
  openGraph: {
    title: 'Zero Sum Nutrition — AI-Powered Meal Planning',
    description: 'Get personalized meal plans and track macros with AI. Free to start.',
  },
  alternates: {
    canonical: '/',
  },
};

export default async function HomePage() {
  let userId: string | null = null;

  if (isDevMode) {
    const cookieStore = await cookies();
    userId = cookieStore.get('dev-user-id')?.value || null;
  } else {
    const { auth } = await import('@clerk/nextjs/server');
    const result = await auth();
    userId = result.userId;
  }

  if (userId) {
    redirect('/dashboard');
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://zerosumnutrition.com';

  // Server-generated structured data for SEO - safe to use dangerouslySetInnerHTML
  // Content is entirely server-controlled (no user input), so XSS is not a concern here.
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'Zero Sum Nutrition',
        description: 'AI-powered personalized meal planning and macro tracking',
        url: appUrl,
      },
      {
        '@type': 'WebApplication',
        name: 'Zero Sum Nutrition',
        description: 'Personalized meal planning and macro tracking powered by AI',
        applicationCategory: 'HealthApplication',
        operatingSystem: 'Web',
        url: appUrl,
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
          description: 'Free meal planning and macro tracking',
        },
        featureList: [
          '6-Agent AI Pipeline',
          'FatSecret-Verified Nutrition Data',
          'Claude Vision Photo Scanning',
          '7-Day Personalized Meal Plans',
          'Real-Time Macro Tracking',
        ],
      },
    ],
  });

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        // nosec: content is server-generated JSON-LD, not user input
        dangerouslySetInnerHTML={{ __html: structuredData }}
      />

      <div className="relative min-h-screen">
        <PlasmaBackground />
        <HeroSection appUrl={appUrl} />
        <main id="main-content" className="relative z-10">
          <TrustBar />
          <TestimonialsSection />
          <PipelineSection />
          <FeaturesGrid />
          <DifferentiatorsSection />
          <WhatYouGetSection />
          {/* ─── SECTION 7.5: FAQ ─── */}
          <section className="mx-auto max-w-3xl px-6 py-12 sm:px-8 sm:py-20 lg:py-28">
            <div className="mb-12 text-center">
              <p className="section-label text-primary">{'/// FAQ'}</p>
              <h2 className="mt-3 font-heading text-3xl uppercase tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                COMMON QUESTIONS<span className="text-primary">.</span>
              </h2>
            </div>
            <FAQ />
          </section>
          <CTASection />
        </main>
        <Footer />
      </div>
    </>
  );
}
