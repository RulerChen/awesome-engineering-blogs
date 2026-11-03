# Reaching sources

How to find new posts on each source and get their full text. `AGENTS.md` gives the order of fallbacks when a site blocks you. This file records what worked where. When a route stops working or a new one works, fix the row and note the date you saw it.

## Finding new posts

These feeds returned 200 on 2026-11-03.

| Source         | Feed                                                                                                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Airbnb         | `https://medium.com/feed/airbnb-engineering`                                                                                                                                |
| Amazon Science | `https://www.amazon.science/index.rss`                                                                                                                                      |
| AWS            | `https://aws.amazon.com/blogs/<blog>/feed/`, one per blog: architecture, database, containers, big-data, compute, storage, networking-and-content-delivery, opensource, aws |
| Booking        | `https://medium.com/feed/booking-com-development`                                                                                                                           |
| Canva          | `https://www.canva.dev/blog/engineering/feed`                                                                                                                               |
| Cloudflare     | `https://blog.cloudflare.com/rss/`                                                                                                                                          |
| Discord        | `https://discord.com/blog/rss.xml`                                                                                                                                          |
| Dropbox        | `https://dropbox.tech/feed`                                                                                                                                                 |
| Figma          | `https://www.figma.com/blog/feed/atom.xml`                                                                                                                                  |
| GitHub         | `https://github.blog/engineering/feed/`                                                                                                                                     |
| Google         | `https://research.google/blog/rss/` and `https://cloudblog.withgoogle.com/rss/`                                                                                             |
| Meta           | `https://engineering.fb.com/feed/`                                                                                                                                          |
| Netflix        | `https://netflixtechblog.com/feed`                                                                                                                                          |
| OpenAI         | `https://openai.com/news/rss.xml`                                                                                                                                           |
| Pinterest      | `https://medium.com/feed/pinterest-engineering`                                                                                                                             |
| PlanetScale    | `https://planetscale.com/blog/feed.atom`                                                                                                                                    |
| Salesforce     | `https://engineering.salesforce.com/feed/`                                                                                                                                  |
| Shopify        | `https://shopify.engineering/blog.atom`                                                                                                                                     |
| Slack          | `https://slack.engineering/feed/`                                                                                                                                           |
| Spotify        | `https://engineering.atspotify.com/feed/`                                                                                                                                   |
| Stripe         | `https://stripe.dev/blog/feed`                                                                                                                                              |

Match Medium feed entries on the URL without its `?source=` query, or every post matches the same entry.

Atlassian, Cursor, Notion, LinkedIn, Uber and Anthropic have no usable feed. Their listing pages fetch with plain curl (2026-10-26). Take the post links from the listing, then read each post's date from `article:published_time`, `datePublished`, `publishedAt`, a `<time datetime>` attribute, or a "Month D, YYYY" string.

- Uber's listing moved to `https://www.uber.com/us/en/blog/engineering/` (2026-10-26). Post links are `/us/en/blog/<slug>/`, mixed with category links such as `/blog/eat/` and `/blog/ride/` to skip.
- Anthropic's `/engineering` page does not use plain hrefs for post links, and it embeds featured cards from `/research` and `/news` with recent dates. Those cards are not engineering posts.
- DoorDash blocks its site, its feed and wp-json. Google News RSS gives recent titles, though it can lag: `https://news.google.com/rss/search?q=site:careersatdoordash.com/blog+when:30d`. Its links are JavaScript redirects, so open one in Playwright and read the final URL. Posts from the last month had no Wayback snapshot, and archive.ph timed out (2026-11-03).
- blog.x.com/engineering has not posted since 2023. Skip it.

## Getting the full text

`curl -sL <url> | uvx trafilatura --markdown` gives clean text for most sites. The rows below are the exceptions.

| Site                                                  | What goes wrong                                                                                                           | What works                                                                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| medium.com, netflixtechblog.com                       | 403 to curl and fetch tools, browser headers included (2026-10-26)                                                        | The feed for the latest ten posts; a dated Wayback snapshot for older ones                                                         |
| openai.com                                            | 403; headless Playwright gets a Cloudflare challenge                                                                      | `archive.ph/newest/<url>` had the posts (2026-10-26); on 2026-11-03 it timed out once, and `web.archive.org/web/2026/<url>` worked |
| careersatdoordash.com                                 | 403; headless Playwright gets a Cloudflare challenge                                                                      | No route gave the text on 2026-10-26 or 2026-11-03; report them as unread                                                          |
| queue.acm.org                                         | Cloudflare block page                                                                                                     | A dated Wayback snapshot of the `http://` URL                                                                                      |
| www.uber.com                                          | Posts returned 403 to bare curl (2026-10-03)                                                                              | curl with `Accept` and `Accept-Language` headers                                                                                   |
| stripe.dev                                            | Rendered client side                                                                                                      | `props.pageProps.postData.content` in the `__NEXT_DATA__` script tag                                                               |
| discord.com                                           | The post is split across several `<article class="... w-richtext">` blocks, and trafilatura keeps only the first          | Join all the blocks, then extract                                                                                                  |
| aws.amazon.com/blogs                                  | trafilatura returns almost nothing                                                                                        | Extract `<section class="blog-post-content">` directly                                                                             |
| web.archive.org                                       | 503 and 403 on 2026-10-26; 429 under parallel fetching; the `archive.org/wayback/available` API returned 429 (2026-11-03) | Request the snapshot URL directly, one at a time, with a browser `User-Agent`; then archive.ph                                     |
| rachelbythebay.com, 1024cores.net, saaramar.github.io | Timed out, domain lapsed, 404 (2026-10-10)                                                                                | Wayback only                                                                                                                       |
