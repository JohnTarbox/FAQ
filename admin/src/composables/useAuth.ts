import { ref, computed } from 'vue';

interface User {
  email: string;
  role: string;
}

const user = ref<User | null>(null);
const loading = ref(false);
let checked = false;

export function useAuth() {
  const isAuthenticated = computed(() => !!user.value);

  async function checkAuth(): Promise<boolean> {
    if (checked) return !!user.value;
    loading.value = true;
    try {
      const res = await fetch('/auth/me', { credentials: 'same-origin' });
      if (res.ok) {
        user.value = await res.json();
        checked = true;
        return true;
      }
      user.value = null;
      checked = true;
      return false;
    } catch {
      user.value = null;
      checked = true;
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function logout() {
    // POST to server to destroy session, then follow redirect
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/auth/logout';
    document.body.appendChild(form);
    form.submit();
  }

  function reset() {
    user.value = null;
    checked = false;
  }

  return { user, loading, isAuthenticated, checkAuth, logout, reset };
}
