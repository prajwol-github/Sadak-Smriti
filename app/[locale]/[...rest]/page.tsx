import { notFound } from "next/navigation";

/** Any unknown path under /ne or /en shows the localised not-found page (next-intl pattern). */
export default function CatchAll() {
  notFound();
}
