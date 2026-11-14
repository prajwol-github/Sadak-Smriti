# 0003: Bikram Sambat date library

Date: 13 Nov 2026. Status: accepted.

## Decision

Use `nepali-date-converter` (MIT, about 54,000 downloads a month, updated October 2026), wrapped by `lib/domain/bs-date.ts`. No other file calls the library. Dates move through the code as ISO strings (`YYYY-MM-DD`), never as JS `Date`, so the server's time zone cannot shift a crash by a day.

## How it is checked

`lib/domain/bs-date.test.ts`:
- 15 known pairs (new years 2076–2083, fiscal-year starts, Constitution Day, Republic Day, the spec's examples);
- **every day** from BS 2001 to the end of BS 2083 compared with a second, independent table (`nepali-datetime`, dev dependency only): all agree.

## The 2084 problem

BS month lengths are fixed each year by Nepal's calendar committee; for future years, every library's table is a projection. On 13 Nov 2026 the two tables **disagree from BS 2084** (from mid-April 2027) on 796 days, by one day.

- Crash dates recorded now are unaffected.
- Anniversaries ("Remembered today", `/remember`) and BS dates typed into forms for 2084 onward may be off by a day.

**Action before April 2027:** when the official BS 2084 calendar is published, check the library against it, update or patch the table, and move `SETTLED_UNTIL` in the test forward. A tripwire test fails when the two tables start to agree, as a reminder.

The library supports BS 2000–2090 (about AD 1943–2034). The wrapper throws `BsDateRangeError` outside that range instead of guessing.
