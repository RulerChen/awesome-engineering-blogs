import { createApp, createSSRApp } from "vue";
import App from "./App.vue";
import { currentPage, pagePath, topicInUrl } from "./app/pages.js";
import { warmTooltips } from "./app/tooltips.js";
import { useArticles } from "./blog/data.js";
import { queryToState, stateToQuery } from "./blog/urlState.js";
import { useRoadmap, useRoadmapIds } from "./roadmap/data.js";
import "./styles/base.css";
import "./styles/header.css";
import "./styles/blog.css";
import "./styles/tooltip.css";
import "./styles/palette.css";
import "./styles/roadmap.css";

const root = document.getElementById("app")!;
const topic = topicInUrl();
// The same files the head's preload links asked for, so hydration starts from the data the prerender drew.
await Promise.all(
  currentPage.value === "blog"
    ? [useArticles().ready]
    : [useRoadmapIds().ready, ...(topic ? [useRoadmap(topic).ready] : [])],
);

// A filtered list, or the host's fallback file for a stale path, differs from what was drawn, so it is drawn afresh.
const filtered =
  currentPage.value === "blog" && stateToQuery(queryToState(window.location.search)) !== "";
const prerendered = root.dataset.path === pagePath() && !filtered;
(prerendered ? createSSRApp(App) : createApp(App)).mount(root);
warmTooltips();
