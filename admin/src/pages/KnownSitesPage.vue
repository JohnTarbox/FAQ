<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSuggestions } from '../composables/useSuggestions';

const {
  knownSites, loading, error,
  loadKnownSites, addKnownSite, updateKnownSite, deleteKnownSite,
} = useSuggestions();

const newUrl = ref('');
const newTitle = ref('');

onMounted(() => loadKnownSites());

async function handleAdd() {
  const url = newUrl.value.trim();
  if (!url) return;
  await addKnownSite(url, newTitle.value.trim() || undefined);
  newUrl.value = '';
  newTitle.value = '';
  await loadKnownSites();
}

async function handleToggle(id: number, currentActive: boolean) {
  await updateKnownSite(id, { isActive: !currentActive });
  await loadKnownSites();
}

async function handleDelete(id: number) {
  if (!confirm('Delete this known site?')) return;
  await deleteKnownSite(id);
  await loadKnownSites();
}
</script>

<template>
  <div>
    <div class="topbar">
      <h1>Known Sites</h1>
    </div>

    <div class="add-form">
      <input
        v-model="newUrl"
        @keyup.enter="handleAdd"
        class="filter-input url-input"
        placeholder="https://example.com"
      />
      <input
        v-model="newTitle"
        @keyup.enter="handleAdd"
        class="filter-input title-input"
        placeholder="Title (optional)"
      />
      <button class="btn btn-primary" @click="handleAdd" :disabled="!newUrl.trim()">Add</button>
    </div>

    <div v-if="error" class="error-bar">{{ error }}</div>

    <div class="table-section">
      <table class="admin-table">
        <thead>
          <tr>
            <th>URL</th>
            <th>Title</th>
            <th>Active</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="site in knownSites" :key="site.id">
            <td class="url-cell">
              <a :href="site.url" target="_blank" rel="noopener">{{ site.url }}</a>
            </td>
            <td class="title-cell">{{ site.title || '—' }}</td>
            <td>
              <button
                class="toggle-btn"
                :class="{ active: site.isActive }"
                @click="handleToggle(site.id, site.isActive)"
              >
                {{ site.isActive ? 'Active' : 'Inactive' }}
              </button>
            </td>
            <td>
              <button @click="handleDelete(site.id)" class="btn-icon danger" title="Delete">Del</button>
            </td>
          </tr>
          <tr v-if="!knownSites.length && !loading">
            <td colspan="4" style="text-align:center; color:var(--color-ink-muted); padding:32px;">No known sites configured.</td>
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
.filter-input { padding: 8px 14px; font-size: 13px; border: 1.5px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-warm-white); font-family: var(--font-ui); }
.url-input { flex: 2; }
.title-input { flex: 1; }
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
.url-cell a { color: var(--color-rust); text-decoration: none; font-weight: 500; word-break: break-all; }
.url-cell a:hover { text-decoration: underline; }
.title-cell { color: var(--color-ink-muted); }

.toggle-btn { padding: 3px 10px; font-size: 11px; font-weight: 600; border-radius: 100px; border: none; cursor: pointer; text-transform: uppercase; letter-spacing: 0.04em; background: #f0f0f0; color: var(--color-ink-muted); }
.toggle-btn.active { background: var(--color-sage-light); color: var(--color-status-published); }

.btn-icon { padding: 4px 8px; font-size: 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: transparent; cursor: pointer; color: var(--color-ink-muted); }
.btn-icon.danger { color: var(--color-status-rejected); }
.btn-icon.danger:hover { background: var(--color-rust-pale); }
</style>
