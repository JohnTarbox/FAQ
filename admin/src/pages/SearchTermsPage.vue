<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSuggestions } from '../composables/useSuggestions';

const {
  searchTerms, loading, error,
  loadSearchTerms, addSearchTerm, updateSearchTerm, deleteSearchTerm,
} = useSuggestions();

const newTerm = ref('');

onMounted(() => loadSearchTerms());

async function handleAdd() {
  const term = newTerm.value.trim();
  if (!term) return;
  await addSearchTerm(term);
  newTerm.value = '';
  await loadSearchTerms();
}

async function handleToggle(id: number, currentActive: boolean) {
  await updateSearchTerm(id, { isActive: !currentActive });
  await loadSearchTerms();
}

async function handleDelete(id: number) {
  if (!confirm('Delete this search term?')) return;
  await deleteSearchTerm(id);
  await loadSearchTerms();
}
</script>

<template>
  <div>
    <div class="topbar">
      <h1>Search Terms</h1>
    </div>

    <div class="add-form">
      <input
        v-model="newTerm"
        @keyup.enter="handleAdd"
        class="filter-input"
        placeholder="Add new search term…"
      />
      <button class="btn btn-primary" @click="handleAdd" :disabled="!newTerm.trim()">Add</button>
    </div>

    <div v-if="error" class="error-bar">{{ error }}</div>

    <div class="table-section">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Term</th>
            <th>Active</th>
            <th>Source Types</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="term in searchTerms" :key="term.id">
            <td class="term-cell">{{ term.term }}</td>
            <td>
              <button
                class="toggle-btn"
                :class="{ active: term.isActive }"
                @click="handleToggle(term.id, term.isActive)"
              >
                {{ term.isActive ? 'Active' : 'Inactive' }}
              </button>
            </td>
            <td class="source-types">{{ term.sourceTypes }}</td>
            <td>
              <button @click="handleDelete(term.id)" class="btn-icon danger" title="Delete">Del</button>
            </td>
          </tr>
          <tr v-if="!searchTerms.length && !loading">
            <td colspan="4" style="text-align:center; color:var(--color-ink-muted); padding:32px;">No search terms configured.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
.topbar h1 { font-family: var(--font-display); font-size: 26px; font-weight: 700; }

.add-form { display: flex; gap: 12px; margin-bottom: 20px; }
.filter-input { padding: 8px 14px; font-size: 13px; border: 1.5px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-warm-white); flex: 1; font-family: var(--font-ui); }
.filter-input:focus { outline: none; border-color: var(--color-rust); }

.btn { display: inline-flex; padding: 8px 16px; font-size: 13px; font-weight: 500; border-radius: var(--radius-sm); border: none; cursor: pointer; }
.btn-primary { background: var(--color-rust); color: #fff; }
.btn-primary:hover { background: var(--color-rust-light); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.error-bar { background: var(--color-rust-pale); color: var(--color-status-rejected); padding: 10px 16px; border-radius: var(--radius-sm); margin-bottom: 16px; font-size: 13px; }

.table-section { background: var(--color-warm-white); border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; }
.admin-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.admin-table th { text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-ink-muted); padding: 10px 12px; border-bottom: 2px solid var(--color-border); }
.admin-table td { padding: 12px; border-bottom: 1px solid var(--color-border); color: var(--color-ink-light); }
.admin-table tr:hover td { background: rgba(250,247,242,0.5); }
.term-cell { font-weight: 500; color: var(--color-ink); }
.source-types { font-size: 12px; color: var(--color-ink-muted); font-family: monospace; }

.toggle-btn { padding: 3px 10px; font-size: 11px; font-weight: 600; border-radius: 100px; border: none; cursor: pointer; text-transform: uppercase; letter-spacing: 0.04em; background: #f0f0f0; color: var(--color-ink-muted); }
.toggle-btn.active { background: var(--color-sage-light); color: var(--color-status-published); }

.btn-icon { padding: 4px 8px; font-size: 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: transparent; cursor: pointer; color: var(--color-ink-muted); }
.btn-icon.danger { color: var(--color-status-rejected); }
.btn-icon.danger:hover { background: var(--color-rust-pale); }
</style>
