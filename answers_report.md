# Answers report

## 1. Why you do not see the guides on the site

The guides exist only in the local build until the site is deployed. I built them locally and did not push (your rule). They are the files `guides/*/index.html` and `ru/guides/index.html`. The live site shows them only after you commit, push and GitHub Pages / Cloudflare finish deploying.

Check locally first:
1. `npm run build`
2. `npm run serve` (opens http://localhost:8000)
3. Open http://localhost:8000/guides/ and http://localhost:8000/guides/freehold-leasehold/

Where visitors find them (links added by me):
- Footer, column "Explore": link "Buyer guides" (RU: "Полезное").
- Bottom of every location page: "Buyer guides:" line.
- Project pages with an ownership field: link to the freehold/leasehold guide.
- Sitemap: `/guides/` and 4 guide URLs (EN), plus RU hub and the RU guide.

There is no link in the top menu. If you want one, tell me and I add it (the menu order was set by you earlier, so I did not change it).

After deploy: if the page is still missing, hard-refresh (Ctrl+F5) and purge the Cloudflare cache.

## 2. What is GSC_ACCESS_TOKEN

GSC = Google Search Console. `GSC_ACCESS_TOKEN` is a short-lived OAuth token (about 1 hour) that lets `node scripts/seo-monitor.mjs --gsc` read your Search Console numbers (clicks, impressions, position, low-CTR pages). It is optional. Without it the script skips Search Console and shows no metrics.

How to get one (you do this, I cannot sign in to your Google account):
1. Make sure the Google account that owns the Search Console property of estate.nightdestiny.com is the one you use.
2. Fast manual way (testing): open https://developers.google.com/oauthplayground, in "Step 1" type the scope `https://www.googleapis.com/auth/webmasters.readonly`, click Authorize APIs, sign in, then "Exchange authorization code for tokens". Copy the **Access token**.
3. Run in a terminal (the token is not saved anywhere):
   ```
   GSC_ACCESS_TOKEN="paste-token" node scripts/seo-monitor.mjs --gsc
   ```
   If your property is a URL-prefix property and not a Domain property, add `GSC_PROPERTY="https://estate.nightdestiny.com/"`. For a Domain property the default `sc-domain:estate.nightdestiny.com` is used.
4. Token expires after about an hour: repeat step 2 next time.

Long-term (automatic) option: create a Google Cloud project, enable "Search Console API", create an OAuth client, and use a refresh token to get new access tokens. This needs code I have not written. Do not paste tokens into chat or commit them to git.

The report is written to `docs/seo/MONITOR_REPORT.md`.

## 3. Social posting: how it works, what credentials are needed

How it works now:
1. `node scripts/marketing.mjs batch` or `generate ...` creates drafts in `content/marketing/drafts/` (status draft, approval pending).
2. You read them in `content/marketing/preview.html` or in Pages CMS ("Marketing drafts"), fix the texts, clear the `needsReview` items.
3. Approve: `npm run marketing -- approve <draft-id> --by "Your name" --reviewed`
4. Test the post (nothing is sent): `node scripts/marketing-publish.mjs <draft-id> --channel facebook`
5. Real post only with `--send` and the credentials below set as environment variables.

Status: the posting code is **untested** (no credentials). Only Facebook, Pinterest and Instagram are coded. LinkedIn and YouTube are not implemented. Manual posting by copy and paste from the drafts always works.

| Channel | Environment variables | How to get them |
|---|---|---|
| Facebook Page | `FB_PAGE_ID`, `FB_PAGE_TOKEN` | Create a Facebook Page (you need a Page, not a personal profile). Create an app at developers.facebook.com, add the Graph API, use the Graph API Explorer to get a Page access token with `pages_manage_posts` and `pages_read_engagement`. Page ID is in the Page's "About" / "Page transparency". For long-lived tokens exchange the token as described in Meta's docs. Posting for other people's pages needs Meta App Review. |
| Instagram | `IG_USER_ID`, `IG_TOKEN` | Instagram account must be Business or Creator and linked to a Facebook Page. Use the same Meta app with `instagram_basic` and `instagram_content_publish`. The image must be a public URL (our site images work after deploy). Captions do not make links clickable. |
| Pinterest | `PINTEREST_TOKEN`, `PINTEREST_BOARD_ID` | Business account, create an app at developers.pinterest.com, get an access token with `pins:write` and `boards:read`. Trial access may only allow sandbox pins until Pinterest approves the app. Board ID comes from the boards API. |
| LinkedIn | not coded | Needs a LinkedIn app and the "Share on LinkedIn" / Community Management product (approval by LinkedIn). Post manually for now. |
| YouTube Shorts | not coded | Needs a real video file and OAuth for the YouTube Data API. The drafts contain the script; record and upload by hand. |

Keep tokens in your shell or a password manager. Never put them in the repo.

## 4. What to set up in Google Analytics and Search Console for lead tracking

The site already sends events (only on the production hostname `estate.nightdestiny.com`; GA4 ID `G-MKGM10XNQV`):

| Event | When | Useful parameters |
|---|---|---|
| `generate_lead` | click on any WhatsApp, phone or email link | `method` = whatsapp / phone / email, `link_location`, `item_type`, `item_slug`, `page_path`, `language` |
| `generate_lead` (new) | rent request form sent | `method` = `whatsapp_form`, `item_slug`, `link_location` = `rental_request_form` |
| `view_item` | project or listing page view | `items[0].item_id` |
| `filter_listings`, `language_switch` | filters, language switch | `filter_name`, `from_language`, `to_language` |

You must do these in the Google Analytics 4 interface (Admin):
1. Admin > Data display > **Events**: wait until `generate_lead` appears (test it: open the live site, click a WhatsApp button, check Admin > DebugView or Reports > Realtime). Then switch **"Mark as key event"** on for `generate_lead`. Earlier audit data showed 0 key events, so this switch is probably still off.
2. Admin > Data display > **Custom definitions** > Create custom dimension (scope: Event) for: `method`, `link_location`, `item_slug`, `item_type`, `page_type`. Without these the parameters are collected but cannot be used in reports.
3. Admin > Product links > **Search Console links**: link the Search Console property to GA4. Then Reports > Acquisition shows which search queries and pages lead to leads.
4. Optional: Admin > Data collection > turn on Google signals only if your privacy policy covers it.

In Search Console:
1. Add the property (Domain property is best) and verify it with the DNS record.
2. Sitemaps > submit `https://estate.nightdestiny.com/sitemap.xml` (after deploy).
3. URL inspection > "Request indexing" for the new `/guides/` URLs and the main location pages.
4. Search Console does not measure leads. It shows impressions, clicks and positions. Leads are measured in GA4. Linking both (step 3 above) joins them.

Limits: the lead events count button clicks, not real conversations. A click on WhatsApp does not prove the visitor wrote to you. The rent form event fires when the WhatsApp window is opened, not when the message is sent. The chat widget ID in settings loads only after interaction.

## 5. Things I did not verify

- The posting code against the real APIs (no credentials).
- That the live site shows the guides (not deployed from here).
- GA4 settings in your account (I have no access). Steps in section 4 are the standard ones; menu names can change in Google's interface.
