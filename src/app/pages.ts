import { ref } from "vue";
import { PAGE_TITLES, ROADMAP_PATH, topicPath } from "../shared/site.js";

export type Page = "blog" | "roadmap";

const BASE = import.meta.env.BASE_URL;

export const PAGES: Record<Page, { path: string; title: string }> = {
  blog: { path: BASE, title: PAGE_TITLES.blog },
  roadmap: { path: `${BASE}${ROADMAP_PATH}`, title: PAGE_TITLES.roadmap },
};

export function topicUrl(id: string): string {
  return `${BASE}${topicPath(id)}`;
}

/** The page the server is drawing, under the site base; the server has no window to read it from. */
let serverPath = "";

const urlPath = (): string => (import.meta.env.SSR ? BASE + serverPath : window.location.pathname);

/** Trailing slash optional, because a typed URL usually lacks it. */
function pageAt(pathname: string): Page {
  const roadmap = PAGES.roadmap.path;
  return pathname.startsWith(roadmap) || pathname === roadmap.slice(0, -1) ? "roadmap" : "blog";
}

/** The topic in /roadmap/<id>/, or null on the topic map. */
export function topicInUrl(): string | null {
  const roadmap = PAGES.roadmap.path;
  const path = urlPath();
  return path.startsWith(roadmap) ? path.slice(roadmap.length).split("/")[0] || null : null;
}

// Topics used to be a ?topic= query; links from then still open the topic.
if (!import.meta.env.SSR) {
  const legacyTopic = new URLSearchParams(window.location.search).get("topic");
  if (legacyTopic && pageAt(window.location.pathname) === "roadmap")
    history.replaceState(null, "", topicUrl(legacyTopic));
}

export const currentPage = ref<Page>(pageAt(urlPath()));

/** The url's page under the site base, named as the build names the HTML file it prerenders for it. */
export function pagePath(): string {
  if (currentPage.value === "blog") return "";
  const topic = topicInUrl();
  return topic ? topicPath(topic) : ROADMAP_PATH;
}

/** Server only: points the app at one page, under the site base, before it is drawn. */
export function renderAt(path: string): void {
  serverPath = path;
  currentPage.value = pageAt(urlPath());
}

const here = (): string => window.location.pathname + window.location.search;

/** Each url's scroll as last seen, so coming back to it through a tab or Back lands on the same spot. */
const scrollAt = new Map<string, number>();
/** From the start of a switch until the new view lands, while the browser may scroll the outgoing view for the incoming url. */
let switching = false;
/** Set while navigate switches, since its target is new content that opens at the top. */
let fresh = false;
/** Where the incoming view opens, worked out when the switch starts. */
let landing = 0;

function remember(): void {
  scrollAt.set(here(), window.scrollY);
}

if (!import.meta.env.SSR)
  window.addEventListener(
    "scroll",
    () => {
      if (!switching) remember();
    },
    { passive: true },
  );

/** Starts swapping the view for the url now in the address bar: new content opens at the top, a revisited url where it was left. */
export function beginSwitch(isFresh = fresh): void {
  switching = true;
  landing = isFresh ? 0 : (scrollAt.get(here()) ?? 0);
  // Back and Forward have the browser scroll the outgoing view, still on screen, for the incoming url; put back before the next paint.
  const y = window.scrollY;
  requestAnimationFrame(() => window.scrollTo({ top: y }));
}

/** Called once the outgoing view has faded, so it never jumps while still on screen. */
export function land(): void {
  switching = false;
  window.scrollTo({ top: landing });
}

function show(page: Page): void {
  if (page !== currentPage.value) beginSwitch();
  currentPage.value = page;
  document.title = PAGES[page].title;
}

/** Each page's url as it was left, so coming back through the tabs finds the same filters or topic. */
const leftUrl: Record<Page, string> = { blog: PAGES.blog.path, roadmap: PAGES.roadmap.path };

/** Switches in place rather than loading the other file; the url belongs to the page that set it, so it waits for that page. */
export function openPage(page: Page): void {
  if (page === currentPage.value) return;
  leftUrl[currentPage.value] = here();
  remember();
  history.pushState(null, "", leftUrl[page]);
  show(page);
}

/** Pushed, then announced as a popstate, which both pages already answer by re-reading the url. */
function navigate(page: Page, url: string): void {
  if (page !== currentPage.value) leftUrl[currentPage.value] = here();
  remember();
  history.pushState(null, "", url);
  fresh = true;
  window.dispatchEvent(new PopStateEvent("popstate"));
  fresh = false;
}

/** Straight to one roadmap topic from either page. */
export function openTopic(id: string): void {
  navigate("roadmap", topicUrl(id));
}

/** The blog list narrowed to a text search, keeping whatever other filters it had. */
export function searchList(text: string): void {
  const query = new URLSearchParams(
    currentPage.value === "blog"
      ? window.location.search
      : new URL(leftUrl.blog, window.location.origin).search,
  );
  query.set("q", text);
  navigate("blog", `${PAGES.blog.path}?${query}`);
}

if (!import.meta.env.SSR) {
  // The dev server answers every path with index.html, whose title is the blog's.
  document.title = PAGES[currentPage.value].title;
  window.addEventListener("popstate", () => show(pageAt(window.location.pathname)));
}
