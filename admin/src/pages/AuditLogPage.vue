<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useApi } from '../composables/useApi';

interface AuditEntry {
  id: number;
  entryId: number | null;
  versionId: number | null;
  action: string;
  actorEmail: string;
  details: string | null;
  createdAt: string;
  faqSlug: string | null;
}

const api = useApi();
const entries = ref<AuditEntry[]>([]);
const page = ref(1);
const totalPages = ref(1);

const filterEmail = ref('');
const filterAction = ref('');
const filterStartDate = ref('');
const filterEndDate = ref('');

const actions = ['created', 'updated', 'submitted', 'approved', 'rejected', 'deleted'];

const actionColors: Record<string, string> = {
  created: '#4a9c6d',
  updated: '#3b82c4',
  submitted: '#c9952c',
  approved: '#4a9c6d',
  rejected: '#c04b2e',
  deleted: '#c04b2e',
};

async function loadAudit() {
  const params = new URLSearchParams();
  params.set('page', String(page.value));
  params.set('limit', '50');
  if (filterEmail.value) params.set('actorEmail', filterEmail.value);
  if (filterAction.value) params.set('action', filterAction.value);
  if (filterStartDate.value) params.set('startDate', filterStartDate.value);
  if (filterEndDate.value) params.set('endDate', filterEndDate.value);

  const data = await api.call(() => api.get<{
    items: AuditEntry[];
    page: number;
    totalPages: number;
  }>(`/audit?${params.toString()}`));

  if (data) {
    entries.value = data.items;
    totalPages.value = data.totalPages;
  }
}

function applyFilters() {
  page.value = 1;
  loadAudit();
}

function goPage(p: number) {
  page.value = p;
  loadAudit();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

onMounted(loadAudit);
</script>

<template>
  <div>
    <div class="topbar">
      <h1>Audit Log</h1>
    </div>

    <div class="filters-row">
      <input
        v-model="filterEmail"
        @input="applyFilters"
        type="text"
        class="filter-input"
        placeholder="Filter by email..."
      >
      <select v-model="filterAction" @change="applyFilters" class="filter-select">
        <option value="">All Actions</option>
        <option v-for="a in actions" :key="a" :value="a">{{ a }}</option>
      </select>
      <input v-model="filterStartDate" @change="applyFilters" type="date" class="filter-input filter-date">
      <input v-model="filterEndDate" @change="applyFilters" type="date" class="filter-input filter-date">
    </div>

    <div class="table-section">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Action</th>
            <th>Actor</th>
            <th>FAQ</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in entries" :key="entry.id">
            <td class="ts-cell">{{ formatDate(entry.createdAt) }}</td>
            <td>
              <span
                class="action-badge"
                :style="{ background: actionColors[entry.action] || '#888', color: '#fff' }"
              >{{ entry.action }}</span>
            </td>
            <td>{{ entry.actorEmail }}</td>
            <td>
              <router-link
                v-if="entry.entryId && entry.faqSlug"
                :to="`/faq/${entry.entryId}`"
                class="faq-link"
              >{{ entry.faqSlug }}</router-link>
              <span v-else-if="entry.entryId" class="deleted-label">ID #{{ entry.entryId }}</span>
              <span v-else class="deleted-label">Deleted</span>
            </td>
            <td class="details-cell">{{ entry.details || '—' }}</td>
          </tr>
          <tr v-if="!entries.length">
            <td colspan="5" style="text-align:center; color:var(--color-ink-muted); padding:32px;">No audit entries found.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="pagination" v-if="totalPages > 1">
      <button
        v-for="p in totalPages"
        :key="p"
        class="page-btn"
        :class="{ active: p === page }"
        @click="goPage(p)"
      >{{ p }}</button>
    </div>
  </div>
</template>

<style scoped>
.topbar { margin-bottom: 24px; }
.topbar h1 { font-family: var(--font-display); font-size: 26px; font-weight: 700; }
.filters-row { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
.filter-input { padding: 8px 14px; font-size: 13px; border: 1.5px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-warm-white); font-family: var(--font-ui); flex: 1; min-width: 140px; }
.filter-input:focus { outline: none; border-color: var(--color-rust); }
.filter-date { flex: 0 0 auto; width: 150px; }
.filter-select { padding: 8px 14px; font-size: 13px; border: 1.5px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-warm-white); font-family: var(--font-ui); }
.table-section { background: var(--color-warm-white); border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; }
.admin-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.admin-table th { text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-ink-muted); padding: 10px 12px; border-bottom: 2px solid var(--color-border); }
.admin-table td { padding: 12px; border-bottom: 1px solid var(--color-border); color: var(--color-ink-light); }
.admin-table tr:hover td { background: rgba(250,247,242,0.5); }
.ts-cell { white-space: nowrap; font-size: 13px; }
.action-badge { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }
.faq-link { color: var(--color-rust); text-decoration: none; font-weight: 500; }
.faq-link:hover { text-decoration: underline; }
.deleted-label { color: var(--color-ink-muted); font-style: italic; font-size: 13px; }
.details-cell { max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 13px; color: var(--color-ink-muted); }
.pagination { display: flex; gap: 6px; margin-top: 20px; justify-content: center; }
.page-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-warm-white); cursor: pointer; font-size: 13px; font-weight: 500; }
.page-btn.active { background: var(--color-rust); color: #fff; border-color: var(--color-rust); }
.page-btn:hover:not(.active) { border-color: var(--color-border-dark); }
</style>
