import { ref } from 'vue';
import { useApi } from './useApi';

export function useFaq() {
  const api = useApi();
  const faqs = ref<any[]>([]);
  const currentFaq = ref<any>(null);

  async function loadList(opts: { status?: string; categoryId?: number; search?: string; page?: number } = {}) {
    const params = new URLSearchParams();
    if (opts.status) params.set('status', opts.status);
    if (opts.categoryId) params.set('categoryId', String(opts.categoryId));
    if (opts.search) params.set('search', opts.search);
    if (opts.page) params.set('page', String(opts.page));

    const result = await api.call(() => api.get<any>(`/faq?${params}`));
    if (result) faqs.value = result.items;
    return result;
  }

  async function loadById(id: number) {
    const result = await api.call(() => api.get<any>(`/faq/${id}`));
    if (result) currentFaq.value = result;
    return result;
  }

  async function create(data: any) {
    return api.call(() => api.post<any>('/faq', data));
  }

  async function update(id: number, data: any) {
    return api.call(() => api.put<any>(`/faq/${id}`, data));
  }

  async function createVersion(id: number, data: any) {
    return api.call(() => api.post<any>(`/faq/${id}/version`, data));
  }

  async function submitForReview(versionId: number) {
    return api.call(() => api.post<any>(`/faq/version/${versionId}/submit`));
  }

  async function approve(versionId: number) {
    return api.call(() => api.post<any>(`/faq/version/${versionId}/approve`));
  }

  async function reject(versionId: number, note: string) {
    return api.call(() => api.post<any>(`/faq/version/${versionId}/reject`, { note }));
  }

  async function deleteFaq(id: number) {
    return api.call(() => api.del<any>(`/faq/${id}`));
  }

  return { faqs, currentFaq, loading: api.loading, error: api.error, loadList, loadById, create, update, createVersion, submitForReview, approve, reject, deleteFaq };
}
