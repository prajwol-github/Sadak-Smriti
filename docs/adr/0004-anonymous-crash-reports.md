# 0004: Crash reports without login

Date: 13 Nov 2026. Status: accepted (owner's decision).

## Context

SPEC 7.1 required a login for the crash form; visitors could only send a free-text tip. Families and witnesses in Nepal are the people most likely to know about a crash, and many will not create an account. Login also cannot work yet: it needs a Google OAuth client and an email service (owner tasks O-5, O-6).

## Decision

- Anyone can report a crash with the short form (`/submit`), with no login.
- A report never publishes anything. It creates a `draft` crash and a `pending` submission that a reviewer must approve. A report with no news link needs 2 approvals (SPEC 7.4, "only source is a contributor").
- The form has no people step, so it cannot be used to declare a named person dead. Names come later, with a source.
- Flood protection, in order: an off switch (`REPORTS_ENABLED`), a honeypot field, Cloudflare Turnstile, 3 reports per hour and 10 per day per IP hash, 300 per day for the whole site, and size limits on every field. The numbers live in `lib/net/rate-limit.ts` and SPEC 12.2.
- An optional contact (email or phone) is encrypted with a key kept outside the database, visible only to reviewers, and deleted 30 days after the decision (SPEC 12.3).

## Consequences

- SPEC 4.1, 4.2 (visitor may create a crash → review), 7.1, 12.1, 12.2 and 12.3 changed. `lib/policy/can.ts` and its matrix test change with them.
- The IP hash is only trustworthy once the server accepts traffic from Cloudflare alone (P0-14). Until then the limits are a development convenience, not a defence.
- Reviewers carry more load. The site-wide cap and the off switch exist to protect them; watch the queue during the closed beta (P5-09) and lower the numbers if needed.
- Logged-in users (later, P0-08) use the same form; their reports are credited to them and count against the 30-per-hour user limit instead.
