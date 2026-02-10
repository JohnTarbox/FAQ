<script setup lang="ts">
import SidebarNav from './components/SidebarNav.vue';
</script>

<template>
  <div class="admin-layout">
    <SidebarNav />
    <main class="admin-main">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.admin-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: 100vh;
}
.admin-main {
  background: var(--color-cream);
  padding: 28px 32px;
  min-height: 100vh;
}
@media (max-width: 768px) {
  .admin-layout { grid-template-columns: 1fr; }
}
</style>
