# Project Video (YouTube) - how it works

**Add a video:** Pages CMS > **Sale** (or New Projects) > open an entry > section **Project Video** > turn on *Enable Project Video* > paste a YouTube link > *Save*. After the save, the GitHub Action `Build content` rebuilds the page and the video appears after the project overview.

- Accepted links: `youtube.com/shorts/ID`, `youtube.com/watch?v=ID`, `youtu.be/ID`, `youtube.com/embed/ID` (also youtube-nocookie.com). Anything else (other domains, pasted iframe code) is rejected by the CMS field and ignored by the build (a warning is printed, no section is shown).
- Switch the video off with the toggle (the link is kept). Clear the link field to remove it. Empty or disabled = no section at all.
- Title (default "Project Video Tour"), description, format (vertical 9:16 default / horizontal 16:9), optional custom thumbnail (else the YouTube thumbnail), optional upload date.
- Upload date is only for Google's VideoObject markup: it is added only when you enter the real date. No date, no VideoObject.
- Nothing from YouTube loads until a visitor presses play, except the thumbnail image. Player: youtube-nocookie.com, no autoplay on page load.

Code: `parseYouTube`, `videoOf`, `projectVideo`, `videoLd` in `scripts/build.mjs`; click handler in `js/estate.js`; styles `.pv*` in `css/estate.css`; CMS fields in `.pages.yml` (projects > `video`). The old `videoUrl` field still works if present in a project file.

**Sale and New Projects:** the same *Project Video* group exists in both collections. A project that is listed on Sale is edited as a Sale entry; the video of the Sale entry is used first, and if it is off or empty the video from New Projects is used. Stand-alone Sale properties (no linked project) show their own video after the description. Rent entries have no video field.
