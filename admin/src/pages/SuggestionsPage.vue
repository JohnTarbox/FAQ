<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useSuggestions } from '../composables/useSuggestions';
import { useAuth } from '../composables/useAuth';

const { user } = useAuth();
const {
  suggestions, stats, totalPages, loading, error,
  loadList, loadStats, accept, dismiss, bulkDismiss, triggerDiscovery,
} = useSuggestions();

const statusFilter = ref('new');
const sourceTypeFilter = ref('');
const currentPage = ref(1);
const discovering = ref(false);
const selectedIds = ref<Set<number>>(new Set());

// Preview modal
const previewSuggestion = ref<any>(null);

// Edit & Accept modal
const editingSuggestion = ref<any>(null);
const editQuestion = ref('');
const editAnswer = ref('');

const isAdmin = computed(() => user.value?.role === 'admin');

onMounted(async () => {
  await Promise.all([loadList({ status: 'new' }), loadStats()]);
});

async function applyFilters() {
  currentPage.value = 1;
  await loadList({
    status: statusFilter.value || undefined,
    sourceType: sourceTypeFilter.value || undefined,
    page: 1,
  });
}

async function goToPage(page: number) {
  currentPage.value = page;
  await loadList({
    status: statusFilter.value || undefined,
    sourceType: sourceTypeFilter.value || undefined,
    page,
  });
}

async function handleDiscover() {
  discovering.value = true;
  await triggerDiscovery();
  discovering.value = false;
  await Promise.all([loadList({ status: statusFilter.value || undefined }), loadStats()]);
}

async function handleAccept(id: number) {
  await accept(id);
  await Promise.all([loadList({ status: statusFilter.value || undefined, page: currentPage.value }), loadStats()]);
}

async function handleDismiss(id: number) {
  await dismiss(id);
  await Promise.all([loadList({ status: statusFilter.value || undefined, page: currentPage.value }), loadStats()]);
}

function openPreview(s: any) {
  previewSuggestion.value = s;
}

function closePreview() {
  previewSuggestion.value = null;
}

function openEdit(s: any) {
  editingSuggestion.value = s;
  editQuestion.value = s.question;
  editAnswer.value = s.answer;
}

function closeEdit() {
  editingSuggestion.value = null;
}

async function handleEditAccept() {
  if (!editingSuggestion.value) return;
  await accept(editingSuggestion.value.id, {
    question: editQuestion.value,
    answer: editAnswer.value,
  });
  closeEdit();
  await Promise.all([loadList({ status: statusFilter.value || undefined, page: currentPage.value }), loadStats()]);
}

function toggleSelection(id: number) {
  const s = new Set(selectedIds.value);
  if (s.has(id)) s.delete(id); else s.add(id);
  selectedIds.value = s;
}

async function handleBulkDismiss() {
  if (selectedIds.value.size === 0) return;
  await bulkDismiss([...selectedIds.value]);
  selectedIds.value = new Set();
  await Promise.all([loadList({ status: statusFilter.value || undefined, page: currentPage.value }), loadStats()]);
}

function confidenceClass(score: number) {
  if (score >= 80) return 'confidence-high';
  if (score >= 50) return 'confidence-medium';
  return 'confidence-low';
}

function sourceIcon(type: string) {
  if (type === 'youtube') return '▶';
  if (type === 'site') return '⌂';
  return '⊕';
}
</script>

<template>
  <div>
    <div class="topbar">
      <h1>AI Suggestions</h1>
      <button
        v-if="isAdmin"
        class="btn btn-primary"
        :disabled="discovering"
        @click="handleDiscover"
      >
        {{ discovering ? 'Discovering…' : 'Discover Now' }}
      </button>
    </div>

    <!-- Stats bar -->
    <div class="stats-row">
      <div class="stat-card highlight">
        <div class="stat-label">New</div>
        <div class="stat-value pending">{{ stats.new || 0 }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Accepted</div>
        <div class="stat-value published">{{ stats.accepted || 0 }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Dismissed</div>
        <div class="stat-value">{{ stats.dismissed || 0 }}</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters-row">
      <select v-model="statusFilter" @change="applyFilters" class="filter-select">
        <option value="">All Statuses</option>
        <option value="new">New</option>
        <option value="accepted">Accepted</option>
        <option value="dismissed">Dismissed</option>
      </select>
      <select v-model="sourceTypeFilter" @change="applyFilters" class="filter-select">
        <option value="">All Sources</option>
        <option value="youtube">YouTube</option>
        <option value="web">Web</option>
        <option value="site">APRS Sites</option>
      </select>
      <button
        v-if="selectedIds.size > 0"
        class="btn btn-dismiss"
        @click="handleBulkDismiss"
      >
        Dismiss Selected ({{ selectedIds.size }})
      </button>
    </div>

    <!-- Error display -->
    <div v-if="error" class="error-bar">{{ error }}</div>

    <!-- Suggestions list -->
    <div class="suggestions-list">
      <div
        v-for="s in suggestions"
        :key="s.id"
        class="suggestion-card"
      >
        <div class="card-header">
          <label class="checkbox-label" v-if="s.status === 'new'">
            <input
              type="checkbox"
              :checked="selectedIds.has(s.id)"
              @change="toggleSelection(s.id)"
            >
          </label>
          <span class="source-icon" :title="s.sourceType">{{ sourceIcon(s.sourceType) }}</span>
          <span class="confidence-badge" :class="confidenceClass(s.confidenceScore)">
            {{ s.confidenceScore }}%
          </span>
          <span class="suggestion-status" :class="`status-${s.status}`">{{ s.status }}</span>
        </div>
        <div class="card-question">{{ s.question }}</div>
        <div class="card-source" v-if="s.sourceTitle">
          <a :href="s.sourceUrl" target="_blank" rel="noopener">{{ s.sourceTitle }}</a>
        </div>
        <div class="card-meta" v-if="s.suggestedCategory">
          Category: {{ s.suggestedCategory }}
        </div>
        <div class="card-actions">
          <button class="btn-icon" @click="openPreview(s)" title="Preview">Preview</button>
          <template v-if="s.status === 'new'">
            <button class="btn-icon accept" @click="handleAccept(s.id)" title="Accept">Accept</button>
            <button class="btn-icon" @click="openEdit(s)" title="Edit & Accept">Edit</button>
            <button class="btn-icon danger" @click="handleDismiss(s.id)" title="Dismiss">Dismiss</button>
          </template>
        </div>
      </div>

      <div v-if="!suggestions.length && !loading" class="empty-state">
        No suggestions found.
      </div>
    </div>

    <!-- Pagination -->
    <div class="pagination" v-if="totalPages > 1">
      <button
        v-for="p in totalPages"
        :key="p"
        class="page-btn"
        :class="{ active: p === currentPage }"
        @click="goToPage(p)"
      >
        {{ p }}
      </button>
    </div>

    <!-- Preview Modal -->
    <div v-if="previewSuggestion" class="modal-overlay" @click.self="closePreview">
      <div class="modal">
        <div class="modal-header">
          <h2>Suggestion Preview</h2>
          <button class="modal-close" @click="closePreview">&times;</button>
        </div>
        <div class="modal-body">
          <h3>{{ previewSuggestion.question }}</h3>
          <div class="preview-answer" v-html="previewSuggestion.answer"></div>
          <div class="preview-meta">
            <div v-if="previewSuggestion.sourceUrl">
              <strong>Source:</strong>
              <a :href="previewSuggestion.sourceUrl" target="_blank" rel="noopener">{{ previewSuggestion.sourceTitle || previewSuggestion.sourceUrl }}</a>
            </div>
            <div><strong>Confidence:</strong> {{ previewSuggestion.confidenceScore }}%</div>
            <div v-if="previewSuggestion.suggestedCategory"><strong>Category:</strong> {{ previewSuggestion.suggestedCategory }}</div>
            <div v-if="previewSuggestion.suggestedTags"><strong>Tags:</strong> {{ previewSuggestion.suggestedTags }}</div>
          </div>
        </div>
        <div class="modal-footer" v-if="previewSuggestion.status === 'new'">
          <button class="btn btn-primary" @click="handleAccept(previewSuggestion.id); closePreview()">Accept</button>
          <button class="btn btn-dismiss" @click="handleDismiss(previewSuggestion.id); closePreview()">Dismiss</button>
        </div>
      </div>
    </div>

    <!-- Edit & Accept Modal -->
    <div v-if="editingSuggestion" class="modal-overlay" @click.self="closeEdit">
      <div class="modal modal-wide">
        <div class="modal-header">
          <h2>Edit &amp; Accept</h2>
          <button class="modal-close" @click="closeEdit">&times;</button>
        </div>
        <div class="modal-body">
          <label class="field-label">Question</label>
          <input v-model="editQuestion" class="field-input" />
          <label class="field-label">Answer (HTML)</label>
          <textarea v-model="editAnswer" class="field-textarea" rows="10"></textarea>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" @click="handleEditAccept">Accept with Changes</button>
          <button class="btn btn-cancel" @click="closeEdit">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
.topbar h1 { font-family: var(--font-display); font-size: 26px; font-weight: 700; }

.stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
.stat-card { background: var(--color-warm-white); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 20px; }
.stat-card.highlight { border-color: var(--color-gold); background: var(--color-gold-pale); }
.stat-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-ink-muted); margin-bottom: 6px; }
.stat-value { font-family: var(--font-display); font-size: 32px; font-weight: 700; }
.stat-value.published { color: var(--color-sage); }
.stat-value.pending { color: var(--color-gold); }

.filters-row { display: flex; gap: 12px; margin-bottom: 20px; align-items: center; }
.filter-select { padding: 8px 14px; font-size: 13px; border: 1.5px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-warm-white); font-family: var(--font-ui); }

.error-bar { background: var(--color-rust-pale); color: var(--color-status-rejected); padding: 10px 16px; border-radius: var(--radius-sm); margin-bottom: 16px; font-size: 13px; }

.suggestions-list { display: flex; flex-direction: column; gap: 12px; }
.suggestion-card { background: var(--color-warm-white); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 16px; }
.suggestion-card:hover { border-color: var(--color-border-dark, #ccc); }

.card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.checkbox-label { display: flex; align-items: center; }
.source-icon { font-size: 16px; width: 20px; text-align: center; }
.confidence-badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 100px; }
.confidence-high { background: var(--color-sage-light); color: var(--color-status-published); }
.confidence-medium { background: var(--color-gold-pale); color: var(--color-status-pending); }
.confidence-low { background: #f0f0f0; color: var(--color-ink-muted); }

.suggestion-status { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; margin-left: auto; }
.status-new { color: var(--color-gold); }
.status-accepted { color: var(--color-sage); }
.status-dismissed { color: var(--color-ink-muted); }

.card-question { font-weight: 500; font-size: 15px; color: var(--color-ink); margin-bottom: 4px; }
.card-source { font-size: 12px; color: var(--color-ink-muted); margin-bottom: 4px; }
.card-source a { color: var(--color-rust); text-decoration: none; }
.card-source a:hover { text-decoration: underline; }
.card-meta { font-size: 12px; color: var(--color-ink-muted); margin-bottom: 8px; }

.card-actions { display: flex; gap: 6px; }
.btn-icon { padding: 4px 10px; font-size: 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: transparent; cursor: pointer; color: var(--color-ink-muted); }
.btn-icon:hover { border-color: var(--color-border-dark, #ccc); color: var(--color-ink-light); }
.btn-icon.accept { color: var(--color-sage); border-color: var(--color-sage); }
.btn-icon.accept:hover { background: var(--color-sage-light); }
.btn-icon.danger { color: var(--color-status-rejected); }
.btn-icon.danger:hover { background: var(--color-rust-pale); }

.btn { display: inline-flex; padding: 8px 16px; font-size: 13px; font-weight: 500; border-radius: var(--radius-sm); border: none; cursor: pointer; }
.btn-primary { background: var(--color-rust); color: #fff; }
.btn-primary:hover { background: var(--color-rust-light); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-dismiss { background: #e8e8e8; color: var(--color-ink-muted); }
.btn-dismiss:hover { background: #ddd; }
.btn-cancel { background: transparent; border: 1px solid var(--color-border); color: var(--color-ink-muted); }

.empty-state { text-align: center; color: var(--color-ink-muted); padding: 32px; font-size: 14px; }

.pagination { display: flex; gap: 6px; margin-top: 20px; justify-content: center; }
.page-btn { padding: 6px 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-warm-white); cursor: pointer; font-size: 13px; }
.page-btn.active { background: var(--color-rust); color: #fff; border-color: var(--color-rust); }

/* Modals */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: #fff; border-radius: var(--radius-md); max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto; }
.modal-wide { max-width: 800px; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--color-border); }
.modal-header h2 { font-size: 16px; font-weight: 600; }
.modal-close { background: none; border: none; font-size: 22px; cursor: pointer; color: var(--color-ink-muted); }
.modal-body { padding: 20px; }
.modal-body h3 { font-size: 15px; font-weight: 600; margin-bottom: 12px; }
.preview-answer { font-size: 14px; line-height: 1.6; color: var(--color-ink-light); margin-bottom: 16px; }
.preview-meta { font-size: 13px; color: var(--color-ink-muted); display: flex; flex-direction: column; gap: 4px; }
.preview-meta a { color: var(--color-rust); }
.modal-footer { padding: 12px 20px; border-top: 1px solid var(--color-border); display: flex; gap: 8px; justify-content: flex-end; }

.field-label { display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-ink-muted); margin-bottom: 6px; margin-top: 12px; }
.field-label:first-child { margin-top: 0; }
.field-input { width: 100%; padding: 8px 12px; font-size: 14px; border: 1.5px solid var(--color-border); border-radius: var(--radius-sm); font-family: var(--font-ui); box-sizing: border-box; }
.field-textarea { width: 100%; padding: 8px 12px; font-size: 13px; border: 1.5px solid var(--color-border); border-radius: var(--radius-sm); font-family: monospace; box-sizing: border-box; resize: vertical; }
</style>
