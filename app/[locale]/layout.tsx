import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Archivo, Noto_Sans_Devanagari } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { NavigationProgressBar } from "@/components/site/navigation-progress-bar";
import { routing } from "@/lib/i18n/routing";
import "../globals.css";

// Archivo for Latin, Noto Sans Devanagari for Nepali (design handoff README). next/font downloads
// them at build time and serves them from our own domain: visitors never contact Google
// (SPEC 11.4, 12.2).
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  variable: "--font-archivo",
  display: "swap",
});
const devanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "600", "800"],
  variable: "--font-devanagari",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Home");
  const locale = await getLocale();
  return {
    title: { default: t("metaTitle"), template: `%s · ${locale === "ne" ? "सडक स्मृति" : "Sadak Smriti"}` },
    description: t("metaDescription"),
    alternates: { languages: { ne: "/ne", en: "/en" } },
  };
}

export const viewport: Viewport = {
  themeColor: "#201e1d",
  width: "device-width",
  initialScale: 1,
};

export default async function LocaleLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${archivo.variable} ${devanagari.variable}`}>
      <body>
        <NextIntlClientProvider>
          <Suspense fallback={null}>
            <NavigationProgressBar />
          </Suspense>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
