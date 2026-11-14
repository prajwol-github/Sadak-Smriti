import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";

/** Shown to a reviewer or admin who has not confirmed their authenticator-app code in the last 12 hours. */
export async function NeedsCode() {
  const t = await getTranslations("TwoFactor");
  return (
    <div className="mx-auto max-w-xl px-4 py-10 lg:py-16">
      <h1 className="text-[32px] lg:text-[44px]">{t("title")}</h1>
      <p className="mt-3 text-body">{t("needsCode")}</p>
      <Link href="/account/two-factor" className="btn btn-primary mt-6 h-12 text-body">{t("confirm")} →</Link>
    </div>
  );
}
