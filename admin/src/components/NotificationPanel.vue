<script setup lang="ts">
import { onMounted } from 'vue';
import { useNotifications } from '../composables/useNotifications';
import { useRouter } from 'vue-router';

const { notifications, load, markAsRead, markAllAsRead } = useNotifications();
const router = useRouter();

onMounted(() => load());

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

async function handleClick(notif: { id: number; isRead: boolean; linkUrl: string | null }) {
  if (!notif.isRead) await markAsRead(notif.id);
  if (notif.linkUrl) router.push(notif.linkUrl);
}
</script>

<template>
  <div class="notification-panel">
    <div class="panel-header">
      <span class="panel-title">Notifications</span>
      <button v-if="notifications.length" class="mark-all-btn" @click="markAllAsRead">Mark all read</button>
    </div>
    <div class="panel-body">
      <div
        v-for="notif in notifications"
        :key="notif.id"
        class="notif-item"
        :class="{ unread: !notif.isRead }"
        @click="handleClick(notif)"
      >
        <div class="notif-dot" v-if="!notif.isRead"></div>
        <div class="notif-content">
          <div class="notif-title">{{ notif.title }}</div>
          <div class="notif-body" v-if="notif.body">{{ notif.body }}</div>
          <div class="notif-time">{{ timeAgo(notif.createdAt) }}</div>
        </div>
      </div>
      <div v-if="!notifications.length" class="notif-empty">No notifications</div>
    </div>
  </div>
</template>

<style scoped>
.notification-panel {
  position: absolute;
  bottom: 60px;
  left: 12px;
  width: 320px;
  background: var(--color-warm-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
  z-index: 100;
  overflow: hidden;
}
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  background: #fff;
}
.panel-title { font-weight: 600; font-size: 14px; color: var(--color-ink); }
.mark-all-btn {
  background: none;
  border: none;
  color: var(--color-rust);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}
.mark-all-btn:hover { text-decoration: underline; }
.panel-body {
  max-height: 400px;
  overflow-y: auto;
}
.notif-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  transition: background 0.15s;
}
.notif-item:last-child { border-bottom: none; }
.notif-item:hover { background: rgba(0,0,0,0.02); }
.notif-item.unread { background: var(--color-gold-pale, #fdf6e3); }
.notif-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-rust);
  margin-top: 5px;
  flex-shrink: 0;
}
.notif-content { flex: 1; min-width: 0; }
.notif-title { font-size: 13px; font-weight: 500; color: var(--color-ink); }
.notif-body { font-size: 12px; color: var(--color-ink-muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.notif-time { font-size: 11px; color: var(--color-ink-muted); margin-top: 4px; }
.notif-empty { padding: 32px 16px; text-align: center; color: var(--color-ink-muted); font-size: 13px; }
</style>
