import { readFile, rm, writeFile } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import vue from "@vitejs/plugin-vue";
import { type HtmlTagDescriptor, type Plugin, defineConfig } from "vite";
import { DATA_DIR } from "./scripts/lib/paths.js";
import { readEntries, readRoadmaps } from "./scripts/lib/read.js";
import { siteFiles } from "./scripts/lib/site.js";
import { entryProblems } from "./scripts/lib/validate.js";
import { STORAGE_KEYS } from "./src/app/storage.js";
import { ROADMAP_INDEX_FILE, type RoadmapInput } from "./src/shared/roadmap.js";
import { PAGE_TITLES, ROADMAP_PATH, topicPath } from "./src/shared/site.js";

/** The production host; sitemap and share-preview URLs must be absolute. */
const SITE_ORIGIN = "https://awesome-engineering-blogs.pages.dev";

/** The latin halves of the two faces in base.css; every page draws text in both. */
const FONTS = ["bricolage-grotesque-latin.woff2", "nunito-sans-latin.woff2"];

/** Runs before first paint, so a dark reader never sees the light page flash; useTheme takes over from here. */
const THEME_SCRIPT = `try {
  let theme = localStorage.getItem(${JSON.stringify(STORAGE_KEYS.theme)});
  if (theme !== "dark" && theme !== "light")
    theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
} catch {}`;

/** Runs before first paint, so the search button draws this platform's shortcut from the start instead of swapping it on hydration. */
const PLATFORM_SCRIPT = `if (/Mac|iPhone|iPad/.test(navigator.userAgent)) document.documentElement.dataset.platform = "mac";`;

/** The page's data, fetched alongside the bundle instead of after it; the paths match topicInUrl and roadmapFile. */
function dataPreloadScript(base: string): string {
  return `{
  const base = ${JSON.stringify(base)};
  const roadmap = ${JSON.stringify(base + ROADMAP_PATH)};
  const onRoadmap = location.pathname.startsWith(roadmap) || location.pathname === roadmap.slice(0, -1);
  const topic = onRoadmap && location.pathname.slice(roadmap.length).split("/")[0];
  const files = !onRoadmap
    ? ["articles.json"]
    : [${JSON.stringify(ROADMAP_INDEX_FILE)}, ...(topic ? [\`roadmaps/\${topic}.json\`] : [])];
  for (const file of files) {
    const link = Object.assign(document.createElement("link"), { rel: "preload", as: "fetch", crossOrigin: "anonymous", href: base + file });
    document.head.append(link);
  }
}`;
}

type PageName = keyof typeof PAGE_TITLES;

/** What a crawler reads off one HTML file, since neither search nor link-preview crawlers can count on the app running. */
interface Head {
  title: string;
  description: string;
  /** Under the site base. */
  path: string;
  /** The preview image is public/og-<image>.png. */
  image: PageName;
}

const PAGE_HEADS: Record<PageName, Head> = {
  blog: {
    title: PAGE_TITLES.blog,
    description:
      "A hand-curated reading list of posts from big tech engineering blogs, each with a one-line summary and tags to filter by.",
    path: "",
    image: "blog",
  },
  roadmap: {
    title: PAGE_TITLES.roadmap,
    description:
      "Self-study roadmaps for computer science subjects, from operating systems to large language models, built from public courses, books and papers.",
    path: ROADMAP_PATH,
    image: "roadmap",
  },
};

/** The same title the app puts in the tab once the topic loads. */
function topicHead(road: RoadmapInput): Head {
  const parts = road.parts.map((part) => part.name).join(", ");
  return {
    title: `${road.title} · ${PAGE_TITLES.roadmap}`,
    description: `${road.title}: a self-study roadmap built from public courses, books and papers. Parts: ${parts}.`,
    path: topicPath(road.id),
    image: "roadmap",
  };
}

const escapeHtml = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");

/** The page's title plus its description and share-preview tags. */
function pageHead(head: Head, base: string): string {
  const root = SITE_ORIGIN + base;
  const title = escapeHtml(head.title);
  const description = escapeHtml(head.description);
  return [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${root}${head.path}" />`,
    `<meta property="og:image" content="${root}og-${head.image}.png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ].join("\n    ");
}

/** The head every page gets, written once here instead of in each HTML file. */
function sharedHead(): Plugin {
  let base = "/";
  return {
    name: "shared-head",
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml(html) {
      const title = `<title>${PAGE_TITLES.blog}</title>`;
      if (!html.includes(title)) throw new Error("shared-head: index.html title not found");
      // Written ahead of the stylesheet Vite injects: an inline script after a loading stylesheet waits for it.
      const scripts = [THEME_SCRIPT, PLATFORM_SCRIPT, dataPreloadScript(base)].map(
        (code) => `\n    <script>${code}</script>`,
      );
      return {
        html: html.replace(title, pageHead(PAGE_HEADS.blog, base) + scripts.join("")),
        tags: FONTS.map(
          (font): HtmlTagDescriptor => ({
            tag: "link",
            attrs: {
              rel: "preload",
              href: `${base}fonts/${font}`,
              as: "font",
              type: "font/woff2",
              crossorigin: true,
            },
            injectTo: "head",
          }),
        ),
      };
    },
  };
}

/** Build only: the roadmap page and each topic are index.html under their own head; in dev, Vite's SPA fallback serves index.html there. */
function roadmapPages(): Plugin {
  let base = "/";
  return {
    name: "roadmap-pages",
    apply: "build",
    applyToEnvironment: (environment) => environment.name === "client",
    configResolved(config) {
      base = config.base;
    },
    generateBundle: {
      // After vite:build-html, which is what puts index.html in the bundle.
      order: "post",
      async handler(_options, bundle) {
        const index = bundle["index.html"];
        if (index?.type !== "asset") throw new Error("roadmap-pages: no index.html in the bundle");
        const source = String(index.source);
        const blogHead = pageHead(PAGE_HEADS.blog, base);
        if (!source.includes(blogHead)) throw new Error("roadmap-pages: index.html head not found");
        const heads = [PAGE_HEADS.roadmap, ...(await readRoadmaps()).map(topicHead)];
        for (const head of heads)
          this.emitFile({
            type: "asset",
            fileName: `${head.path}index.html`,
            source: source.replace(blogHead, pageHead(head, base)),
          });
      },
    },
  };
}

/** Build only: both pages and every roadmap topic; blog filter queries are subsets of one list, so they stay out. */
function sitemap(): Plugin {
  let base = "/";
  return {
    name: "sitemap",
    apply: "build",
    applyToEnvironment: (environment) => environment.name === "client",
    configResolved(config) {
      base = config.base;
    },
    async generateBundle() {
      const root = SITE_ORIGIN + base;
      const roadmap = root + ROADMAP_PATH;
      const topics = (await readRoadmaps()).map((road) => root + topicPath(road.id));
      const source = [
        `<?xml version="1.0" encoding="UTF-8"?>`,
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
        ...[root, roadmap, ...topics].map((url) => `  <url><loc>${url}</loc></url>`),
        `</urlset>`,
        "",
      ].join("\n");
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source });
      // Without it the host's SPA fallback answers /robots.txt with index.html, which crawlers read as garbage.
      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        source: `User-agent: *\nAllow: /\n\nSitemap: ${root}sitemap.xml\n`,
      });
    },
  };
}

/** The server build of the app, which only the prerender reads; removed once it has run. */
const SSR_OUT_DIR = "dist-ssr";

/** The empty root every page's HTML has until the prerender draws the app into it. */
const APP_ROOT = '<div id="app"></div>';

/** Build only: draws the app into every page's HTML, so crawlers that run no script still read it; main.ts hydrates it. */
function prerender(): Plugin {
  return {
    name: "prerender",
    apply: "build",
    config: () => ({
      builder: {},
      environments: {
        ssr: {
          build: {
            outDir: SSR_OUT_DIR,
            copyPublicDir: false,
            rollupOptions: { input: "src/entry-server.ts" },
          },
        },
      },
    }),
    buildApp: {
      // After the config's own buildApp, which builds nothing, and before Vite's fallback of building every environment.
      order: "post",
      async handler(builder) {
        const { client, ssr } = builder.environments;
        await builder.build(client);
        await builder.build(ssr);
        const ssrDir = resolve(ssr.config.root, ssr.config.build.outDir);
        const entry = pathToFileURL(resolve(ssrDir, "entry-server.js")).href;
        const { render } = (await import(entry)) as typeof import("./src/entry-server.js");
        const files = await siteFiles(await readEntries());
        const outDir = resolve(client.config.root, client.config.build.outDir);
        const heads = [
          PAGE_HEADS.blog,
          PAGE_HEADS.roadmap,
          ...(await readRoadmaps()).map(topicHead),
        ];
        for (const { path } of heads) {
          const file = resolve(outDir, path, "index.html");
          const html = await readFile(file, "utf8");
          if (!html.includes(APP_ROOT))
            throw new Error(`prerender: no app root in ${path}index.html`);
          const app = `<div id="app" data-path="${path}">${await render(path, files)}</div>`;
          // A function, so a `$&` in the drawn text is not read as a replacement pattern.
          await writeFile(
            file,
            html.replace(APP_ROOT, () => app),
          );
        }
        await rm(ssrDir, { recursive: true });
      },
    },
  };
}

/** Dev only: builds the data files per request straight from data/, reports entry problems, and reloads on edits. */
function liveData(): Plugin {
  return {
    name: "live-data",
    apply: "serve",
    configureServer(server) {
      // Terminal always; the overlay can miss a page whose socket is still reconnecting.
      const report = (message: string): void => {
        server.config.logger.error(message, { timestamp: true });
        server.hot.send({ type: "error", err: { message, stack: "" } });
      };
      const serve = async (res: ServerResponse, file: string): Promise<void> => {
        const inputs = await readEntries();
        // Served anyway, so one bad tag does not blank the page; the build still refuses it.
        const problems = entryProblems(inputs);
        if (problems.length) report(`${problems.length} entry problems:\n${problems.join("\n")}`);
        const body = (await siteFiles(inputs)).get(file);
        if (body === undefined) {
          res.statusCode = 404;
          res.end();
          return;
        }
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        res.end(JSON.stringify(body));
      };

      server.middlewares.use((req, res, next) => {
        const match = /(?:^|\/)(articles\.json|roadmaps\/[^/?]+\.json)(?:\?|$)/.exec(req.url ?? "");
        if (!match) return next();
        // A half-typed JSON file is the normal case here, not a crash.
        serve(res, match[1]).catch((error: unknown) => {
          res.statusCode = 500;
          res.end(String(error));
          report(String(error));
        });
      });

      const reload = (file: string): void => {
        if (file.startsWith(DATA_DIR) && file.endsWith(".json"))
          server.hot.send({ type: "full-reload" });
      };
      server.watcher.on("change", reload);
      server.watcher.on("add", reload);
      server.watcher.on("unlink", reload);
    },
  };
}

export default defineConfig({
  base: "/",
  plugins: [vue(), sharedHead(), roadmapPages(), sitemap(), prerender(), liveData()],
});
