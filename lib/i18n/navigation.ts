import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/** Locale-aware Link and router helpers. Use these instead of next/link for app pages. */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
