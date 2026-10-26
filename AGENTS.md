# AGENTS.md

A hand-curated reading list of engineering blog posts, papers and roadmaps.
All content is hand-written JSON in `data/`.
The build validates it and writes `public/articles.json`, which the Vue site fetches.

## Checks

CI runs `npm run lint`, `npm run format`, `npm run typecheck` and `npm run build`.
Run all four before you commit. `npm run build-data` validates `data/` alone and redraws `assets/sources.svg`.
Never edit that file or anything in `public/` by hand.

## Entries

When tagging a blog entry, follow `docs/tags.md`.
The vocabulary is `src/shared/tags.ts`, and the build rejects any id outside it.
Every blog entry gets exactly one `domain` from the closed set there: `other` if nothing fits, never nothing at all.

Papers carry no tags.
They carry exactly one `topic` from the closed set in `src/shared/paperTopics.ts`, which the build checks.

A post from one person's own site goes in `data/personal.json` with no `source`.

A summary is one sentence of at most 120 characters.
Say the problem the team had, then what they did about it.
No metrics, sizes, durations or counts; a tool version ("MySQL 8.0") may stay.
Write it from the full text of the post, never from the title.

Before writing new entries to `data/`, list the candidates to the user as plain text, one URL per line.
After a sweep, update the source's "Read through" date in `README.md`.

## When a site blocks you

A 403, a 429, a Cloudflare challenge or an empty JavaScript shell means one route failed.
`docs/sources.md` records what worked on each site.
Check it first, then try these in order, and update it when you learn something new.

1. The source's RSS or Atom feed. Medium and Netflix feeds carry the full post in `content:encoded` for the latest ten posts.
2. curl with a browser `User-Agent` plus `Accept` and `Accept-Language` headers.
3. JSON embedded in the page, such as `__NEXT_DATA__`.
4. A dated Wayback snapshot, `https://web.archive.org/web/<YYYYMMDD>/<url>`, about 30 days after publication, then `https://archive.ph/newest/<url>`.
5. Another copy of the same text. Search the exact title for the author's own blog or a cross-post.
6. A headless browser (Playwright) for pages that only render with JavaScript.

## Git and code

Never use a git worktree to edit this repo. Always edit on the `main` branch and commit directly.
Comments are at most one line, never more, only write comments when necessary.
