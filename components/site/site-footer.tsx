import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";

/** Footer row (README Home section 6), plus the sample-data notice while sample data is shown. */
export async function SiteFooter({ sample = process.env.SAMPLE_DATA === "1" }: { sample?: boolean }) {
  const t = await getTranslations("Footer");
  const site = await getTranslations("Site");
  const links: [string, string][] = [
    ["about", "/about"],
    ["methodology", "/methodology"],
    ["openData", "/data"],
    ["policies", "/policies"],
    ["transparency", "/transparency"],
    ["donate", "/transparency"],
    ["signIn", "/login"],
  ];
  return (
    <footer className="mt-auto border-t-2 border-ink">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-1 px-4 py-4 text-small text-neutral-700 lg:px-8 lg:py-6">
        <b className="text-ink">{site("name")}</b>
        {links.map(([key, href]) => (
          <Link key={key} href={href} className="flex min-h-11 items-center no-underline transition-opacity hover:underline active:opacity-60">
            {t(key)}
          </Link>
        ))}
        <span className="flex-1" />
        <a href="https://www.gnu.org/licenses/agpl-3.0.html" className="flex min-h-11 items-center no-underline transition-opacity hover:underline active:opacity-60">
          {t("code")}
        </a>
      </div>
      {sample && (
        <p className="border-t border-neutral-400 bg-surface px-4 py-2 text-meta font-semibold lg:px-8">{site("sampleData")}</p>
      )}
    </footer>
  );
}
