import { ref } from 'vue';
import { useApi } from './useApi';

export function useGlossary() {
  const api = useApi();
  const terms = ref<any[]>([]);
  const currentTerm = ref<any>(null);

  async function loadList(opts: { status?: string; categoryId?: number; search?: string; page?: number } = {}) {
    const params = new URLSearchParams();
    if (opts.status) params.set('status', opts.status);
    if (opts.categoryId) params.set('categoryId', String(opts.categoryId));
    if (opts.search) params.set('search', opts.search);
    if (opts.page) params.set('page', String(opts.page));

    const result = await api.call(() => api.get<any>(`/glossary?${params}`));
    if (result) terms.value = result.items;
    return result;
  }

  async function loadById(id: number) {
    const result = await api.call(() => api.get<any>(`/glossary/${id}`));
    if (result) currentTerm.value = result;
    return result;
  }

  async function create(data: any) {
    return api.call(() => api.post<any>('/glossary', data));
  }

  async function update(id: number, data: any) {
    return api.call(() => api.put<any>(`/glossary/${id}`, data));
  }

  async function deleteTerm(id: number) {
    return api.call(() => api.del<any>(`/glossary/${id}`));
  }

  return { terms, currentTerm, loading: api.loading, error: api.error, loadList, loadById, create, update, deleteTerm };
}
