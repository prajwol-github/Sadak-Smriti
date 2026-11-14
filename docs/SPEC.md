# Sadak Smriti (सडक स्मृति): product and technical specification

*Working name; to be replaced before launch. Version 1.2, 13 Nov 2026 (reviewed; changes are listed in Appendix C). The build plan is in [`PLAN.md`](PLAN.md). Status: agreed decisions, ready to build.*

---

## 0. How to read this document

- **Section 1** says what we are building and why. **Sections 2–4** are the decisions and the people involved.
- **Sections 5–9** describe what users see and do. **Sections 10–14** describe how it is built.
- **Section 15** is the build plan. **Section 16** lists the follow-up questions and how each was settled. **Section 17** lists the main risks.
- "Must" means required for launch. "Later" means planned but not in the first release.
- Evidence for the technical choices comes from the feasibility spike in `spike/` (results: `spike/SPIKE_RESULTS.md`).

---

## 1. Purpose

Road crashes in Nepal are reported as numbers: "Bus accident on Prithvi Highway: 23 dead." Sadak Smriti has two jobs:

1. **Remember people.** Every person killed has a page. Their family can add photos, a short life story and links to videos or posts, so that readers see a person, not a number.
2. **Make the problem measurable.** Every crash is recorded with when, where (down to the highway stretch), which vehicles, how many killed and injured, and the news sources. The data is open, so that researchers, journalists and road authorities can find dangerous stretches and track change over time.

**Who it serves**

| Audience | What they need |
|---|---|
| Families and friends | A dignified page for the person they lost, which they control |
| The public | An easy way to see what happened on the roads they use |
| Contributors | A fast way to report a crash or fix a mistake |
| Reviewers | A quick queue to check what others submitted |
| Researchers and journalists | Clean, sourced, downloadable data and a map of dangerous stretches |

**What success looks like after 12 months**

- At least 90% of road deaths reported in Nepali news are on the platform within 48 hours.
- At least 200 memorials have been claimed by a family.
- The data has been cited in at least one research paper or major news story.
- No wrong person has been published as dead (zero tolerance).

**Scope**

| In scope | Out of scope (for now) |
|---|---|
| Crashes on a road in Nepal, involving at least one moving road vehicle, where at least one person was killed or injured | Crashes with damage only and nobody hurt |
| Landslides, floods or rockfalls that hit a vehicle on a road. These are recorded but reported as a separate line (see 9.1) | Air, river and cable-car accidents |
| People of any nationality killed or injured in those crashes | Nepalis killed in road crashes abroad (a later decision) |

---

## 2. Decisions already made

These were agreed with the project owner on 13 Nov 2026. Don't reopen them without a new reason.

| Area | Decision | Why |
|---|---|---|
| Language | **TypeScript** everywhere (web app and background jobs) | Most widely used language, one language for contributors to learn |
| Framework | **Next.js** (App Router), server-rendered | Most popular React framework; server rendering keeps phones fast |
| Database | **PostgreSQL + PostGIS** | Mature, free, and handles maps, highways and distances natively |
| Hosting | **One Hostinger VPS** (KVM 2: 2 vCPU, 8 GB RAM, 100 GB disk), **India (Mumbai)** location, behind **Cloudflare** (free plan) | Lowest cost with full control; Mumbai is the closest region to Nepal |
| Login | **Google sign-in only** (magic links dropped 14 Nov 2026, ADR 0006). Reading needs no login | Free, familiar, no passwords to leak, no email service needed |
| Anonymous tips | Allowed: a short form with a captcha and rate limits; tips go to review | Witnesses won't create accounts |
| Reviewers | The owner is admin and invites trusted reviewers. Contributors can be promoted later based on their record | Safe start while the community is small |
| Approvals | **1 reviewer** for normal changes; **2 reviewers** for sensitive ones (section 7.4) | Fast, with extra protection where mistakes hurt |
| Interface languages | **Nepali and English** from day one | Families read Nepali; researchers need English |
| Names of the injured | **Shown, as in the news.** The person or their family can ask for their name to be hidden. **Injured children (under 18) are hidden by default**; the family can choose to show them. Injured people's pages are not indexed by search engines | Owner's decision; the opt-out and the children's rule limit harm |
| History | Automatic news collection **from launch day**, plus **Nepal Police yearly district totals** imported as background statistics. Older crashes can be added by hand | Cost and review effort |
| AI extraction budget | **About $5–25 per month.** Start with Claude Haiku 5.5 and send hard articles to Sonnet 5.5. Choose the model by measured accuracy | The spike measured roughly 60 relevant articles a day |
| Family claims | The family member explains the relationship and gives something checkable; **2 reviewers** approve | Gives families control without collecting ID documents |
| Media rules | No graphic crash or body images. Families can hide a memorial completely. Anyone can report any content | Dignity and safety |
| Licences | Code: **AGPL-3.0**. Crash statistics: **CC BY 4.0**. Name and logo **reserved** for the official site. **Family content (photos, stories) is not open data** | Keeps improvements shared and stops look-alike copies, while families keep ownership |
| Research at launch | Dashboard, open downloads and API, highway blackspot map, comparison with police statistics | Owner's choice |
| Alerts | Daily email digest for reviewers, plus a Telegram bot for big crashes (3 or more deaths) | Fast reaction to major events |
| Extras at launch | Works on slow 3G and low-end phones; donations link; annual remembrance page | Owner's choice |
| Team and timeline | One developer with Claude; MVP in about 2–3 months | Sizes the plan in section 15 |

---

## 3. Principles

These settle arguments during the build.

1. **Nothing reaches the public without a human.** Automation drafts and people approve. The spike showed why: outlets disagreed on 18 of 27 names and on several ages for a single crash.
2. **Every fact has a source.** Each number and name links to the news article, the person or the review that supplied it. Where sources disagree, the page says so ("reports said 10 → 13 → 14").
3. **Families have the final word on their person.** They can correct, enrich or hide the memorial. The crash still counts in the statistics even when a name is hidden.
4. **Dignity over drama.** No gore, no blame-heavy headlines, no autoplay. Language is calm.
5. **Cheap to run, easy to copy the method, hard to fake the brand.** Low running cost keeps the project alive. The method is open. The name stays with the official site.
6. **Light on phones.** Most visitors are on mobile data. A page should work on a $100 Android phone on 3G.
7. **Boring technology.** Choose a well-known tool over a clever one. Volunteers must be able to understand the code.

---

## 4. Users, roles and permissions

### 4.1 Roles

| Role | Who | Can do |
|---|---|---|
| **Visitor** | Anyone, no login | Read everything public; report a crash with the short form (captcha and limits; always reviewed, see 7.1); submit an anonymous tip; report content; light a candle |
| **Contributor** | Anyone logged in | Everything a visitor can, plus submit crashes, people, corrections, news links, photos and links. Each submission goes to review unless an auto-approve rule applies (7.3) |
| **Trusted contributor** | Contributor with at least 20 approved submissions and none rejected for abuse | Adding a news link to an existing crash and fixing typos publish immediately; everything else is still reviewed. The role is granted automatically and an admin can remove it |
| **Family guardian** | Contributor whose family claim for a specific person was approved | Edit that one person's memorial: life story, photos, links, visibility. Invite one more relative, who must also be approved |
| **Reviewer** | Invited by an admin | Approve or reject submissions, tips, reports and claims. Cannot approve their own submissions. Two-factor login required |
| **Admin** | The owner, plus at most 2 others | Manage roles, outlets, settings and bans; override decisions; read the audit log. Two-factor login required |

**Hard rules**
- Roles are checked in one shared permission module (see 12.2), never scattered across pages.
- A reviewer cannot approve a submission they created, and cannot provide both approvals of a two-approval item.
- Every role change is written to the audit log.

### 4.2 Permission matrix

The table lists actions, not pages. Where it says "→ review", the action creates a submission (section 7) instead of changing data directly.

| Action | Visitor | Contributor | Trusted | Guardian (own person) | Reviewer | Admin |
|---|---|---|---|---|---|---|
| Read public pages and data | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Submit an anonymous tip | ✓ (captcha) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Report content | ✓ (captcha) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create a crash | → review (captcha, limits) | → review | → review | | ✓ immediate (post-moderated) | ✓ immediate (post-moderated) |
| Add a news link to a crash | | → review | ✓ immediate | | ✓ | ✓ |
| Edit crash facts | | → review | → review | | ✓ with reason (logged) | ✓ |
| Add a person to a crash | | → review | → review | | ✓ immediate (post-moderated) | ✓ immediate (post-moderated) |
| Edit a person's facts (name, age, status) | | → review | → review | | ✓ with reason (logged) | ✓ |
| Edit a memorial's life story and links | | → review | → review | ✓ immediate (post-moderated) | ✓ | ✓ |
| Upload photos to a memorial | | → review | → review | ✓ immediate (post-moderated) | ✓ | ✓ |
| Hide a memorial | | | | ✓ immediate | 2 approvals | ✓ |
| Hide an injured person's name | | → review (person or family) | | ✓ | ✓ | ✓ |
| Merge two crashes or two people | | propose | propose | | 2 approvals | ✓ |
| Delete anything | | | | | 2 approvals | ✓ |
| Approve a family claim | | | | | 2 approvals | ✓ |
| See and act on the news queue | | | | | ✓ | ✓ |
| Start a news collection run ("Run now") | | | | | ✓ | ✓ |
| Decide on submissions (approve, reject, request changes; never your own, never twice) | | | | | ✓ | ✓ |
| See all accounts and their roles | | | | | ✓ | ✓ |
| Change a role (contributor ↔ reviewer only; admins are made on the server) | | | | | | ✓ |
| Deactivate or reactivate an account (reviewer: contributors; admin: contributors and reviewers; never an admin or yourself) | | | | | ✓ | ✓ |
| Manage roles, outlets, settings | | | | | | ✓ |

"Post-moderated" means the change goes live at once, appears in the reviewers' "recent changes" feed, and can be reverted with one click.

---

## 5. Core concepts (glossary)

| Term | Meaning |
|---|---|
| **Crash** | One road traffic event at one place and time. Can involve several vehicles. Has a status: `draft → pending → published`, or `rejected` / `merged` |
| **Person** | Someone killed, injured or uninjured in a crash. Belongs to exactly one crash |
| **Memorial** | The life-story part of a person's page (photos, biography, links). Exists only for people who were killed, or for survivors who opt in |
| **Source** | A news article, police bulletin, social post or eyewitness statement that supports facts |
| **Claim** | One sourced statement of a fact, for example "Kathmandu Post said deaths = 13 at 09:10". The published value is chosen from the claims |
| **Submission** | Any proposed change by a person or by the news pipeline. Reviewers approve or reject it |
| **Highway segment** | A 1 km piece of a numbered highway, used for blackspot statistics |
| **Verification level** | How well a crash is confirmed: `single_source`, `multi_source`, `reviewer_verified`, `family_confirmed` or `police_matched` |

---

## 6. Public experience (what visitors see)

### 6.1 Site map

| Path (`/ne/...` and `/en/...`) | Page |
|---|---|
| `/` | Home |
| `/map` | Full map |
| `/crash/[slug]` | Crash page |
| `/person/[slug]` | Person or memorial page |
| `/highway/[ref]` | Highway page, for example `/highway/NH04` |
| `/district/[slug]` | District page |
| `/remember` | Remembrance (anniversaries) |
| `/data` | Research dashboard, downloads and API documentation |
| `/search?q=` | Search |
| `/contribute` | How to help: report a crash, send a tip, become a reviewer |
| `/about`, `/methodology`, `/policies/*`, `/transparency` | About, how the numbers are made, content/privacy/takedown/trademark policies, costs and donations |

### 6.2 Home

**Must:**
- **Headline counter**, computed from published crashes and linked to `/methodology`.
  - Until the platform has covered a full Nepali year, it reads "recorded since" with the launch date, for example "412 people killed on Nepal's roads, recorded since 1 Magh 2083". A "this year" total would be misleading, because collection starts on launch day.
  - From the first full Nepali year onwards it reads "2084 BS so far: …".
  - The latest police yearly total is shown beside it for context.
- **"Remembered today"**: up to six people whose anniversary is today (BS date), shown as photo cards. Only people whose family hasn't hidden them, and only if a photo or story exists.
- **Recent crashes**: the latest 10 published crashes as a list, each showing place, date, killed and injured, and vehicles.
- **Map preview**: a static image of Nepal with recent crash dots. Tapping it opens `/map`. The interactive map isn't loaded on the home page, to save data.
- Buttons for **"Report a crash"** and **"Add a memory"**.

**Unhappy paths**
- No crashes yet: show "No crashes recorded yet" and a contribute link.
- Database unreachable: Cloudflare serves the last cached copy, with "data may be a few minutes old".

### 6.3 Map (`/map`)

**Must:**
- A full-screen map with vector tiles served from our own server (no API key, no per-view cost).
- **Layer 1, highways:** each numbered highway drawn as a line coloured by deaths per km for the selected period. Tapping a highway opens a side panel with its name and number, total crashes, killed and injured, the worst 5 km stretches, and a "Highway page" link.
- **Layer 2, crashes:** a dot per crash, sized by deaths and grouped into clusters when zoomed out. Tapping a dot opens a panel with date, place, vehicles, killed and injured, faces of the people (photo or initial), and a "Full crash page" link.
- **Filters:** period (this year, last year, last 3 years, custom; in BS or AD), severity (fatal only or all), vehicle type, and crash type.
- **Mobile:** the panel is a bottom sheet that can be dragged to half or full height. Filters sit behind one button.
- **Accuracy display:** crashes whose exact location is unknown appear at the centre of their local unit, drawn with a hollow dot, and the legend explains it.

**Unhappy paths**
- Tiles fail to load: show the list view of the same results (every map view also has a "List" toggle).
- More than 5,000 crashes in view: the server returns clusters, not points.

### 6.4 Crash page (`/crash/[slug]`)

The slug is readable, for example `2083-07-26-bhimphedi-makwanpur-microbus`.

**Must, top to bottom:**
1. **Title** written by a reviewer, for example "Microbus fell off the road at Chisapani Gadhi, Bhimphedi".
2. **Date in BS and AD, and time** if known. Shows "time not reported" if missing.
3. **Place:** place name, ward, local unit, district, province, highway and km, plus a small map. The location's accuracy is shown in words ("exact spot" or "within Bhimphedi").
4. **Facts:** killed, injured (serious and minor where known), people on board, vehicles (type, plate, route), and stated causes. Causes are always shown with who said them, for example "Police preliminary assessment, reported by Kathmandu Post".
5. **Disagreements**, wherever claims differ. For example: "Death toll reported as 10, 13, 14 (final: 14)". Expandable to see who said what and when.
6. **People:** cards for those killed first, then the injured. Each card shows photo or initial, name in Nepali and English, age, and hometown. Hidden names show as "Name withheld at family's request".
   - If fewer people are named than were killed, the page says so, for example "3 people not yet named".
   - Names a reviewer couldn't resolve (possible misspellings, or names found in only one report) stay in draft and aren't shown publicly.
7. **Sources:** every news article with outlet, title, date, type (report, follow-up or roundup) and an outbound link. We never copy article text onto the page (see the copyright row in 12.1).
8. **Verification badge**, for example "Confirmed by 6 outlets and a reviewer", and **"last updated"**.
9. **Actions:** "Suggest a correction", "Add a news link", "Add a person", "Report".

### 6.5 Person and memorial page (`/person/[slug]`)

**Must:**
- **Header:** photo (or a soft initial), name in both scripts, alias ("Chhotu"), age, hometown, BS and AD dates of the crash, and a status label ("Killed" or "Injured").
- **For people killed:**
  - **Life story:** written by the family or a reviewer, up to 2,000 characters.
  - **Photo gallery:** up to 30 photos, each with an optional caption.
  - **Videos and posts:** embedded YouTube, Facebook, Instagram or X posts and videos added as links (see 8.3), or a link card for other sites.
  - **"Who they were" short facts** the family chooses: occupation, school, hobbies, "loved…", and so on.
  - **Candles:** a count of candles lit, with a "Light a candle" button (no text, no login, one per device per day).
  - **Tributes:** short messages from visitors, up to 500 characters. Login is required and messages are reviewed before showing. Guardians can switch tributes off.
- **What the news said:** the facts from sources, with the different spellings outlets used, so families can see and correct them.
- **Status labels:** "Draft from news: not confirmed by family", or "Confirmed by family" with the date.
- **Actions:**
  - "I am family / a friend": start a claim.
  - "Add a memory": contributors' photos, stories and links go to review.
  - "Report".
  - "Share": a remembrance card image (6.8).
- **Hidden memorial:** the page shows "This memorial has been made private by the family", the crash still counts, and the name isn't shown anywhere: not in search, not in data exports, and not on the crash page.

**Search engines:** pages of people who were killed can be indexed. Pages of injured people carry `noindex`, so a search for a living person's name doesn't lead to their crash. Hidden pages are removed from the sitemap and return `noindex` at once; we can't recall copies that search engines or archives already hold, and the privacy policy says so.

**Injured people** get a simpler page: name, age and hometown as in the news, the crash link, and "Hide my name" or "Tell my story" (the survivor opts in to a memorial-style page).

### 6.6 Highway page and district page

**Highway page:**
- Name in both scripts, number, length and the map line.
- Totals by year.
- A chart of the worst 1 km segments, with the top 10 blackspots and their crash lists.
- Deaths by month, by vehicle type and by time of day.
- Recent crashes.

**District page:** the same layout per district, plus a comparison with Nepal Police figures for each fiscal year (see 9.4).

### 6.7 Remembrance (`/remember`)

- Lists everyone whose crash anniversary falls today (BS date), then this week.
- Can be filtered by district.
- Shows only people with a published, non-hidden memorial.
- **Later:** an optional email to a guardian a few days before the anniversary, if they opt in.

### 6.8 Sharing

- Every crash and person page has proper Open Graph tags.
- **Remembrance card:** a server-generated image, 1200×630 for Facebook and 1080×1350 for Instagram. It shows the photo, the name in both scripts, the dates, "Remembered on Sadak Smriti" and the page address.
- It is only generated when the guardian allows it. The default is allowed for people with an approved family claim and off for news-only drafts.

### 6.9 Search

- Searches names in both scripts and in spelling variants ("Guddu", "Gudu", "गुड्डु"), places, highways and plate numbers.
- Postgres full-text search plus trigram similarity on a transliterated name key (the spike's folding rules: sh→s, v→b, doubled letters collapsed).
- Hidden names never match.

### 6.10 Tone and visual design

- Quiet colours with plenty of white space. Red is used only for counts of deaths, never for decoration.
- No crash photos in lists. Faces of people are used rather than wreckage.
- Sentences are short. The words "fatalities" or "victims" aren't used for a person's own page; "killed" in facts and the person's name in text.
- **Accessibility:** WCAG 2.2 AA, meaning contrast of at least 4.5:1, touch targets of at least 44 px, everything usable by keyboard and screen reader, the map has a list alternative, and reduced motion is respected.

---

## 7. Contributing and reviewing

### 7.1 Ways to add a crash, easiest first

1. **Paste a news link** (logged in).
   - The server fetches the article and runs the same extraction as the news pipeline.
   - Within about 10 seconds the user sees a pre-filled form: date, place, vehicles, killed and injured, and people.
   - The user corrects anything wrong and submits.
2. **Short form** (no login needed; decided 13 Nov 2026, ADR 0004), one page that works without JavaScript:
   - **When:** date in BS (default) or AD, plus an optional time.
   - **Where:** district (required), an optional place name, and with JavaScript an optional local unit and "use my location".
   - **What happened:** killed and injured counts, and optional vehicle types.
   - **How do you know:** a news link, or "I saw it" with a short description (kept private for reviewers).
   - **Contact (optional):** an email or phone for a reviewer's follow-up question, encrypted and deleted 30 days after the decision (12.3).
   - People, plates, photos and crash type are added later, by a reviewer or through the other submission kinds. The form is protected from floods by a captcha and the limits in 12.2; anything from a visitor with no news link needs 2 approvals (7.4).
   - The full plan is in `docs/plans/report-a-crash.md`.
3. **Anonymous tip:** one screen with what, where, when (free text), an optional link or photo, an optional contact, and a captcha. A reviewer turns it into a crash.
   - A photo from an anonymous tip is re-encoded like any upload (8.1), is visible only to reviewers, is never published straight from the tip, and is deleted after 30 days if unused.

**Must, for all three:**
- **Duplicate check while typing.** As soon as date and district are known, show "Is it one of these?" with crashes from ±2 days in that district (and any plate match). Picking one turns the form into "add a source or correction to this crash".
- **Autosave.** Drafts are kept on the device, so a dropped connection doesn't lose work.
- **Validation:**
  - The date can't be in the future and isn't more than 20 years ago.
  - Killed and injured are whole numbers from 0 to 200.
  - At least one source or a witness statement.
  - Coordinates must fall inside Nepal (crashes abroad are rejected with a message, but Nepalis killed abroad are out of scope for now).
- **After submitting**, the user sees "Thanks, a reviewer will check this, usually within 24 hours", and the item appears in "My contributions" with its status.

### 7.2 News pipeline (automatic drafts)

This runs in the background worker every 30 minutes. It is based directly on the spike.

1. **Collect.**
   - Poll each outlet's RSS feed. The 8 that work today: Onlinekhabar NP/EN, Setopati, Ratopati, Kathmandu Post, Nepalnews, Khabarhub NP/EN.
   - Outlets without RSS (Kantipur, Himalayan Times, Republica and others) are polled through their section pages with a small per-outlet link extractor (**later**: phase 2b).
   - Each outlet has a health status in admin. After 3 failures in a row an admin is emailed.
   - **Polite collection:** obey each site's `robots.txt`, identify the bot with a user agent that links to an "about this bot" page, fetch at most one page every 5 seconds per outlet, and stop collecting from an outlet that asks us to.
2. **Filter.**
   - Apply the Nepali and English keyword rules from `spike/collect_rss.py`.
   - Skip URLs already seen; normalise them by removing tracking parameters.
3. **Fetch and clean.**
   - Download the article, forcing UTF-8 decoding (the spike found Onlinekhabar's text broke otherwise).
   - Extract the main text.
   - Store the text privately for audit and re-extraction, never showing it publicly, with a hash to catch reposts. The text is deleted after 12 months and the hash is kept.
4. **Extract.**
   - Send the text to Claude with the spike's schema (`spike/schema.py`, ported to Zod) using structured outputs.
   - Model: **Haiku 5.5 first**. The worker retries with **Sonnet 5.5** if the output fails validation, the article is a roundup, or the extraction reports 3 or more deaths.
   - Each call records tokens and cost.
   - The extraction also drafts a neutral title in both languages and gives each name in both scripts. A value the model transliterated itself, not found in the source, is marked "auto-transliterated" for the reviewer.
5. **Grounding check.** Every extracted name and age must appear in the source text (the spike's rule, which caught a real error). Failures are flagged on the draft rather than dropped.
6. **Match.**
   - Compare with crashes from the last 7 days, **including drafts that nobody has reviewed yet**, using the spike's rules: plate digits first, then district + date ±1 day + local unit + shared victim name + crash type, with a score of 6 or more. Without the drafts, 21 articles about one new crash would create 21 separate drafts.
   - A match with a **draft** attaches the article to that draft and adds its claims; the reviewer sees one draft with all its sources.
   - A match with a **published** crash produces an "add source / update facts" submission.
   - No match creates a new draft crash.
   - People are matched with the spike's person rules (phonetic name, ages, the same-article cannot-link rule). Uncertain pairs become merge suggestions.
7. **Alert.** If the crash is new and has 3 or more deaths, post to the reviewers' Telegram group with a link to the draft.
8. **Queue.** Drafts land in the review queue under "News drafts". Nothing is published automatically.

**Must, cost guard:**
- A monthly spend limit in settings, default $25.
- At 80% of the limit, admins are emailed.
- At 100%, extraction switches to Haiku only.
- At 120%, extraction pauses and articles are queued for manual review.

**Must, quality guard:**
- `pnpm eval:extraction` runs the extraction on a fixed labelled set (starting with the spike's 42 articles, growing by 20 per month) and prints the spike's metrics.
- A model or prompt change can only be merged if the metrics do not drop.

### 7.3 Submissions (one model for every change)

Every change, whether from a person or from the pipeline, is a **submission**. It records:
- `kind`: new_crash, edit_crash, add_source, remove_source, new_person, edit_person, memorial_edit, add_media, add_link, tribute, tip, merge_crashes, merge_people, split_crash, split_person, hide_name, hide_memorial, delete, or family_claim
- the target, the proposed data, a computed difference from the current values, and who submitted it
- its status: `pending → approved / rejected / changes_requested / withdrawn`

**Auto-approve rules** (the only ones):
- A trusted contributor adds a news link from a known outlet to an existing crash.
- A trusted contributor makes a typo-level edit, defined as an edit distance of 3 or less on a text field with no number changes.
- A guardian edits their own person's memorial. This is published immediately and post-moderated.

**Where unapproved data lives**
- A **new** crash and its people are stored as real rows with status `draft`. Drafts are invisible to the public, the API, exports and search. Approval changes the status to `published`.
- A change to something **already published** is stored only as the submission's proposed values. The public record changes when the submission is approved.
- If the record changed while a submission was waiting, the reviewer is shown the difference against the new values before approving (see 10.7).

**Status changes for people** (for example injured → killed after a death in hospital) are `edit_person` submissions and need a source.

### 7.4 Review

**Queue screen (`/review`):**
- **Tabs:** News drafts, Community, Tips, Family claims, Reports, Merges, Recent changes (post-moderated).
- **Each row shows:** type, place and date, the submitter (or "News pipeline"), age of the item, flags (grounding failed, conflict, possible duplicate, sensitive) and "1 of 2 approvals".
- **Sort:** oldest first by default; items with 3 or more deaths always go to the top.
- **Mobile:** the queue and the decision screen work on a phone, because reviewers often check on the go.

**Decision screen:**
- **Left:** the proposed record, with each field showing where it came from. Changed fields are highlighted against the current values.
- **Right:** the source article in a reader view (fetched text with the matched names and numbers highlighted), plus links to the original.
- **Conflicts** are shown inline: "Age: 25 (Onlinekhabar) or 35 (Kathmandu Post)". The reviewer picks one or writes another value, with a note.
- **Duplicate panel:** "Possible same crash: #812 (plate match)", with Merge or Not the same.
- **Buttons:** Approve, Edit and approve, Request changes (with a message to the submitter), and Reject (with a required reason picked from a list plus optional text).
- **Keyboard:** `A` approve, `E` edit, `R` reject, `J`/`K` next and previous.

**Needs 2 approvals** (by two different reviewers, neither of them the submitter):
- approving a family claim
- merging or splitting people or crashes
- hiding a memorial (when not requested by its guardian)
- deleting anything
- publishing a crash whose only source is a contributor (no news or police source)
- publishing a person as killed when no news source names them

The last two protect against the worst abuse: declaring a living person dead.

**Service levels and reminders:**
- News drafts with 3 or more deaths should be reviewed within 6 hours, everything else within 48 hours.
- The daily digest email at 07:00 Nepal time lists what is waiting and anything older than its target.

### 7.5 Reporting and takedown

- A **"Report"** button on every crash, person, photo, link and tribute.
- **Reasons:** wrong information · this person is alive · graphic or disturbing image · harassment or hate · privacy (please hide my or my relative's name) · copyright · spam · other.
- **Priority:** "This person is alive" and "graphic image" are high priority. The item is **hidden at once** pending review if it was reported by the item's guardian or by 3 different reporters within 24 hours.
- **Copyright and legal requests** go to an admin. A takedown contact email is on `/policies/takedown`.
- Reporters (if logged in) are told the outcome. Repeated false reports lower a user's trust; abuse leads to a ban.

### 7.6 Family claims

**Flow:**
1. On a person page, "I am family / a friend".
2. The claimant must be logged in. They give:
   - their relationship (parent, spouse, child, sibling, other relative, friend)
   - their full name
   - a short explanation
   - **at least one checkable item**: a phone number a reviewer may call, a link to a public condolence or funeral post naming them, or a reference from an existing guardian
3. Two reviewers approve (section 7.4). Approval makes the claimant a **guardian** of that person. The phone number is then deleted within 30 days; it is stored encrypted until then.
4. The guardian sees a **memorial dashboard**, `/me/memorials/[person]`, where they can:
   - edit the life story and facts
   - upload photos, reorder them and pick the cover
   - paste links (the preview is shown before saving, see 8.3)
   - switch tributes, the share card, and the whole memorial on or off
   - correct name spellings and age (this creates a sourced claim of type "family")
   - invite one more relative, whose claim goes through review but needs only 1 approval when an existing guardian vouches for them
5. **Disputes:** if two claimants conflict (for example a family dispute), an admin decides and may freeze edits. The memorial shows the last agreed version.

### 7.7 Notifications

- **To contributors:** an email and an in-app notice when their submission is approved, rejected (with the reason) or needs changes.
- **To guardians:** when someone adds a memory or tribute to their person, when a link they added stops working, and when anything on the memorial is reported.
- **To reviewers:** the daily digest and the Telegram alert. Neither contains people's names, only place, counts and a link.
- Every email type can be switched off in `/me/settings`, except security emails (new-device login, role change).
- Email is sent from the project's own domain with SPF, DKIM and DMARC set up, so magic links don't land in spam.

---

## 8. Memorial content and media

### 8.1 Photos

- **Formats:** JPEG, PNG, WebP and HEIC from phones, up to 15 MB each, up to 30 per person.
- **On upload:**
  1. Check the real file type from its first bytes, not its name.
  2. Decode and **re-encode** to WebP and AVIF at 3 sizes (320, 800 and 1600 px).
  3. **Strip all metadata, including GPS location.**
  4. Compute a perceptual hash.
  5. Reject the image if its hash matches one we removed before.
- The original is not kept, which reduces risk and storage. It is stored on the VPS disk under a random file name and served through Cloudflare's cache.
- **Review:** photos from non-guardians go to review. Guardian photos are post-moderated.
- **Later:** an automatic "graphic content" check before review.

### 8.2 Videos

There are no video uploads in version 1, because of storage and bandwidth cost. Families add videos by link (YouTube, Facebook and so on, see 8.3). **Later:** short uploads (up to 60 s) if donations allow.

### 8.3 Links and embeds

This uses the spike's resolver (`spike/embeds/resolve_link.py`, ported to TypeScript). It was tested in a real browser on 13 Nov 2026.

| Link | Shown as |
|---|---|
| YouTube video, short or live | Embedded player (`youtube-nocookie.com`) |
| Facebook public post or video | Embedded Facebook post or video |
| Instagram public post or reel | Embedded Instagram post |
| X post | Embedded post |
| TikTok video | A thumbnail card linking to TikTok (the embed failed in testing; to be re-tested) |
| Facebook, Instagram, X or TikTok **profile** | A "Profile" button. Profiles can't be embedded on any platform. The guardian chooses whether it shows |
| Any other website | A link card with title, site name and a small thumbnail from the page's own preview tags |
| Private, deleted or unreachable | Not shown publicly; the guardian is told "this link is no longer available" |

**Must:**
- **Click-to-load.** Embeds appear as a still preview with a play button. The platform's code loads only when the visitor taps it. This saves data and stops platforms tracking visitors who don't interact.
- **Resolved once on the server and stored.** Every link is **re-checked weekly**. One that fails twice is marked unavailable.
- Embed frames are sandboxed and allowed only from the listed platforms (12.2).
- **Preview thumbnails are saved on our server** as small images (480 px or less). A visitor's browser never contacts another site until they tap. A site owner can ask for a thumbnail to be removed.

### 8.4 Tributes and candles

- **Candles:** an anonymous counter, one per device per person per day, with a light rate limit by IP.
- **Tributes:** up to 500 characters; login required; reviewed before showing; links aren't allowed; guardians can switch them off or remove any tribute.

### 8.5 Ownership and removal

- **Family content belongs to the family.** Uploading grants Sadak Smriti a licence to display it on the site and in share cards only. It isn't included in open data.
- **A guardian can delete any photo or story at any time.** It is removed from the site and storage within 24 hours, and from backups after the backup retention period (35 days).

---

## 9. Research features

### 9.1 Data definitions (on `/methodology`)

- **Road crash death:** a person killed in a crash involving at least one moving road vehicle on a road in Nepal, as reported by a source. It includes people who die later from their injuries, once a source says so; the crash is updated.
- **Natural hazards:** a landslide, flood or rockfall that hits a vehicle on a road is recorded with crash type `natural_hazard`. Totals show these as a separate line, and every chart and download has a filter, so researchers can include or exclude them.
- **Seriously injured:** as reported ("गम्भीर घाइते"). When a source doesn't say, the person is counted only in total injured.
- **Date:** the date of the crash, not of the report. Stored in AD and displayed in both AD and BS. The Nepali fiscal year starts on 1 Shrawan.
- **Location accuracy:**
  - `exact`: a pin or within 200 m
  - `place`: a named place, within 2 km
  - `local_unit`
  - `district`
  
  Blackspot statistics use only `exact` and `place`.
- **Coverage warning:** the platform counts what news and the community report. It will undercount, especially in remote areas. The police comparison (9.4) shows by how much.

### 9.2 Dashboard (`/data`)

Filters apply to every chart: period, province, district, highway, vehicle type and crash type.

**Charts (must):**
- deaths and crashes by month (line chart)
- deaths by province or district (bar chart, plus a choropleth map)
- deaths by vehicle type
- deaths by crash type (fell off the road, head-on, hit pedestrian, and so on)
- deaths by time of day (in 3-hour groups)
- deaths by day of week
- age and sex of people killed, in 10-year groups
- road user type (driver, passenger, pedestrian, motorcyclist, pillion)
- stated causes as reported (with a note that these are not proven)
- top 20 highway blackspots
- platform versus police comparison

Each chart has "Download this data (CSV)" and is shown as a table for screen readers. Built with a light charting library and rendered on the server where possible.

### 9.3 Highway blackspots

- **Road network:** import Nepal from OpenStreetMap (the Geofabrik extract) into PostGIS. Highways are roads with a national highway reference (`ref=NH..`), joined into one line per highway and cut into **1 km segments**, numbered from the highway's start.
- **Snapping:** a crash with `exact` or `place` accuracy is linked to the nearest highway segment within 500 m. Otherwise it belongs to no segment and is counted only by area.
- **Blackspot score:** deaths and crashes per segment over a rolling 3 years. A segment is flagged when it has at least 3 fatal crashes in 3 years (a common threshold, adjustable in settings).
- **Rates are not shown** (deaths per vehicle-km), because Nepal has no traffic-volume data we can use. **Later:** add the Department of Roads' traffic counts if they become available.
- The network is refreshed quarterly from OSM. Segment IDs must stay stable: segments are recut only when a highway's geometry changes by more than 1 km, and old segment statistics are carried over by overlap.

### 9.4 Police statistics comparison

- An admin imports Nepal Police's published annual figures (accidents, deaths, serious and minor injuries per district per fiscal year) from a CSV, with the source document's link.
- District pages and the dashboard show platform deaths beside police deaths, and the coverage percentage.
- The police table is background data only. It never creates crash records.

### 9.5 Open data and API

**Downloads (`/data/downloads`), rebuilt nightly:**
- `crashes.csv`, `crashes.geojson`
- `people.csv`, with fields: crash_id, status, age, sex, road_user_type and hometown district. **No names, no memorial content.**
- `sources.csv`, with fields: crash_id, outlet, url, date and type
- `highway_segments.geojson` with statistics

Licence CC BY 4.0, with a suggested citation. **Monthly frozen snapshots** are kept so research can be repeated. **Later:** archive them on Zenodo to get a DOI.

**Read-only JSON API (`/api/v1`):**
- `GET /crashes?from=&to=&district=&highway=&vehicle=&min_deaths=&page=`
- `GET /crashes/{id}`
- `GET /highways`, `GET /highways/{ref}/segments`
- `GET /stats?group_by=month|district|vehicle|crash_type&...`

Rules:
- No key needed. Limited to 60 requests per minute per IP. CORS open.
- People appear in the API only as the same fields as `people.csv`.
- Versioned: breaking changes go to `/api/v2`.

**Excluded from all open data:** names, aliases, hometown below district, photos, stories, links, tributes and contributor identities.

**People whose name is hidden** stay in the data as anonymous rows, so the totals still add up. Their age is given as a 10-year band and their hometown is left out.

**A limit to be honest about:** even without names, a row can often be matched to a named news report through the crash, age and sex. Leaving names out stops bulk harvesting of names; it doesn't stop someone from reading the linked article. `/methodology` says this.

---

## 10. Data model

PostgreSQL (the current stable version that PostGIS supports, pinned at setup) + PostGIS. Every table has `id` (UUID v7), `created_at` and `updated_at`. All times are stored in UTC and shown in Nepal time (UTC+5:45).

### 10.1 Places and roads (reference data)

```text
provinces(id, code, name_en, name_np, geom MultiPolygon)
districts(id, province_id, code, slug, name_en, name_np, geom)
local_units(id, district_id, code, slug, name_en, name_np, type[metro|sub_metro|municipality|rural],
            wards int, geom)
place_aliases(id, local_unit_id?, district_id?, alias, lang)  -- spelling variants for matching: "Makwanpur", "मकवानपुर"
highways(id, ref "NH04", name_en, name_np, length_km, geom LineString)
highway_segments(id, highway_id, seq int, km_from, km_to, geom LineString)  -- stable IDs, see 9.3
police_stats(id, fiscal_year_bs "2081/82", district_id, accidents, deaths, serious, minor, source_url)
```

- **Source of boundaries:** the official list of 7 provinces, 77 districts and 753 local units with Nepali and English names, and boundary polygons from the government survey data published openly. The exact dataset is to be confirmed in phase 0.

### 10.2 Crashes

```text
crashes(
  id, slug unique, status[draft|pending|published|rejected|merged], merged_into_id?,
  title_en, title_np,
  occurred_on date, occurred_on_precision[day|month], occurred_time time?, time_source,
  location geography(Point)?, location_precision[exact|place|local_unit|district],
  place_name_en, place_name_np, ward int?,
  province_id, district_id, local_unit_id?, highway_id?, highway_segment_id?, km_marker numeric?,
  crash_type[fell_off_road|head_on|rear_end|side_impact|hit_pedestrian|hit_object|rollover|fire|natural_hazard|other|unknown],
  deaths int, injured_total int?, injured_serious int?, injured_minor int?, occupants int?,
  verification_level, created_via[news|contributor|tip|import],
  search_tsv tsvector, version int)
crash_vehicles(id, crash_id, type[bus|microbus|jeep|car|truck|tipper|tanker|tractor|motorcycle|scooter|
               e_rickshaw|bicycle|other], plate_raw, plate_key, ownership[private|public|government|unknown],
               origin, destination, notes)
crash_causes(id, crash_id, text_en, text_np, attributed_to "police preliminary assessment", source_id)
```

### 10.3 People and memorials

```text
persons(
  id, crash_id, slug unique, status[killed|injured|uninjured|unknown], merged_into_id?,
  name_en, name_np, alias, name_key (phonetic, for matching/search), age numeric?, age_disputed bool,
  sex[female|male|other|unknown], road_user[driver|passenger|pedestrian|rider|pillion|cyclist|unknown],
  hometown_text, hometown_local_unit_id?, died_on date? (if later than crash),
  name_visibility[public|hidden], memorial_visibility[public|hidden|none],
  publication[draft|published], version int)
memorials(person_id PK, story_en, story_np, facts jsonb, cover_media_id?, tributes_enabled bool,
          share_card_enabled bool, confirmed_by_family_at?)
person_guardians(person_id, user_id, relation, approved_at, added_by_claim_id)
family_claims(id, person_id, user_id, relation, full_name, explanation, evidence_url?,
              contact_phone_encrypted?, status, decided_at, purge_after)
media(id, person_id?, crash_id?, kind[photo], storage_key, width, height, blurhash, phash, caption_en,
      caption_np, uploaded_by, status[pending|published|rejected|removed], sort int)
links(id, person_id, url, normalized_url, platform, kind[video|post|profile|link|unavailable], embed jsonb,
      title, thumbnail_url, show_publicly bool, last_checked_at, fail_count, added_by, status)
tributes(id, person_id, user_id, body, status, created_at)
candles(person_id, day date, count int)           -- aggregated; device/IP de-dup in a short-lived table
```

### 10.4 Sources and claims

```text
outlets(id, name, homepage, feed_url?, language, active, last_polled_at, consecutive_failures)
sources(id, outlet_id?, kind[news|police|social|witness|other], url?, normalized_url unique?, title,
        published_at, language, text_private text?, text_hash, fetched_at)
crash_sources(crash_id, source_id, relation[report|follow_up|roundup|other])
claims(id, entity_type[crash|person|vehicle], entity_id, field, value jsonb,
       source_id? | submission_id? | user_id?, kind[news|police|family|contributor|reviewer],
       observed_at, chosen bool)
person_mentions(id, person_id, source_id, name_as_written, age_as_written, raw jsonb)
```

**Rule:** the published value on `crashes` or `persons` always equals one claim marked `chosen`, or a reviewer's value with a note. The disagreement display (6.4) reads from `claims`.

### 10.5 Workflow, trust and audit

```text
users(id, name, email unique, image, role[contributor|trusted|reviewer|admin], locale, trust_score int,
      show_name_publicly bool default false, email_prefs jsonb,
      banned_at?, ban_reason?, two_factor_enabled)
-- plus the auth library's own tables (accounts, sessions, verification tokens)
submissions(id, kind, target_type, target_id?, payload jsonb, diff jsonb, submitted_by? (null = tip/pipeline),
            via[web|tip|pipeline], ip_hash?, status, required_approvals int, flags text[], created_at)
reviews(id, submission_id, reviewer_id, decision[approve|reject|request_changes], reason_code?, note,
        unique(submission_id, reviewer_id))
reports(id, target_type, target_id, reason, details, reporter_id?, ip_hash?, status, resolved_by?, outcome)
revisions(id, entity_type, entity_id, version, data jsonb, submission_id?, actor_id?, created_at)  -- full history
audit_log(id, actor_id?, action, target_type, target_id, before jsonb?, after jsonb?, ip_hash?, at)
         -- append-only: the app's DB role has INSERT only, no UPDATE/DELETE
notifications(id, user_id, kind, target_type, target_id, read_at?, emailed_at?, created_at)
slug_redirects(old_slug, entity_type, entity_id, created_at)   -- old URLs keep working after a rename or merge
```

Contributors are credited by name on a page only if they switch on `show_name_publicly`. The default is "a contributor".

### 10.6 Pipeline

```text
feed_items(id, outlet_id, guid, url, title, seen_at, matched bool, status)
extraction_runs(id, source_id, model, prompt_version, input_tokens, output_tokens, cost_usd, output jsonb,
                grounding_failures jsonb, error?, created_at)
link_checks(id, link_id, checked_at, http_status, ok bool)
settings(key, value jsonb)   -- monthly AI budget, blackspot threshold, SLA hours, ...
```

### 10.7 Rules the database enforces

- **Uniqueness:**
  - `sources.normalized_url`
  - `persons.slug` and `crashes.slug`
  - one guardian row per (person, user)
  - one review per (submission, reviewer)
- **Foreign keys** use `ON DELETE RESTRICT` for facts. Removing anything goes through a "delete" submission that keeps a revision. Media files are physically deleted, and their row is kept as `removed`.
- **Merges** never delete. The loser gets `status=merged` and `merged_into_id`, and old URLs redirect.
- **Slugs can change**, for example when a title or a name is corrected. The old slug is kept in `slug_redirects` and redirects permanently.
- **Edit conflicts:** every crash and person has a `version`. An approval is applied only if the version is unchanged since the submission was made. Otherwise the reviewer is shown the difference again, against the new values.
- **Check constraints:** counts are at least 0; age is between 0 and 120; `occurred_on` is not in the future.
- **Indexes:**
  - GiST on all geometry columns
  - GIN on `search_tsv`
  - trigram on `name_key` and on place aliases
  - B-tree on (`district_id`, `occurred_on`) and on `vehicles.plate_key`

---

## 11. Architecture

### 11.1 Components

```text
            Visitors (mostly phones in Nepal)
                         │ HTTPS
                ┌────────▼────────┐
                │   Cloudflare    │  free plan: CDN cache, DDoS protection, WAF rules, Turnstile captcha
                └────────┬────────┘  only Cloudflare IPs may reach the server
                         │
  Hostinger VPS (KVM 2, India) ── Docker Compose ──────────────────────────────────
  │  caddy      reverse proxy, TLS (Cloudflare origin cert), static files, /media cache headers
  │  web        Next.js (standalone build): pages, server actions, /api/v1, OG images
  │  worker     Node (pg-boss later, ADR 0007): news pipeline, link checks, exports, digests, Telegram alerts
  │  postgres   PostgreSQL + PostGIS (data volume on NVMe)
  │  tiles      Nepal vector map tiles (one PMTiles file) served by caddy
  │  backup     nightly restic: pg_dump + /media → off-site object storage (encrypted)
  └────────────────────────────────────────────────────────────────────────────────────
  External: Claude API (extraction) · Resend or Brevo (email) · Telegram Bot API · Google OAuth ·
            Sentry free tier (errors) · uptime monitor (free) · off-site backup bucket (Cloudflare R2 free tier)
```

### 11.2 Technology choices

Before scaffolding, check current versions in the official docs and pin them in the lockfile.

| Concern | Choice | Notes |
|---|---|---|
| Language | TypeScript (strict) | |
| Web framework | Next.js, App Router, server components and server actions | Standalone output for Docker |
| Database access | Drizzle ORM and drizzle-kit migrations | SQL-like, supports custom PostGIS types; raw SQL for spatial queries |
| Validation | Zod | Shared by forms, server actions, the API and AI output |
| Auth | Better Auth 1.7 (Google + two-factor plugin for staff) | ADR 0006: the staff code check is ours, because the plugin does not challenge Google sign-ins |
| Background jobs | A `pipeline_runs` table for now; pg-boss when there are several kinds of jobs | ADR 0007. No Redis needed |
| i18n | next-intl, with `/ne` and `/en` routes | Nepali is the default for visitors from Nepal |
| Nepali dates | A maintained BS↔AD conversion library, with tests against known dates | Confirm the library at setup |
| Map | MapLibre GL JS + Protomaps PMTiles (Nepal extract) | No API keys, no per-view cost |
| Charts | A light SVG chart library, server-rendered where possible | |
| Images | sharp (re-encode, resize, strip metadata) | |
| Article text | Mozilla Readability + jsdom | Compare with the spike's trafilatura on the labelled set. If clearly worse on Nepali sites, run trafilatura as a small extra container for this step only |
| AI | Anthropic TypeScript SDK, structured outputs with the Zod schema | Model IDs: `claude-haiku-5-5`, `claude-sonnet-5-5` |
| Email | Resend or Brevo free tier | Magic links and digests |
| Captcha | Cloudflare Turnstile | Free |
| CSS | Tailwind CSS | Self-hosted Noto Sans Devanagari, subset |
| Tests | Vitest (unit), Playwright (end-to-end) | |
| Code quality | ESLint, Prettier, TypeScript strict, `pnpm` | |
| CI/CD | GitHub Actions → container images on GHCR → deploy over SSH | |

### 11.3 Code layout

```text
/app            Next.js routes ([locale]/..., api/v1/..., review/..., admin/...)
/components     UI components (no data access)
/lib
  /db           Drizzle client, schema and query functions (the only code that talks to the database)
/db             all SQL in one place: migrations/ (drizzle-kit output + custom SQL) and queries/
                (one generated .sql file per query, checked by a test); see ADR 0005
  /domain       business rules: crash matching, person matching, slugs, BS dates, verification levels
  /policy       permission checks (single source of truth, fully unit-tested)
  /pipeline     RSS, fetch, extract, ground, match (ported from spike/)
  /embeds       link resolver (ported from spike/embeds)
  /media        upload processing
/worker         job definitions and schedules
/scripts        imports: boundaries, OSM highways, police stats; eval:extraction
/docs           SPEC.md, methodology, ADRs (one file per architecture decision)
/spike          the feasibility test, kept as reference
```

### 11.4 Performance budget (slow 3G, low-end Android)

**Targets:**
- **Size:** HTML plus critical CSS under 50 KB compressed. JavaScript on non-map pages under 120 KB compressed. The map page's JavaScript loads only on `/map` (about 300 KB, cached afterwards).
- **Speed on a mid-range phone over 4G:** Largest Contentful Paint under 2.5 s. Under 5 s on 3G.

**How:**
- **Images:** responsive `srcset` in AVIF or WebP, lazy-loaded, with a blurhash placeholder. Lists use thumbnails of 320 px or less.
- **Caching:**
  - Public pages are rendered on the server and cached at Cloudflare for 60 s, refreshed in the background.
  - Pages are purged on approval for that crash or person.
  - **Only anonymous page views are cached.** A request with a login cookie skips the cache, and `/review`, `/admin` and `/me` are never cached. This keeps one user's page from being served to another.
  - Hiding a name or memorial purges the page, its share card and its photos from the cache at once.
  - Data files and tiles are cached for 1 day or more.
- **Fonts:** one Devanagari and one Latin font, subset and self-hosted.
- **Prefer the server:** no client-side data fetching for first render, and no third-party scripts except embeds after tap.

---

## 12. Security, privacy and abuse protection

### 12.1 Threats we design against

| Threat | Example | Main defences |
|---|---|---|
| Declaring a living person dead | A prank or harassment memorial | 2 approvals when no news source names them; "this person is alive" reports hide the page at once; every person must belong to a crash |
| Fake family takeover | A stranger claims a memorial to post abuse | 2-reviewer claims with a checkable item; guardian changes post-moderated; one-click revert; full history |
| Vandalism or false facts | Changing a death toll or adding false causes | Every edit is a submission with a source; revisions; trust scores; bans |
| Spam and bot submissions | Mass tips or account creation | Turnstile captcha, rate limits and a site-wide daily cap, login for anything but tips and the short crash form, Cloudflare bot rules |
| Graphic or illegal images | Crash gore, unrelated explicit images | Pre-review for non-guardians; report → auto-hide; perceptual-hash blocklist |
| Harassment of families | Hateful tributes | Tributes need login and review; guardians can disable them |
| Defamation | Naming a driver as guilty | Causes are always shown as "as reported by X"; no free-text blame field; legal takedown path |
| Copyright | Copying news text or news photos | Only facts, titles and links are shown; no news photos re-hosted; takedown procedure |
| Account takeover | Stolen reviewer or admin login | Two-factor login required for reviewers and admins; short admin sessions; new-device email alert |
| Server compromise | Exploited dependency or exposed port | Hardened VPS (12.4); least-privilege DB roles; dependency scanning; off-site encrypted backups |
| Data loss | Disk failure, bad migration | Nightly off-site backups, 35-day retention, a monthly restore test, migrations tested in staging |
| Tracking of visitors | Embeds loading Facebook or Google scripts | Click-to-load embeds; no analytics cookies (privacy-respecting, self-hosted page counts only) |

### 12.2 Application security (must)

- **Authorisation in one place.** Every server action and API route calls `can(user, action, resource)` from `/lib/policy`. There are unit tests for every row of the permission matrix (4.2). CI fails if a new route lacks a policy call; a lint rule or test enforces this.
- **Validation:** Zod on every input on the server, never trusting the client. Maximum lengths are set on all text.
- **Output safety:** React escapes output. There is no `dangerouslySetInnerHTML`, except for sanitised embed HTML from the resolver, and that only inside a sandboxed iframe.
- **Content Security Policy:**
  - nonce-based scripts
  - `frame-src` only `youtube-nocookie.com`, `facebook.com`, `instagram.com`, `platform.twitter.com` and `challenges.cloudflare.com`
  - `img-src` self only (preview thumbnails are stored on our server, see 8.3)
  - `object-src 'none'` and `base-uri 'self'`
- **Other headers:** HSTS, X-Content-Type-Options, Referrer-Policy `strict-origin-when-cross-origin`, and a Permissions-Policy disabling camera, microphone and location except on the submit page (map location only).
- **Forms:** server actions with Next.js origin checks, and same-site, `Secure`, `HttpOnly` cookies.
- **Rate limits** (stored in Postgres, keyed by user, or by IP hash for visitors). The visitor's IP is read from Cloudflare's `CF-Connecting-IP` header, which can be trusted because the server accepts traffic only from Cloudflare:

  | Action | Limit |
  |---|---|
  | Anonymous tips | 3 per hour per IP |
  | Crash reports from visitors (short form) | 3 per hour and 10 per day per IP hash; 300 per day for the whole site; plus an off switch (`REPORTS_ENABLED`) and a honeypot field |
  | Reports | 10 per hour |
  | Submissions | 30 per hour per user |
  | Login emails | 5 per hour per address |
  | API | 60 per minute |
  | Candles | 1 per person per day per device |

- **Server-side fetching protection.** The link resolver and "paste a news link" fetch URLs that users give. They:
  - allow only `http`/`https`
  - resolve DNS and block private, loopback and link-local addresses
  - time out after 10 s
  - read at most 5 MB
  - follow at most 3 redirects, re-checking each one
  - never send cookies
- **Uploads:** checked as in 8.1; size limits enforced by Caddy and by the app; files are served from a path with `Content-Disposition: inline`, the correct type, and `nosniff`.
- **AI output is treated as untrusted data.** It is validated by the schema and grounded, never executed or rendered as HTML. Article text in the prompt is wrapped as data, and the model is told to ignore instructions in it.
- **Secrets:** only in environment files on the server (mode 600) and in GitHub Actions secrets. `.env.example` is in the repo. Secret scanning is enabled on GitHub.
- **Dependencies:** lockfile committed; Dependabot; `pnpm audit` and CodeQL in CI; a weekly update window.

### 12.3 Data protection

- **Personal data we hold:**
  - users' name, email and image
  - claimants' phone numbers (encrypted with a key kept outside the database, and deleted 30 days after the claim decision)
  - the optional contact (email or phone) on a crash report, under the same rule: encrypted, visible only to reviewers, never in revisions, audit rows, exports or logs, deleted 30 days after the decision
  - IP addresses only as salted hashes, kept 30 days
  - private article text, for audit
- **Database roles:**
  - `app` can read and write, with no DDL, and only INSERT on `audit_log`
  - `migrator` holds DDL rights
  - `readonly` is for exports and the API
  - Postgres listens only on the internal Docker network
- **Privacy policy and data requests:** a privacy policy in Nepali and English, written for Nepal's privacy law; a lawyer will review it before launch. Users can download and delete their account. Their approved contributions stay, anonymised to "former contributor".
- **Families' requests to hide or delete** are handled within 72 hours. Hidden names are excluded from search, exports, the API, sitemaps and share cards.

### 12.4 Server hardening (must)

- Ubuntu LTS, unattended security upgrades, and a non-root deploy user.
- SSH by key only, with password and root login disabled, and fail2ban.
- **Firewall:** port 22 from anywhere (or from a fixed IP if available); ports 80 and 443 **only from Cloudflare IP ranges**. Everything else closed. Docker must not publish database ports.
- Cloudflare in "Full (strict)" TLS with an origin certificate.
- **Monitoring:**
  - an uptime check every 5 minutes
  - disk usage alert at 80%
  - Sentry for errors
  - daily email of backup success
- **Backups:** restic, nightly, encrypted, to an off-site bucket; 7 daily, 4 weekly and 12 monthly copies. **A restore test every month** to a scratch database, with a checklist in `/docs/runbooks/restore.md`.

### 12.5 Moderation tooling (must)

- Admins can ban a user, with a reason. A ban rejects pending submissions and hides their tributes.
- **Bulk revert:** "undo all changes by user X since date Y".
- **Read-only switch:** a global setting that puts the site in read-only mode during an attack.
- **Rejection reason codes** (`duplicate`, `no_source`, `wrong_info`, `abuse`, `graphic`, `off_topic`) feed contributor trust and the monthly moderation report.

---

## 13. Operations

### 13.1 Environments

- **Production and staging run on the same VPS** as two Compose projects with separate databases and domains. Staging is `staging.` with basic auth.
- **Local development:** `docker compose up` (Postgres/PostGIS) plus `pnpm dev`, seeded with synthetic crashes modelled on the spike's 8, with invented names (see section 14).

### 13.2 Deploy

1. Push to `main`.
2. CI runs lint, type checks, unit tests and end-to-end tests against a seeded Postgres, and builds the images.
3. Deploy to staging automatically.
4. Promote to production manually by clicking "Run workflow".
5. Migrations run first, in a one-off container.
6. A health check must pass, or the deploy rolls back to the previous image.

Migrations must be backwards-compatible for one release (expand, then contract).

### 13.3 Scheduled jobs (worker)

| Job | Schedule (Nepal time) |
|---|---|
| Poll RSS and run the pipeline | every 30 min |
| Re-check links | weekly, Sunday 02:00 |
| Rebuild exports and stats | nightly 01:00 |
| Reviewer digest email | daily 07:00 |
| Purge expired claim phone numbers and IP hashes | daily 03:00 |
| Backup | nightly 02:30 |
| AI cost check | hourly |
| Re-check outlet health | daily |

### 13.4 Running costs

Prices checked 13 Nov 2026. Hostinger's sale prices need prepayment and renew higher.

| Item | Monthly |
|---|---|
| Hostinger KVM 2 (2 vCPU, 8 GB, 100 GB NVMe), 24-month term | $8.79 (renews $14.99) |
| Domain (`.org` about $12/year, or a `.org.np`/`.com.np`, which is free for Nepali applicants) | $0–1 |
| Cloudflare Free (CDN, WAF, Turnstile, R2 backups up to 10 GB) | $0 |
| Email (free tier) | $0 |
| Telegram bot | $0 |
| Claude API extraction | $5–25 (capped by setting) |
| Sentry and uptime monitor (free tiers) | $0 |
| **Total** | **about $15–40 per month** |

**When to upgrade:**
- Move to KVM 4 when CPU stays above 70% or RAM above 6 GB on average for a week.
- Off-site backups will outgrow R2's free 10 GB once photos pass a few GB. Storage beyond that is paid per GB; check the price then.
- Move photos to R2 or another object store when they exceed 50 GB. The storage code has one interface so this is a configuration change.

### 13.5 Transparency and donations

`/transparency` lists monthly costs, donations received and the AI spend from `extraction_runs`. The donation link is Open Collective (works internationally). eSewa/Khalti are **later**; check their merchant requirements first (they may need a registered Nepali entity).

### 13.6 Continuity (if the owner is unavailable)

A memorial site must outlive its founder's free time.

- **Two people hold every key.** A second admin has access to the domain registrar, Cloudflare, the VPS, the backup bucket and its encryption password, GitHub and the email service. Secrets are kept in a shared password manager, never in chat.
- **Renewals:** the domain and VPS are on auto-renew, with renewal dates on `/transparency`.
- **Runbooks** in `/docs/runbooks/`: deploy, restore from backup, rebuild the server from nothing (target: back online within 4 hours), rotate secrets, handle a takedown.
- **If the project must end:** the open data and code stay public, families get 90 days' notice and a download of their own photos and stories, and the site is kept read-only for as long as hosting can be paid.

---

## 14. Open-source project setup

- **Repository files:**
  - README in English and Nepali: what it is, a screenshot, quick start, how to contribute
  - `CONTRIBUTING.md`: setup in 10 minutes, coding conventions, how to pick an issue, how reviews work
  - `CODE_OF_CONDUCT.md` (Contributor Covenant)
  - `SECURITY.md`: private vulnerability reporting through GitHub, 90-day disclosure
  - `TRADEMARK.md`: forks may use the code but must not use the name or logo, or present themselves as the official site
  - `LICENSE` (AGPL-3.0) and `DATA_LICENSE` (CC BY 4.0, with the exclusions in 9.5)
- **Issue labels:** `good first issue`, `help wanted`, `nepali-language`, `data`, `design`, `security`, plus issue templates for bug, feature and data correction (data corrections are redirected to the site's own correction form).
- **Branch protection:** PRs need passing CI and one maintainer review. Signed commits are encouraged.
- **Architecture decisions** are written as short files in `/docs/adr/` (context, decision, consequences). Every decision in section 2 becomes one in phase 0.
- **Seed data for development** is synthetic, with no real names. The spike's real data stays in `/spike` and isn't used in tests.
- **Volunteer roles beyond code:** reviewers, Nepali translators, outlet monitors (who add sites without RSS), and researchers (who check the methodology).

---

## 15. Build plan (one developer + Claude, about 12 weeks)

Each phase ends with something usable, checked by using it, not only by tests.

### Phase 0: foundations (week 1)

- Repository, licences, Compose, CI, the VPS provisioned and hardened, Cloudflare in front, an empty site deployed to staging.
- Auth (Google), roles, the policy module with tests.
- Import provinces, districts and local units, the OSM highways and segments, and the Nepal map tiles.
- i18n skeleton (`/ne` and `/en`) and BS date helpers with tests.
- **Done when:** you can log in on staging from a phone, switch language, and see a map of Nepal with highways drawn from our own tiles.

### Phase 1: crash records, end to end (weeks 2–4)

- Data model for crashes, vehicles, people, sources, claims, submissions, reviews, revisions and the audit log.
- Quick form, anonymous tip, duplicate check while typing.
- Review queue and decision screen, with 1 and 2 approvals.
- Public crash page, simple person page, home page, map with crash dots and the highway panel, search.
- **Done when:**
  - A contributor submits a crash on a phone; it appears in the queue; a reviewer approves it on a phone; it shows on the map and its page within 1 minute.
  - A duplicate is caught by the "Is it one of these?" prompt.
  - A reviewer can't approve their own submission.

### Phase 2: news pipeline (weeks 4–6)

- Port the spike to TypeScript: RSS, fetch (with forced UTF-8), extraction, grounding, crash and person matching.
- "Paste a news link" in the form.
- News drafts tab with the source reader and highlights; merge suggestions.
- Cost tracking and limits; Telegram alert for 3 or more deaths; daily digest.
- `pnpm eval:extraction` on the labelled set; choose Haiku or Sonnet by the numbers.
- **Done when:**
  - A day of real news produces drafts; the Makwanpur-style case (many outlets, two languages) becomes one draft crash with sources attached.
  - Eval metrics are at least as good as the spike's (crash merging 100% on the labelled set; person precision 100%).
  - The cost per day is shown in admin.

### Phase 3: memorials and families (weeks 6–8)

- Family claims with 2 approvals; the guardian dashboard.
- Photo uploads (processing, review, post-moderation), the link resolver with click-to-load embeds, weekly link checks.
- Candles and tributes; reports with auto-hide rules; hide-name and hide-memorial flows.
- **Done when:**
  - A test family claims a person and uploads 3 photos from a phone on slow 3G (simulated); the photos have no GPS data when downloaded; a YouTube and a Facebook link show as tap-to-play.
  - Hiding the memorial removes the name from search and exports at the next build.

### Phase 4: research and remembrance (weeks 8–10)

- Highway snapping and blackspots; highway and district pages.
- Dashboard charts; nightly CSV and GeoJSON exports; `/api/v1` with rate limits and documentation.
- Police statistics import and comparison.
- `/remember`, the home page's "Remembered today", share cards; the methodology page.
- **Done when:**
  - Downloading `people.csv` contains no names.
  - The API returns the same totals as the dashboard for the same filters (an automated test).
  - A highway page lists its worst segments.

### Phase 5: hardening and launch (weeks 10–12)

- Security review (OWASP checklist, the permission matrix tests, CSP check, a server-side fetch protection test), a load test (200 concurrent visitors on the home and map pages), and a performance check on a throttled low-end phone profile.
- A backup restore drill; the read-only switch tested.
- Policies (content, privacy, takedown, trademark) in both languages, with legal review.
- A closed beta with 3–5 invited reviewers for 2 weeks, then public launch.
- **Done when:** every item in 12.2 and 12.4 is checked, the restore drill passed, and the beta reviewers cleared the queue for 7 days in a row within the targets.

### If time runs short

Twelve weeks is tight for one developer. If a phase slips, cut in this order and move the item to "Later":

1. Tributes (keep candles)
2. Share cards
3. The JSON API (keep the CSV and GeoJSON downloads)
4. Police comparison charts (keep the import)
5. Automatic "trusted contributor" publishing (everything goes to review)
6. The Telegram bot (keep the email digest)

**Never cut:** the review workflow and two-approval rules, the hide-name and hide-memorial flows, reports, backups with a restore test, and the security items in 12.2 and 12.4.

### Later (after launch)

- Section-page scrapers for outlets without RSS.
- Survivor stories; anniversary emails to guardians.
- Automatic graphic-image detection.
- Zenodo DOIs for snapshots; traffic-volume data for rates.
- Short video uploads; offline mode (PWA); eSewa/Khalti donations.
- Nepalis killed in road crashes abroad (for example migrant workers): a separate decision.

---

## 16. Questions settled on 13 Nov 2026

The owner accepted every recommendation below, so each is now a decision. Several still need an action (choosing the name, finding reviewers and a lawyer, writing to outlets); those actions are tracked in `PLAN.md`, section 7.

| # | Question | Decision | Acted on by |
|---|---|---|---|
| 1 | Final name and domain | A short Nepali name with a `.org.np` and a `.org` | Phase 5 (trademark file) |
| 2 | Injured **children** (under 18): show names as the news did? | Hide by default, with the family able to show | Phase 1 |
| 3 | Which official boundary dataset (local units with ward polygons?) | The government's published local-level boundaries; wards later | Phase 0 |
| 4 | Do we display the **driver's** name for crashes where the driver survived? | Yes, as in the news, but never with blame language; same opt-out | Phase 1 |
| 5 | Legal review of privacy, takedown and family-content terms under Nepali law | Ask a volunteer lawyer or a digital-rights group in Nepal | Phase 5 |
| 6 | Who are the first 3–5 reviewers? | Ideally one journalist, one road-safety person and one person comfortable with Maithili/Bhojpuri names | Phase 1 end |
| 7 | Should family-written stories be offered in both languages automatically (machine translation, marked as such)? | Yes, opt-in per memorial, labelled "translated automatically" | Phase 3 |
| 8 | Who is the legal operator and public contact for takedown and legal letters? | Start in the owner's name with a project email; register a non-profit when donations begin | Phase 5 |
| 9 | Should search engines index the pages of injured people? | No (the spec's default in 6.5) | Phase 1 |
| 10 | How long do we keep the private copy of article text? | 12 months, then only its hash, unless the lawyer advises otherwise | Phase 2 |
| 11 | Is the working name already used by another organisation or site? | Search and check before buying the domain | Phase 5 |
| 12 | Will outlets object to automatic collection? | Write to the main outlets before launch, explain that we link to them and never copy their text, and ask for a contact | Phase 2 |

---

## 17. Risks

| Risk | Why it matters | What we do about it |
|---|---|---|
| **Too few reviewers** | In the spike, one afternoon of news gave about 8 crashes from 42 articles. Expect roughly 10–20 queue items a day before any community submissions. One person can't keep that up | Recruit 3–5 reviewers before launch (question 6). Fatal crashes are reviewed first. The oldest waiting item's age is shown on `/transparency`. Drafts are never published without review, even when the queue is long |
| **An outlet blocks us or redesigns its site** | Collection from that outlet stops silently | Outlet health checks and alerts (7.2), polite collection, contact with outlets before launch (question 12). "Paste a news link" still works for contributors |
| **A legal complaint or pressure** | Vehicle owners, operators or officials may object to being named | Facts are shown only with their source, causes only as "reported by", there is no blame field, a takedown path exists, and a lawyer reviews the policies (question 5) |
| **The single server fails** | Everything is on one VPS | Nightly off-site backups, a monthly restore test, and a rebuild runbook with a 4-hour target (13.6). Cloudflare keeps serving cached pages during short outages |
| **The owner becomes unavailable** | Families' memorials depend on the site staying up | The continuity plan in 13.6 |
| **Families don't come** | Without them the site is a crash database, not a memorial | Pages are already useful from news facts. Share cards and the remembrance page bring families in. Partner with road-safety groups and local journalists. Reviewers never contact a grieving family uninvited; the family comes to us |
| **A mistake hurts a family** | A wrong name, age or status on a memorial is painful | Human review before publishing, visible "draft from news" labels, a correction link on every page, and a 72-hour target for family requests |
| **The AI model is retired or its price changes** | Extraction stops or costs more | The model name is a setting, and the labelled test set (7.2) shows whether a replacement is good enough before switching |
| **The 12-week plan slips** | One developer, many features | The cut list in section 15 |

---

## Appendix A: evidence from the spike (13 Nov 2026)

| Finding | Detail |
|---|---|
| RSS feeds | 8 of 13 outlets have working feeds |
| Text extraction | 42 of 42 articles, after fixing a UTF-8 bug |
| Crash merging | 33 mentions became 8 crashes; precision and recall 100% |
| Person merging | 100% precision; 94% recall automatically, 100% after reviewing 4 flagged pairs |
| Grounding | 164 of 164 names and ages found in their sources |
| Source disagreement, Makwanpur crash | Toll reported as 10, 13, 14; 18 of 27 names spelled more than one way; 4 ages in conflict; 2 names never resolved |
| Embeds | YouTube, X, Facebook post and video, Instagram and link cards work with no API keys; TikTok unconfirmed |

**Caveats:** the extraction was done by Claude inside the session, not through the API. The matching rules were tuned on the same articles. A held-out week of news must be labelled and scored in phase 2 before trusting these numbers.

## Appendix B: example records

**Crash, as stored after review**

```json
{
  "slug": "2083-07-26-bhimphedi-makwanpur-microbus",
  "occurred_on": "2026-11-12", "occurred_time": "05:45", "time_source": "disputed: 05:45 / 06:10",
  "location_precision": "place", "place_name_en": "Chisapani Gadhi", "district": "Makwanpur",
  "local_unit": "Bhimphedi", "highway": null,
  "crash_type": "fell_off_road", "deaths": 14, "injured_total": 6, "occupants": 20,
  "vehicles": [{ "type": "microbus", "plate_raw": "Madhesh Province 03-001 Ja 0880", "plate_key": "030010880",
                 "origin": "Kathmandu", "destination": "Sarlahi" }],
  "verification_level": "multi_source", "sources": 21
}
```

**Disagreement claims for one field**

```json
[
  { "field": "deaths", "value": 10, "source": "kathmandupost", "observed_at": "2026-11-12T03:10Z" },
  { "field": "deaths", "value": 13, "source": "kathmandupost", "observed_at": "2026-11-12T07:40Z" },
  { "field": "deaths", "value": 14, "source": "onlinekhabar_en", "observed_at": "2026-11-12T11:05Z", "chosen": true }
]
```

## Appendix C: changes in version 1.1 (review of 13 Nov 2026)

**Errors fixed**
- The news pipeline now matches new articles against unreviewed drafts as well as published crashes (7.2). Before, many articles about one new crash would have created many duplicate drafts.
- The home page counter no longer claims a "this year" total in the launch year (6.2).
- Two broken cross-references (to 12.3 and 12.7) now point to the right sections.
- Reviewers, not only admins, need two-factor login (4.1); the two sections disagreed.
- Development seed data is synthetic everywhere (13.1); it contradicted section 14.
- People with hidden names stay in the statistics as anonymous rows (9.5); before, they were dropped and totals would not add up.

**Added**
- Scope table (section 1) and the rule for landslides and floods (9.1).
- Where unapproved data is stored, edit conflicts, and split/remove-source actions (7.3, 10.7).
- Notifications (7.7).
- Search-engine rules for injured and hidden people (6.5).
- Unnamed and unresolved people on the crash page (6.4).
- Polite collection rules for news sites (7.2).
- Cache safety for logged-in users and for hidden pages (11.4).
- Locally stored link thumbnails, so the image policy can be "our server only" (8.3, 12.2).
- Handling of photos sent with anonymous tips (7.1).
- Continuity plan (13.6), cut list (section 15), risks (section 17), and five more open questions (section 16).

**Version 1.2**
- All twelve questions in section 16 were settled as recommended. Injured children are hidden by default (section 2), and private article text is deleted after 12 months (7.2).
- The build plan was written as `PLAN.md`.
