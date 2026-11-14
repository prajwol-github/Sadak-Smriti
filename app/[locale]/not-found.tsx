import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { SiteNav } from "@/components/site/site-nav";
import { SiteFooter } from "@/components/site/site-footer";

export default async function NotFound() {
  const t = await getTranslations("NotFound");
  return (
    <>
      <SiteNav />
      <main id="content" className="min-h-[60vh] px-4 py-10 lg:px-8 lg:py-16">
        <h1 className="text-[36px] lg:text-[44px]">{t("heading")}</h1>
        <p className="mt-3 max-w-[60ch] text-body text-neutral-700">{t("body")}</p>
        <Link href="/" className="btn btn-secondary mt-6">{t("home")}</Link>
      </main>
      <SiteFooter sample={false} />
    </>
  );
}
