import { ref } from 'vue';
import { useApi } from './useApi';

export interface Notification {
  id: number;
  recipientEmail: string;
  type: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

export function useNotifications() {
  const api = useApi();
  const notifications = ref<Notification[]>([]);
  const unreadCount = ref(0);

  async function load(unreadOnly = false) {
    const params = unreadOnly ? '?unreadOnly=true' : '';
    const data = await api.call(() => api.get<{ items: Notification[] }>(`/notifications${params}`));
    if (data) {
      notifications.value = data.items;
    }
  }

  async function loadUnreadCount() {
    const data = await api.call(() => api.get<{ count: number }>('/notifications/unread-count'));
    if (data) {
      unreadCount.value = data.count;
    }
  }

  async function markAsRead(id: number) {
    await api.call(() => api.post(`/notifications/${id}/read`));
    const notif = notifications.value.find(n => n.id === id);
    if (notif && !notif.isRead) {
      notif.isRead = true;
      unreadCount.value = Math.max(0, unreadCount.value - 1);
    }
  }

  async function markAllAsRead() {
    await api.call(() => api.post('/notifications/read-all'));
    notifications.value.forEach(n => { n.isRead = true; });
    unreadCount.value = 0;
  }

  return { notifications, unreadCount, load, loadUnreadCount, markAsRead, markAllAsRead };
}
