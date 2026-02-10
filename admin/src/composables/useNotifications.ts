import { ref } from 'vue';
import { useApi } from './useApi';

export function useNotifications() {
  const api = useApi();
  const notifications = ref<any[]>([]);
  const unreadCount = ref(0);

  async function load(unreadOnly = false) {
    const params = unreadOnly ? '?unreadOnly=true' : '';
    // Notifications endpoint would be /api/admin/notifications
    // For now, this is a placeholder
    notifications.value = [];
  }

  async function markAsRead(id: number) {
    await api.call(() => api.post(`/notifications/${id}/read`));
    unreadCount.value = Math.max(0, unreadCount.value - 1);
  }

  async function markAllAsRead() {
    await api.call(() => api.post('/notifications/read-all'));
    unreadCount.value = 0;
  }

  return { notifications, unreadCount, load, markAsRead, markAllAsRead };
}
