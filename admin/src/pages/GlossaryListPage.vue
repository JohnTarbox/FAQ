<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useGlossary } from '../composables/useGlossary';
import StatusBadge from '../components/StatusBadge.vue';

const { terms, loading, loadList, deleteTerm } = useGlossary();
const searchFilter = ref('');
const statusFilter = ref('');

onMounted(() => loadList());

async function applyFilters() {
  await loadList({ status: statusFilter.value || undefined, search: searchFilter.value || undefined });
}

async function handleDelete(id: number) {
  if (confirm('Delete this glossary term?')) {
    await deleteTerm(id);
    await loadList();
  }
}
</script>

<template>
  <div>
    <div class="topbar">
      <h1>Glossary</h1>
      <router-link to="/glossary/new" class="btn btn-primary">+ New Term</router-link>
    </div>

    <div class="filters-row">
      <input v-model="searchFilter" @input="applyFilters" type="text" class="filter-input" placeholder="Search terms…">
      <select v-model="statusFilter" @change="applyFilters" class="filter-select">
        <option value="">All Statuses</option>
        <option value="draft">Draft</option>
        <option value="published">Published</option>
      </select>
    </div>

    <div class="table-section">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Term</th>
            <th>Short Definition</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="term in terms" :key="term.id">
            <td class="term-cell">{{ term.term }}</td>
            <td class="def-cell">{{ term.shortDefinition?.substring(0, 80) }}…</td>
            <td><StatusBadge :status="term.status" /></td>
            <td>
              <div class="actions">
                <router-link :to="`/glossary/${term.id}`" class="btn-icon">Edit</router-link>
                <button @click="handleDelete(term.id)" class="btn-icon danger">Del</button>
              </div>
            </td>
          </tr>
          <tr v-if="!terms.length && !loading">
            <td colspan="4" style="text-align:center; color:var(--color-ink-muted); padding:32px;">No terms found.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
.topbar h1 { font-family: var(--font-display); font-size: 26px; font-weight: 700; }
.btn-primary { display: inline-flex; padding: 9px 18px; font-size: 14px; font-weight: 500; border-radius: var(--radius-sm); background: var(--color-rust); color: #fff; text-decoration: none; }
.filters-row { display: flex; gap: 12px; margin-bottom: 20px; }
.filter-input { padding: 8px 14px; font-size: 13px; border: 1.5px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-warm-white); flex: 1; font-family: var(--font-ui); }
.filter-input:focus { outline: none; border-color: var(--color-rust); }
.filter-select { padding: 8px 14px; font-size: 13px; border: 1.5px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-warm-white); font-family: var(--font-ui); }
.table-section { background: var(--color-warm-white); border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; }
.admin-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.admin-table th { text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-ink-muted); padding: 10px 12px; border-bottom: 2px solid var(--color-border); }
.admin-table td { padding: 12px; border-bottom: 1px solid var(--color-border); color: var(--color-ink-light); }
.term-cell { font-weight: 600; color: var(--color-ink); }
.def-cell { max-width: 400px; }
.actions { display: flex; gap: 6px; }
.btn-icon { padding: 4px 8px; font-size: 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: transparent; cursor: pointer; color: var(--color-ink-muted); text-decoration: none; }
.btn-icon.danger { color: var(--color-status-rejected); }
</style>
