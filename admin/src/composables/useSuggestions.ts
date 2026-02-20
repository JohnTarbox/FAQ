import { ref } from 'vue';
import { useApi } from './useApi';

export function useSuggestions() {
  const api = useApi();
  const suggestions = ref<any[]>([]);
  const stats = ref<Record<string, number>>({ new: 0, accepted: 0, dismissed: 0 });
  const runs = ref<any[]>([]);
  const searchTerms = ref<any[]>([]);
  const totalPages = ref(1);

  async function loadList(opts: { status?: string; sourceType?: string; page?: number } = {}) {
    const params = new URLSearchParams();
    if (opts.status) params.set('status', opts.status);
    if (opts.sourceType) params.set('source_type', opts.sourceType);
    if (opts.page) params.set('page', String(opts.page));

    const result = await api.call(() => api.get<any>(`/suggestions?${params}`));
    if (result) {
      suggestions.value = result.items;
      totalPages.value = result.totalPages || 1;
    }
    return result;
  }

  async function loadStats() {
    const result = await api.call(() => api.get<Record<string, number>>('/suggestions/stats'));
    if (result) stats.value = result;
    return result;
  }

  async function accept(id: number, overrides?: { question?: string; answer?: string }) {
    return api.call(() => api.post<any>(`/suggestions/${id}/accept`, overrides || {}));
  }

  async function dismiss(id: number, reason?: string) {
    return api.call(() => api.post<any>(`/suggestions/${id}/dismiss`, { reason }));
  }

  async function bulkDismiss(ids: number[], reason?: string) {
    return api.call(() => api.post<any>('/suggestions/bulk-dismiss', { ids, reason }));
  }

  async function triggerDiscovery() {
    return api.call(() => api.post<any>('/suggestions/discover'));
  }

  async function getRun(id: number) {
    return api.call(() => api.get<any>(`/suggestions/runs/${id}`));
  }

  async function loadRuns() {
    const result = await api.call(() => api.get<any[]>('/suggestions/runs'));
    if (result) runs.value = result;
    return result;
  }

  async function loadSearchTerms() {
    const result = await api.call(() => api.get<any[]>('/suggestions/search-terms'));
    if (result) searchTerms.value = result;
    return result;
  }

  async function addSearchTerm(term: string, sourceTypes?: string[]) {
    return api.call(() => api.post<any>('/suggestions/search-terms', { term, sourceTypes }));
  }

  async function updateSearchTerm(id: number, data: { term?: string; isActive?: boolean; sourceTypes?: string[] }) {
    return api.call(() => api.put<any>(`/suggestions/search-terms/${id}`, data));
  }

  async function deleteSearchTerm(id: number) {
    return api.call(() => api.del<any>(`/suggestions/search-terms/${id}`));
  }

  return {
    suggestions,
    stats,
    runs,
    searchTerms,
    totalPages,
    loading: api.loading,
    error: api.error,
    loadList,
    loadStats,
    accept,
    dismiss,
    bulkDismiss,
    triggerDiscovery,
    getRun,
    loadRuns,
    loadSearchTerms,
    addSearchTerm,
    updateSearchTerm,
    deleteSearchTerm,
  };
}
