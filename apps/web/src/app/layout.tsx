import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Archivo_Black } from 'next/font/google';
import { Providers } from '@/components/providers/Providers';
import { RouteAnnouncer } from '@/components/accessibility/RouteAnnouncer';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const archivoBlack = Archivo_Black({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-archivo',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    template: '%s | Zero Sum Nutrition',
    default: 'Zero Sum Nutrition — AI-Powered Meal Planning',
  },
  description:
    'Personalized meal planning and macro tracking powered by AI. Get custom meal plans tailored to your goals, dietary preferences, and lifestyle.',
  keywords: [
    'meal planning',
    'macro tracking',
    'nutrition',
    'AI meal planner',
    'fitness tracking',
    'calorie counter',
    'personalized diet',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://zerosumnutrition.com',
    siteName: 'Zero Sum Nutrition',
    title: 'Zero Sum Nutrition — AI-Powered Meal Planning',
    description: 'Personalized meal planning and macro tracking powered by AI.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Zero Sum Nutrition — AI-Powered Meal Planning',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Zero Sum Nutrition — AI-Powered Meal Planning',
    description: 'Personalized meal planning and macro tracking powered by AI.',
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://zerosumnutrition.com'),
  alternates: {
    canonical: '/',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${archivoBlack.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-foreground antialiased font-sans">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:rounded-lg focus:shadow-lg focus:border focus:border-border focus:text-sm focus:font-semibold"
        >
          Skip to main content
        </a>
        <RouteAnnouncer />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
