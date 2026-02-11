<script setup lang="ts">
import { computed } from 'vue';
import { useAuth } from '../composables/useAuth';

const { user, logout } = useAuth();

const initials = computed(() => {
  if (!user.value?.email) return '??';
  const local = user.value.email.split('@')[0];
  const parts = local.split(/[._-]/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
});

const navItems = [
  { name: 'Dashboard', route: '/', icon: '▦' },
  { name: 'FAQs', route: '/faq', icon: '?' },
  { name: 'Glossary', route: '/glossary', icon: '📖' },
  { name: 'Categories', route: '/categories', icon: '◈' },
  { name: 'Tags', route: '/tags', icon: '⚑' },
];
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-logo">APRS Admin</div>
    <nav>
      <router-link
        v-for="item in navItems"
        :key="item.route"
        :to="item.route"
        class="nav-item"
        active-class="active"
      >
        <span class="nav-icon">{{ item.icon }}</span>
        {{ item.name }}
      </router-link>
    </nav>
    <div class="sidebar-user">
      <div class="avatar">{{ initials }}</div>
      <div class="user-info">
        <div class="user-name">{{ user?.email || 'Unknown' }}</div>
        <div class="signout" @click="logout">Sign out</div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  background: var(--color-ink);
  color: #fff;
  padding: 24px 0;
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
}
.sidebar-logo {
  padding: 0 20px 24px;
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 700;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  margin-bottom: 12px;
}
nav { flex: 1; }
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 20px;
  color: rgba(255,255,255,0.55);
  font-size: 14px;
  font-weight: 500;
  transition: all 0.15s;
  text-decoration: none;
}
.nav-item:hover { color: #fff; background: rgba(255,255,255,0.05); }
.nav-item.active { color: #fff; background: rgba(255,255,255,0.08); border-right: 3px solid var(--color-rust); }
.nav-icon { font-size: 16px; width: 20px; text-align: center; }
.sidebar-user {
  padding: 16px 20px;
  border-top: 1px solid rgba(255,255,255,0.08);
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}
.avatar {
  width: 32px; height: 32px;
  border-radius: 50%;
  background: var(--color-rust);
  display: flex; align-items: center; justify-content: center;
  font-weight: 600; font-size: 13px; color: #fff;
}
.user-info { flex: 1; }
.user-name { color: #fff; font-weight: 500; }
.signout { color: rgba(255,255,255,0.4); font-size: 12px; cursor: pointer; }
.signout:hover { color: rgba(255,255,255,0.7); }
</style>
