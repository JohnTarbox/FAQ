import { ref } from 'vue';
import { useApi } from './useApi';

export interface ImageItem {
  key: string;
  size: number;
  uploaded: string;
  contentType?: string;
}

export function useImages() {
  const api = useApi();
  const images = ref<ImageItem[]>([]);
  const nextCursor = ref<string | undefined>();
  const uploading = ref(false);

  async function load(folder = 'images/') {
    const params = new URLSearchParams({ folder });
    const data = await api.call(() =>
      api.get<{ items: ImageItem[]; cursor?: string }>(`/images?${params.toString()}`)
    );
    if (data) {
      images.value = data.items;
      nextCursor.value = data.cursor;
    }
  }

  async function loadMore(folder = 'images/') {
    if (!nextCursor.value) return;
    const params = new URLSearchParams({ folder, cursor: nextCursor.value });
    const data = await api.call(() =>
      api.get<{ items: ImageItem[]; cursor?: string }>(`/images?${params.toString()}`)
    );
    if (data) {
      images.value = [...images.value, ...data.items];
      nextCursor.value = data.cursor;
    }
  }

  async function upload(file: File, folder = 'faq'): Promise<string | null> {
    uploading.value = true;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    const data = await api.call(() =>
      api.post<{ url: string; path: string }>('/images/upload', formData)
    );
    uploading.value = false;
    if (data) {
      // Reload list to include new image
      await load();
      return data.url;
    }
    return null;
  }

  async function remove(key: string) {
    await api.call(() => api.del(`/images/${key}`));
    images.value = images.value.filter(img => img.key !== key);
  }

  return { images, nextCursor, uploading, load, loadMore, upload, remove };
}
