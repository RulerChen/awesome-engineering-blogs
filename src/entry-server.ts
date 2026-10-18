import { createSSRApp } from "vue";
import { renderToString } from "vue/server-renderer";
import App from "./App.vue";
import { seedJson } from "./app/fetchJson.js";
import { renderAt } from "./app/pages.js";

/** The app's HTML for one page under the site base, drawn from the files the site would fetch. */
export async function render(path: string, files: Map<string, unknown>): Promise<string> {
  for (const [file, value] of files) seedJson(file, value);
  renderAt(path);
  return renderToString(createSSRApp(App));
}
