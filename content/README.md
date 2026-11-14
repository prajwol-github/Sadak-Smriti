# Adding yourself to the contributors page

Everyone on `/contribute` asked to be there. To add yourself, open a pull request that adds an entry to `contributors.json`.

```json
{
  "handle": "your-name",
  "name": { "en": "Your Name", "ne": "तपाईंको नाम" },
  "roles": ["code"],
  "bio": { "en": "One line about what you did.", "ne": "तपाईंले गरेको काम, एक वाक्यमा।" },
  "github": "your-github-username",
  "linkedin": "https://www.linkedin.com/in/your-profile/",
  "website": "https://your-site.example/",
  "since": "2026-11-14",
  "highlights": { "commits": 12 }
}
```

| Field | Required | Notes |
|---|---|---|
| `handle` | yes | Your page's address: `/contribute/<handle>`. Lowercase letters, digits and dashes |
| `name.en` | yes | `name.ne` (Devanagari) is optional but welcome |
| `roles` | yes | Any of `code`, `review`, `volunteer`, `translation`, `design`, `data`, `donor` |
| `bio` | no | Up to 240 characters in each language |
| `github`, `linkedin`, `website` | no | Links must start with `https://`; LinkedIn must be a `linkedin.com/in/…` profile |
| `since` | yes | When you started, as `YYYY-MM-DD` |
| `highlights` | no | Numbers for your page and share card: `commits`, `reviews`, `reports`, `translations`, `months` |
| `photo` | no | See below |

## Your photo

The site only loads images from its own server, so visitors' phones never contact other companies (SPEC 12.2). That means:

- **With a GitHub username:** leave `photo` out. A maintainer runs `pnpm contributors:avatars`, which saves your public GitHub avatar into `public/contributors/` once.
- **Without GitHub:** add a square photo (at least 400 × 400 px, JPEG, PNG or WebP) as `public/contributors/<handle>.jpg` and set `"photo": "/contributors/<handle>.jpg"`.
- **LinkedIn photos can't be used.** LinkedIn doesn't allow its images to be loaded or copied by other sites.
- Photos are shown in black and white, like everything on the site.
- With no photo, your card shows your initial.

## Donors

Add `"donor"` to `roles` only if you want to be named. To be counted without your name, ask a maintainer to increase `anonymousDonors` instead. Amounts are never published here; the totals are on `/transparency`.

## Checking your entry

`pnpm check` validates the file. A wrong field fails the test with the field's name, and a missing photo file fails too.

The entries marked `"sample": true` are invented examples and will be removed once real contributors are listed.
