import { auth } from "@/lib/auth/server";
import { ALLOWED_GET_PATHS } from "@/lib/auth/allowed-paths";

/**
 * Better Auth's HTTP surface, cut down to the one thing the browser must reach: Google sending the
 * person back after sign-in (ADR 0006, audit finding 1).
 *
 * Everything else the app needs (start sign-in, sign out, set up and check the staff code) is done
 * by server actions calling `auth().api` directly, with our own checks around it. Leaving the
 * library's other endpoints reachable let anyone holding a staff session read or remove the
 * authenticator secret (`/two-factor/get-totp-uri`, `/two-factor/disable`) and check codes without
 * our attempt limit (`/two-factor/verify-totp`), which defeated the staff code check.
 *
 * Add a path here only after checking what it lets a signed-in user do to their own account.
 */


const notFound = () => new Response(null, { status: 404 });

export const GET = (request: Request) =>
  ALLOWED_GET_PATHS.has(new URL(request.url).pathname) ? auth().handler(request) : notFound();

// Nothing is posted to Better Auth from the browser; Google's callback is a GET.
export const POST = () => notFound();
