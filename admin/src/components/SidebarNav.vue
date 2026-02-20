<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useAuth } from '../composables/useAuth';
import { useNotifications } from '../composables/useNotifications';
import NotificationPanel from './NotificationPanel.vue';

const { user, logout } = useAuth();
const { unreadCount, loadUnreadCount } = useNotifications();

const showNotifications = ref(false);
let pollInterval: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  loadUnreadCount();
  pollInterval = setInterval(loadUnreadCount, 60000);
});

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval);
});

const initials = computed(() => {
  if (!user.value?.email) return '??';
  const local = user.value.email.split('@')[0];
  const parts = local.split(/[._-]/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
});

interface NavItem {
  name: string;
  route: string;
  icon: string;
  adminOnly?: boolean;
}

const allNavItems: NavItem[] = [
  { name: 'Dashboard', route: '/', icon: '▦' },
  { name: 'FAQs', route: '/faq', icon: '?' },
  { name: 'Glossary', route: '/glossary', icon: '📖' },
  { name: 'Categories', route: '/categories', icon: '◈' },
  { name: 'Tags', route: '/tags', icon: '⚑' },
  { name: 'Images', route: '/images', icon: '▣' },
  { name: 'Import', route: '/import', icon: '⇧', adminOnly: true },
  { name: 'AI Suggestions', route: '/suggestions', icon: '✦', adminOnly: true },
  { name: 'Audit Log', route: '/audit', icon: '☰' },
];

const visibleNavItems = computed(() =>
  allNavItems.filter(item => !item.adminOnly || user.value?.role === 'admin')
);
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-logo">APRS Admin</div>
    <nav>
      <router-link
        v-for="item in visibleNavItems"
        :key="item.route"
        :to="item.route"
        class="nav-item"
        active-class="active"
      >
        <span class="nav-icon">{{ item.icon }}</span>
        {{ item.name }}
      </router-link>
    </nav>
    <div class="notification-area">
      <button class="bell-btn" @click="showNotifications = !showNotifications" title="Notifications">
        <span class="bell-icon">&#x1F514;</span>
        <span v-if="unreadCount > 0" class="badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
      </button>
      <NotificationPanel v-if="showNotifications" />
    </div>
    <div class="sidebar-user">
      <div class="avatar">{{ initials }}</div>
      <div class="user-info">
        <div class="user-name">{{ user?.email || 'Unknown' }}</div>
        <div class="user-groups" v-if="user?.groups?.length">{{ user.groups.join(', ') }}</div>
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
.notification-area {
  position: relative;
  padding: 8px 20px;
  border-top: 1px solid rgba(255,255,255,0.08);
}
.bell-btn {
  position: relative;
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  transition: background 0.15s;
}
.bell-btn:hover { background: rgba(255,255,255,0.08); }
.bell-icon { font-size: 18px; filter: grayscale(1) brightness(2); }
.badge {
  position: absolute;
  top: 2px;
  right: 4px;
  background: var(--color-rust);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}
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
.user-groups { color: rgba(255,255,255,0.4); font-size: 11px; margin-top: 2px; }
.signout { color: rgba(255,255,255,0.4); font-size: 12px; cursor: pointer; }
.signout:hover { color: rgba(255,255,255,0.7); }
</style>
