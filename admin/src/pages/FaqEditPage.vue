<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useFaq } from '../composables/useFaq';
import StatusBadge from '../components/StatusBadge.vue';
import TiptapEditor from '../components/TiptapEditor.vue';

const route = useRoute();
const router = useRouter();
const { currentFaq, loading, error, loadById, create, update, createVersion, submitForReview, approve, reject } = useFaq();

const isNew = computed(() => route.name === 'faq-new');
const id = computed(() => Number(route.params.id));

const question = ref('');
const answer = ref('');
const searchKeywords = ref('');
const categoryId = ref<number | undefined>();
const isFeatured = ref(false);
const sortOrder = ref(0);
const rejectionNote = ref('');

onMounted(async () => {
  if (!isNew.value && id.value) {
    await loadById(id.value);
    if (currentFaq.value) {
      const latest = currentFaq.value.latestVersion;
      question.value = latest?.question || '';
      answer.value = latest?.answer || '';
      searchKeywords.value = latest?.searchKeywords || '';
      categoryId.value = currentFaq.value.categoryId;
      isFeatured.value = currentFaq.value.isFeatured;
      sortOrder.value = currentFaq.value.sortOrder;
    }
  }
});

const latestVersion = computed(() => currentFaq.value?.latestVersion);
const currentStatus = computed(() => latestVersion.value?.status || 'draft');

async function handleSave() {
  if (isNew.value) {
    const result = await create({ question: question.value, answer: answer.value, searchKeywords: searchKeywords.value, categoryId: categoryId.value });
    if (result) router.push(`/faq/${result.entry.id}`);
  } else {
    await createVersion(id.value, { question: question.value, answer: answer.value, searchKeywords: searchKeywords.value });
    await update(id.value, { categoryId: categoryId.value, isFeatured: isFeatured.value, sortOrder: sortOrder.value });
    await loadById(id.value);
  }
}

async function handleSubmit() {
  if (latestVersion.value) {
    await submitForReview(latestVersion.value.id);
    await loadById(id.value);
  }
}

async function handleApprove() {
  if (latestVersion.value) {
    await approve(latestVersion.value.id);
    await loadById(id.value);
  }
}

async function handleReject() {
  if (latestVersion.value && rejectionNote.value) {
    await reject(latestVersion.value.id, rejectionNote.value);
    rejectionNote.value = '';
    await loadById(id.value);
  }
}
</script>

<template>
  <div>
    <div class="topbar">
      <div>
        <div class="breadcrumb">
          <router-link to="/faq">FAQs</router-link> <span>›</span> {{ isNew ? 'New' : 'Edit' }}
        </div>
        <h1>{{ isNew ? 'New FAQ' : 'Edit FAQ' }}</h1>
      </div>
      <StatusBadge v-if="!isNew" :status="currentStatus" />
    </div>

    <div v-if="error" class="error-bar">{{ error }}</div>

    <div class="edit-layout">
      <div class="content-col">
        <div class="section">
          <div class="form-group">
            <label class="form-label">Question</label>
            <input v-model="question" type="text" class="form-input question-input" placeholder="Enter the question…">
          </div>

          <div class="form-group">
            <label class="form-label">Answer</label>
            <TiptapEditor v-model="answer" placeholder="Write the answer…" />
          </div>

          <div class="form-group">
            <label class="form-label">Search Keywords</label>
            <input v-model="searchKeywords" type="text" class="form-input" placeholder="Comma-separated keywords…">
          </div>
        </div>

        <div class="form-actions">
          <button @click="handleSave" class="btn btn-secondary" :disabled="loading">{{ isNew ? 'Create Draft' : 'Save Draft' }}</button>
          <router-link to="/faq" class="btn btn-secondary">Cancel</router-link>
        </div>
      </div>

      <div class="sidebar-col" v-if="!isNew">
        <div class="card">
          <div class="card-label">Current Status</div>
          <StatusBadge :status="currentStatus" />
          <div class="workflow-actions">
            <button v-if="currentStatus === 'draft'" @click="handleSubmit" class="btn btn-gold full-width">Submit for Review</button>
            <template v-if="currentStatus === 'pending_review'">
              <button @click="handleApprove" class="btn btn-sage full-width">Approve</button>
              <input v-model="rejectionNote" type="text" class="form-input" placeholder="Rejection reason…" style="margin-top:8px;">
              <button @click="handleReject" class="btn btn-danger full-width" :disabled="!rejectionNote" style="margin-top:4px;">Reject</button>
            </template>
          </div>
        </div>

        <div class="card">
          <div class="form-group">
            <label class="form-label">Featured</label>
            <label class="toggle-row">
              <input type="checkbox" v-model="isFeatured">
              <span>Show on FAQ homepage</span>
            </label>
          </div>
          <div class="form-group">
            <label class="form-label">Sort Order</label>
            <input v-model.number="sortOrder" type="number" class="form-input" style="width:80px;">
          </div>
        </div>

        <div class="card" v-if="currentFaq?.latestVersion">
          <div class="card-label">Metadata</div>
          <dl class="meta-list">
            <dt>Author</dt>
            <dd>{{ latestVersion?.authorEmail }}</dd>
            <dt>Version</dt>
            <dd>{{ latestVersion?.versionNumber }}</dd>
            <dt>Updated</dt>
            <dd>{{ latestVersion?.updatedAt?.split('T')[0] }}</dd>
          </dl>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.topbar { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
.topbar h1 { font-family: var(--font-display); font-size: 26px; font-weight: 700; }
.breadcrumb { font-size: 13px; color: var(--color-ink-muted); margin-bottom: 4px; }
.breadcrumb a { color: var(--color-ink-muted); }
.breadcrumb span { margin: 0 6px; }
.error-bar { background: var(--color-rust-pale); color: var(--color-rust); padding: 10px 16px; border-radius: var(--radius-sm); margin-bottom: 16px; font-size: 14px; }
.edit-layout { display: grid; grid-template-columns: 1fr 300px; gap: 24px; align-items: start; }
.content-col .section { background: var(--color-warm-white); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 24px; }
.form-group { margin-bottom: 20px; }
.form-label { display: block; font-size: 13px; font-weight: 600; color: var(--color-ink-light); margin-bottom: 6px; }
.form-input { width: 100%; padding: 10px 14px; font-family: var(--font-body); font-size: 15px; border: 1.5px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-warm-white); }
.form-input:focus { outline: none; border-color: var(--color-rust); }
.question-input { font-family: var(--font-display); font-size: 18px; font-weight: 600; }
.form-actions { display: flex; gap: 12px; padding-top: 24px; }
.sidebar-col .card { background: var(--color-warm-white); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 20px; margin-bottom: 16px; }
.card-label { font-size: 12px; color: var(--color-ink-muted); margin-bottom: 8px; }
.workflow-actions { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
.btn { display: inline-flex; align-items: center; justify-content: center; padding: 9px 18px; font-family: var(--font-ui); font-size: 14px; font-weight: 500; border-radius: var(--radius-sm); border: 1.5px solid transparent; cursor: pointer; text-decoration: none; transition: all 0.15s; }
.btn-secondary { background: var(--color-warm-white); border-color: var(--color-border); color: var(--color-ink-light); }
.btn-gold { background: var(--color-gold); color: #fff; }
.btn-sage { background: var(--color-sage); color: #fff; }
.btn-danger { background: transparent; border-color: var(--color-status-rejected); color: var(--color-status-rejected); }
.full-width { width: 100%; }
.toggle-row { display: flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer; }
.meta-list dt { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-ink-muted); margin-bottom: 2px; }
.meta-list dd { color: var(--color-ink-light); margin-bottom: 12px; font-size: 13px; }
</style>
