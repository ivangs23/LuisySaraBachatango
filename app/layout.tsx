import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { unstable_cache } from "next/cache";
import { getCurrentLocale } from '@/utils/i18n/get-locale';

const inter = Inter({ subsets: ["latin"] });

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://luisysarabachatango.com';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Luis y Sara Bachatango | Cursos Online de Bachata y Bachatango",
    template: "%s | Luis y Sara Bachatango",
  },
  description: "Aprende Bachata y Bachatango con Luis y Sara, instructores internacionales. Cursos online exclusivos, técnica profesional y comunidad de bailarines.",
  keywords: ["bachatango", "bachata", "tango", "cursos de baile online", "Luis y Sara", "aprender a bailar", "clases de bachata", "bachata online"],
  authors: [{ name: "Luis y Sara Bachatango" }],
  creator: "Luis y Sara Bachatango",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: BASE_URL,
    siteName: "Luis y Sara Bachatango",
    title: "Luis y Sara Bachatango | Cursos Online de Bachata y Bachatango",
    description: "Aprende Bachata y Bachatango con Luis y Sara, instructores internacionales. Cursos online exclusivos, técnica profesional y comunidad de bailarines.",
    images: [
      {
        url: "/luis-sara-about.jpg",
        width: 1200,
        height: 630,
        alt: "Luis y Sara Bachatango",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Luis y Sara Bachatango | Cursos Online de Bachata y Bachatango",
    description: "Aprende Bachata y Bachatango con Luis y Sara, instructores internacionales.",
    images: ["/luis-sara-about.jpg"],
  },
  alternates: {
    canonical: BASE_URL,
  },
};

import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { getCurrentUser } from "@/utils/supabase/get-user";

import { LanguageProvider } from '@/context/LanguageContext';
import { safeJsonLd } from '@/utils/jsonld';

// Cache profile per user for 60 seconds — reduces DB load on every page render.
// Uses service role (no cookies) because unstable_cache cannot call cookies() internally.
// Safe: userId is already validated by getUser() before this is called.
const getCachedProfile = unstable_cache(
  async (userId: string) => {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) return null;
    const supabase = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey
    );
    const { data } = await supabase
      .from('profiles')
      .select('role, avatar_url, full_name')
      .eq('id', userId)
      .single();
    return data;
  },
  ['user-profile'],
  { revalidate: 60 }
);

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  const locale = await getCurrentLocale();

  const profile = user ? await getCachedProfile(user.id) : null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Luis y Sara Bachatango',
    url: BASE_URL,
    logo: `${BASE_URL}/logo.png`,
    description: 'Plataforma exclusiva de cursos de Bachata y Bachatango con Luis y Sara, instructores internacionales.',
    sameAs: [
      'https://www.instagram.com/luisysaradance',
    ],
  };

  return (
    <html lang={locale}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
        />
      </head>
      <body className={inter.className}>
        <LanguageProvider>
          <Header user={user} profile={profile} />
          <main style={{ minHeight: '80vh' }}>
            {children}
          </main>
          <Footer />
        </LanguageProvider>
      </body>
    </html>
  );
}
