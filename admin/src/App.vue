<script setup lang="ts">
import SidebarNav from './components/SidebarNav.vue';
</script>

<template>
  <header class="site-header">
    <nav class="site-nav">
      <a href="/" class="site-nav-brand">APRS Foundation</a>
      <div class="site-nav-links">
        <a href="/">Home</a>
        <a href="/faq">FAQ</a>
        <a href="/glossary">Glossary</a>
        <a href="/admin/" class="active">Admin</a>
      </div>
    </nav>
  </header>
  <div class="admin-layout">
    <SidebarNav />
    <main class="admin-main">
      <router-view />
      <footer class="site-footer">APRS is a registered trademark of TAPR.</footer>
    </main>
  </div>
</template>

<style scoped>
.site-header {
  background: var(--color-ink);
  position: sticky;
  top: 0;
  z-index: 1000;
}
.site-nav {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
}
.site-nav-brand {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 600;
  color: #fff;
}
.site-nav-brand:hover { color: var(--color-rust-light); }
.site-nav-links {
  display: flex;
  gap: 2px;
}
.site-nav-links a {
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 500;
  color: rgba(255,255,255,0.55);
  padding: 6px 14px;
  border-radius: var(--radius-sm);
  transition: background 0.15s, color 0.15s;
}
.site-nav-links a:hover { color: #fff; background: rgba(255,255,255,0.08); }
.site-nav-links a.active { color: #fff; background: var(--color-rust); }
.admin-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: calc(100vh - 48px);
}
.admin-main {
  background: var(--color-cream);
  padding: 28px 32px;
  min-height: calc(100vh - 48px);
}
.site-footer {
  text-align: center;
  padding: 32px 0;
  font-size: 11px;
  color: var(--color-ink-muted);
}
@media (max-width: 768px) {
  .admin-layout { grid-template-columns: 1fr; }
}
</style>
