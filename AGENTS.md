# AGENTS.md

This repo is Awesome Engineering Blogs & Papers, a hand-curated reading list of engineering blog posts, papers and learning roadmaps. The site is Vue 3 and Vite, prerendered to static HTML and hosted on Cloudflare Pages. All content is hand-written JSON in `data/`. The build validates it and writes the files the site fetches.

## Commands

| Command               | What it does                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------- |
| `npm run build-data`  | Validate `data/`, write `public/articles.json` and `public/roadmaps/`, redraw `assets/sources.svg` |
| `npm run build`       | The same validation, then the production build into `dist/`                                        |
| `npm run typecheck`   | `vue-tsc --noEmit`                                                                                 |
| `npm run lint`        | oxlint                                                                                             |
| `npm run format`      | oxfmt check, Markdown included; `npm run format:fix` rewrites the files                            |
| `npm run tag-stats`   | The numbers `docs/tags.md` judges vocabulary changes by                                            |
| `npm run fetch-icons` | Fetch missing source icons into `public/icons/`                                                    |

CI runs lint, format, typecheck and build on every push to `main`. Run all four before you commit. A change whose checks you did not run is not done.

## Layout

- `data/<source>.json`: one file per company blog. `data/personal.json` holds personal-blog posts and `data/papers.json` the papers. Every top-level file in `data/` is read as entries.
- `data/roadmaps/<topic>.json`: one learning roadmap each.
- `src/shared/`: the contract between the data and the site. `entry.ts` defines the entry fields, `tags.ts` the tag vocabulary, `paperTopics.ts` the paper topics.
- `scripts/`: build-time scripts. `scripts/lib/validate.ts` holds the entry checks.
- `docs/tags.md` says how to tag. `docs/sources.md` says how to reach each source.
- Generated, never edited by hand: `public/articles.json`, `public/roadmaps/` and `dist/` (gitignored), and `assets/sources.svg` (committed, redrawn by `npm run build-data`).

## Entries

An entry needs `title`, `url`, `publishedAt` (YYYY-MM-DD) and `source`, except a personal-blog post, which has no `source`. The full field list is in `src/shared/entry.ts`.

**Blog entries.** When tagging a blog entry, follow `docs/tags.md`. The vocabulary is `src/shared/tags.ts`, and the build rejects any id outside it. Every blog entry gets exactly one `domain` from the closed set there: `other` if nothing fits, never nothing at all.

**Papers.** Papers carry no tags. They carry exactly one `topic` from the closed set in `src/shared/paperTopics.ts`, which the build checks. Tags exist to narrow hundreds of blog posts. For a paper the reader's question is what to read next, which a tag cannot answer.

**Personal blogs.** A post from one person's own site (own domain, github.io, Substack, Blogspot, a personal Medium or dev.to) goes in `data/personal.json`. Company blogs, open-source project blogs and publications do not count, even when one engineer wrote the post.

**Summaries.** One sentence of at most 120 characters, checked as `SUMMARY_MAX` in `scripts/lib/validate.ts`. Say the problem the team had, then what they did about it. For a debugging or incident post, that is the symptom, then the root cause and the fix. No numbers: no metrics, sizes, durations or counts, in digits or in words. A tool version ("MySQL 8.0") and digits inside a name (S3) may stay. Write the summary from the full text of the post and check every fact against it.

## Adding posts

1. For each source, find the posts published after its "Read through" date in the `README.md` table. `docs/sources.md` lists the feed or listing page to use.
2. Read every candidate in full. List the candidates to the user as plain text, one URL per line, before you write anything to `data/`. Expect only a few to be kept.
3. Write the kept entries and run `npm run build-data`. Set each swept source's "Read through" date in `README.md` to the day of the sweep. A source you could not read keeps its old date.

## When a site blocks you

A 403, a 429, a Cloudflare challenge page or an empty JavaScript shell means one route failed. Check `docs/sources.md` for a route that already worked on that site, then work down this list until one gives you the full original text:

1. The source's RSS or Atom feed. Medium and Netflix feeds carry the whole post in `content:encoded`, for the latest ten posts only.
2. curl with a browser `User-Agent` plus `Accept` and `Accept-Language` headers. Some sites reject only bare clients.
3. The data inside the page. Client-rendered sites often ship the body as JSON in a script tag, such as `__NEXT_DATA__`.
4. A dated Wayback snapshot, `https://web.archive.org/web/<YYYYMMDD>/<url>`, with a date about 30 days after publication. Request the snapshot directly. The CDX API rate-limits fast, and recent snapshots of Medium pages are an empty shell.
5. `https://archive.ph/newest/<url>`.
6. Another copy of the same text. Search for the exact title to find the author's own blog, a cross-post on Medium or LinkedIn, or the company's mirror. Someone else's write-up can point you to a copy, but it is not the post.
7. A headless browser (Playwright) for pages that only render with JavaScript and for links that redirect through JavaScript.

While you do this:

- Never try to pass a CAPTCHA, a bot challenge or a login wall, and never use a paywall-removal service.
- Save each fetched page to a file once and work from the file. Do not fetch the same URL again to look at it another way.
- On a 429, slow down and fetch one URL at a time.
- A fetch tool that passes the page through a model (Claude Code's WebFetch) does not return the original text. When the exact text matters, as it does for a summary, extract it yourself: `curl -sL <url> | uvx trafilatura --markdown`.
- If every route fails, say so. Report the post as unread, with the routes you tried, and let the user open it. Never write a summary or tags from the title alone.
- When a site blocks a route that used to work, or you find a new route, update `docs/sources.md` in the same commit.

## Code

Match the surrounding code in naming, idiom and comment density. Comments are one line, never more.

## Git

Never use a git worktree to edit this repo. Always edit on the `main` branch and commit directly. A commit message is one imperative line that says what changed, such as "Add GitHub's bridge to agent-scale Git infrastructure post". Write it for someone who never saw your session.

## Boundaries

Ask first before you add a dependency, delete entries, or change a domain in `src/shared/tags.ts`. Never edit a generated file by hand, and never run a destructive git command (`reset --hard`, `push --force`, `clean`) unless the user asked for it.
