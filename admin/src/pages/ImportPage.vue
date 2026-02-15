<script setup lang="ts">
import { ref, computed } from 'vue';
import { useApi } from '../composables/useApi';
import { useAuth } from '../composables/useAuth';

const api = useApi();
const { user } = useAuth();

const activeTab = ref<'faq' | 'glossary'>('faq');
const items = ref<any[]>([]);
const fileName = ref('');
const parseError = ref('');
const importing = ref(false);
const result = ref<{ created: number; errors: string[] } | null>(null);

const isAdmin = computed(() => user.value?.role === 'admin');

const previewItems = computed(() => items.value.slice(0, 10));
const previewColumns = computed(() => {
  if (activeTab.value === 'faq') return ['question', 'answer', 'slug'];
  return ['term', 'shortDefinition', 'slug'];
});

function handleFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  parseError.value = '';
  result.value = null;
  items.value = [];
  fileName.value = file.name;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result as string);
      // Handle both raw array and { items: [...] } format
      if (Array.isArray(parsed)) {
        items.value = parsed;
      } else if (parsed.items && Array.isArray(parsed.items)) {
        items.value = parsed.items;
      } else {
        parseError.value = 'JSON must be an array or an object with an "items" array.';
      }
    } catch {
      parseError.value = 'Invalid JSON file.';
    }
  };
  reader.readAsText(file);
}

async function doImport() {
  if (!items.value.length) return;
  importing.value = true;
  result.value = null;

  const endpoint = activeTab.value === 'faq' ? '/import/faq' : '/import/glossary';
  const data = await api.call(() => api.post<{ created: number; errors: string[] }>(endpoint, { items: items.value }));

  if (data) {
    result.value = data;
  }
  importing.value = false;
}

function reset() {
  items.value = [];
  fileName.value = '';
  parseError.value = '';
  result.value = null;
}
</script>

<template>
  <div v-if="!isAdmin" class="no-access">
    <h2>Access Denied</h2>
    <p>Only administrators can access the import feature.</p>
  </div>
  <div v-else>
    <div class="topbar">
      <h1>Import</h1>
    </div>

    <div class="tabs">
      <button
        class="tab"
        :class="{ active: activeTab === 'faq' }"
        @click="activeTab = 'faq'; reset()"
      >FAQ</button>
      <button
        class="tab"
        :class="{ active: activeTab === 'glossary' }"
        @click="activeTab = 'glossary'; reset()"
      >Glossary</button>
    </div>

    <div class="upload-zone">
      <label class="upload-label">
        <input type="file" accept=".json" @change="handleFile" class="file-input">
        <span class="upload-text">
          <span v-if="fileName">{{ fileName }}</span>
          <span v-else>Choose a JSON file or drag it here</span>
        </span>
      </label>
    </div>

    <div v-if="parseError" class="error-msg">{{ parseError }}</div>

    <div v-if="items.length && !result" class="preview-section">
      <h3>Preview ({{ items.length }} items{{ items.length > 10 ? ', showing first 10' : '' }})</h3>
      <div class="table-section">
        <table class="admin-table">
          <thead>
            <tr>
              <th v-for="col in previewColumns" :key="col">{{ col }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, i) in previewItems" :key="i">
              <td v-for="col in previewColumns" :key="col" class="preview-cell">
                {{ item[col] || '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <button class="btn btn-primary" :disabled="importing" @click="doImport">
        {{ importing ? 'Importing...' : `Import ${items.length} ${activeTab === 'faq' ? 'FAQs' : 'terms'}` }}
      </button>
    </div>

    <div v-if="result" class="result-section">
      <div class="result-success">{{ result.created }} items imported successfully.</div>
      <div v-if="result.errors.length" class="result-errors">
        <h4>Errors ({{ result.errors.length }})</h4>
        <ul>
          <li v-for="(err, i) in result.errors" :key="i">{{ err }}</li>
        </ul>
      </div>
      <button class="btn btn-secondary" @click="reset">Import More</button>
    </div>
  </div>
</template>

<style scoped>
.topbar { margin-bottom: 24px; }
.topbar h1 { font-family: var(--font-display); font-size: 26px; font-weight: 700; }
.no-access { text-align: center; padding: 60px 20px; color: var(--color-ink-muted); }
.no-access h2 { font-family: var(--font-display); font-size: 22px; margin-bottom: 8px; color: var(--color-ink); }
.tabs { display: flex; gap: 4px; margin-bottom: 24px; }
.tab {
  padding: 8px 20px;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-warm-white);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  font-family: var(--font-ui);
  color: var(--color-ink-light);
}
.tab.active { background: var(--color-rust); color: #fff; border-color: var(--color-rust); }
.upload-zone { margin-bottom: 20px; }
.upload-label {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-warm-white);
  cursor: pointer;
  transition: border-color 0.15s;
}
.upload-label:hover { border-color: var(--color-rust); }
.file-input { display: none; }
.upload-text { font-size: 14px; color: var(--color-ink-muted); }
.error-msg { color: var(--color-status-rejected, #c04b2e); font-size: 14px; margin-bottom: 16px; padding: 10px 14px; background: rgba(192,75,46,0.06); border-radius: var(--radius-sm); }
.preview-section { margin-bottom: 24px; }
.preview-section h3 { font-size: 15px; font-weight: 600; margin-bottom: 12px; }
.table-section { background: var(--color-warm-white); border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; margin-bottom: 16px; }
.admin-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.admin-table th { text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-ink-muted); padding: 10px 12px; border-bottom: 2px solid var(--color-border); }
.admin-table td { padding: 12px; border-bottom: 1px solid var(--color-border); color: var(--color-ink-light); }
.preview-cell { max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.btn { display: inline-flex; padding: 9px 18px; font-size: 14px; font-weight: 500; border-radius: var(--radius-sm); border: none; cursor: pointer; font-family: var(--font-ui); }
.btn-primary { background: var(--color-rust); color: #fff; }
.btn-primary:hover { background: var(--color-rust-light); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-secondary { background: var(--color-warm-white); color: var(--color-ink); border: 1.5px solid var(--color-border); }
.btn-secondary:hover { border-color: var(--color-border-dark); }
.result-section { padding: 24px; background: var(--color-warm-white); border: 1px solid var(--color-border); border-radius: var(--radius-md); }
.result-success { font-size: 16px; font-weight: 600; color: var(--color-sage, #4a9c6d); margin-bottom: 16px; }
.result-errors { margin-bottom: 16px; }
.result-errors h4 { font-size: 14px; font-weight: 600; color: var(--color-status-rejected, #c04b2e); margin-bottom: 8px; }
.result-errors ul { list-style: disc; padding-left: 20px; font-size: 13px; color: var(--color-ink-light); }
.result-errors li { margin-bottom: 4px; }
</style>
