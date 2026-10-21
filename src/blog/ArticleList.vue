<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import { currentPage } from "../app/pages.js";
import type { Article } from "../shared/entry.js";
import ArticleCard from "./ArticleCard.vue";
import type { Series } from "./series.js";
import type { EntryState } from "./useEntryState.js";

const props = defineProps<{
  articles: Article[];
  /** Changes with the filters and the tab, but not when a card is saved or ignored. */
  resetKey: string;
  seriesIndex: Map<string, Series>;
  states: Readonly<Record<string, EntryState>>;
  activeTags: string[];
  /** The marks whose toggle takes a card out of this list. */
  removes: EntryState[];
  /** The entry an undo just brought back, which unfolds into place. */
  arriving: string | null;
}>();

const emit = defineEmits<{
  toggleSaved: [id: string];
  toggleHidden: [id: string];
  selectSeries: [id: string];
  selectTag: [tag: string];
}>();

const INITIAL_VISIBLE = 20;
const LOAD_INCREMENT = 40;
/** Start loading this far before the sentinel reaches the viewport. */
const PRELOAD_MARGIN = 600;

const visibleCount = ref(INITIAL_VISIBLE);
watch(
  () => props.resetKey,
  () => {
    visibleCount.value = INITIAL_VISIBLE;
  },
);

const list = ref<HTMLElement | null>(null);
// A detached card forgets its measured height and comes back at the 180px guess, so each one is pinned first and the restored scroll lands where it was.
watch(
  currentPage,
  (page) => {
    const cards = list.value?.children as HTMLCollectionOf<HTMLElement> | undefined;
    if (page === "blog" || !cards?.length) return;
    const style = getComputedStyle(cards[0]);
    const frame = ["paddingTop", "paddingBottom", "borderTopWidth", "borderBottomWidth"] as const;
    const edges = frame.reduce((sum, side) => sum + parseFloat(style[side]), 0);
    // The rect's fractional height, since rounding each card would add up to a few pixels over a long list.
    for (const card of cards)
      card.style.containIntrinsicHeight = `auto ${card.getBoundingClientRect().height - edges}px`;
  },
  { flush: "sync" },
);

const sentinel = ref<HTMLElement | null>(null);
// The server has no IntersectionObserver, but draws what the browsers this bundle runs in will.
const autoLoad = import.meta.env.SSR || typeof IntersectionObserver !== "undefined";
let observer: IntersectionObserver | null = null;
let filling = false;

/** Keeps loading while the sentinel stays in range, since one batch may not fill a tall viewport. */
async function fillViewport(): Promise<void> {
  if (filling) return;
  filling = true;
  try {
    while (visibleCount.value < props.articles.length) {
      await nextTick();
      const el = sentinel.value;
      if (!el || el.getBoundingClientRect().top > window.innerHeight + PRELOAD_MARGIN) return;
      visibleCount.value += LOAD_INCREMENT;
    }
  } finally {
    filling = false;
  }
}

watch(sentinel, (el) => {
  observer?.disconnect();
  observer = null;
  if (!el || !autoLoad) return;
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void fillViewport();
    },
    { rootMargin: `0px 0px ${PRELOAD_MARGIN}px 0px` },
  );
  observer.observe(el);
});

onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <div>
    <div ref="list" class="article-list">
      <ArticleCard
        v-for="article in articles.slice(0, visibleCount)"
        :key="article.id"
        :article="article"
        :saved="states[article.id] === 'saved'"
        :hidden="states[article.id] === 'hidden'"
        :series="article.series ? seriesIndex.get(article.series) : undefined"
        :active-tags="activeTags"
        :removes="removes"
        :arriving="article.id === arriving"
        @toggle-saved="emit('toggleSaved', $event)"
        @toggle-hidden="emit('toggleHidden', $event)"
        @select-series="emit('selectSeries', $event)"
        @select-tag="emit('selectTag', $event)"
      />
    </div>
    <div v-if="visibleCount < articles.length" ref="sentinel" class="load-more-wrap">
      <button v-if="!autoLoad" class="load-more" @click="visibleCount += LOAD_INCREMENT">
        Load {{ LOAD_INCREMENT }} more
      </button>
      <span v-else class="loading-dots" aria-hidden="true"><i /><i /><i /></span>
      <span class="showing-label" aria-live="polite">
        Showing {{ Math.min(visibleCount, articles.length).toLocaleString("en-US") }} of
        {{ articles.length.toLocaleString("en-US") }}
      </span>
    </div>
  </div>
</template>
