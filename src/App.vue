<script setup lang="ts">
import SiteHeader from "./app/SiteHeader.vue";
import { currentPage, land } from "./app/pages.js";
import BlogPage from "./blog/BlogPage.vue";
import RoadmapPage from "./roadmap/RoadmapPage.vue";
</script>

<template>
  <div class="container">
    <!-- Outside the transition: the chrome stays put while only the page under it changes. -->
    <SiteHeader />
    <!-- Out then in, so the incoming page is never drawn over the outgoing one. -->
    <Transition name="page" mode="out-in" @after-leave="land">
      <!-- The blog is kept, so coming back finds its tab, loaded entries and scroll as they were. -->
      <KeepAlive include="BlogPage">
        <RoadmapPage v-if="currentPage === 'roadmap'" />
        <BlogPage v-else />
      </KeepAlive>
    </Transition>
  </div>
</template>
