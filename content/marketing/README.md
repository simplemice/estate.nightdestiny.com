# Marketing drafts (internal)

Drafts are generated from real site data by `scripts/marketing.mjs`. **Nothing is published automatically.**

- Generate: `npm run marketing -- generate --type project_intro --slug the-kuartz` (types: project_intro, property_promotion, location_guide, project_comparison `--slugs a,b`, market_update, buying_guide; aliases social_post, short_video_script, pinterest_description, linkedin_article). `npm run marketing -- batch --limit 5` makes a sample set.
- Each draft: `status: draft`, `approval.state: pending`, `publishing.state: unpublished`, `needsReview` list, `source` reference, `destinationUrl`, `history`.
- Edit in Pages CMS ("Marketing drafts") or in the JSON. Preview all: `npm run marketing:preview` then open `content/marketing/preview.html` (noindex).
- Approve: `npm run marketing -- approve <id> --by "Name" --reviewed` (blocked while needsReview is non-empty unless `--reviewed`). Schedule field: `schedule <id> --at <ISO> --by "Name"` (a field only).
- Post (dry run by default): `node scripts/marketing-publish.mjs <id> --channel facebook|pinterest|instagram [--send]`. Needs env vars FB_PAGE_ID + FB_PAGE_TOKEN, PINTEREST_TOKEN + PINTEREST_BOARD_ID, IG_USER_ID + IG_TOKEN. Untested (no credentials). LinkedIn and YouTube are not implemented (OAuth / video upload).
- Rules: no invented prices, availability, facilities, progress or returns; missing data is left out and listed in `needsReview`.
