<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useGlossary } from '../composables/useGlossary';
import TiptapEditor from '../components/TiptapEditor.vue';

const route = useRoute();
const router = useRouter();
const { currentTerm, loading, error, loadById, create, update } = useGlossary();

const isNew = computed(() => route.name === 'glossary-new');
const id = computed(() => Number(route.params.id));

const term = ref('');
const slug = ref('');
const shortDefinition = ref('');
const longDefinition = ref('');
const abbreviation = ref('');
const acronymExpansion = ref('');
const alternateNamesInput = ref('');
const exampleUsage = ref('');
const status = ref<'draft' | 'published'>('draft');

onMounted(async () => {
  if (!isNew.value && id.value) {
    await loadById(id.value);
    if (currentTerm.value) {
      term.value = currentTerm.value.term;
      slug.value = currentTerm.value.slug;
      shortDefinition.value = currentTerm.value.shortDefinition;
      longDefinition.value = currentTerm.value.longDefinition || '';
      abbreviation.value = currentTerm.value.abbreviation || '';
      acronymExpansion.value = currentTerm.value.acronymExpansion || '';
      alternateNamesInput.value = (currentTerm.value.alternateNames || []).join(', ');
      exampleUsage.value = currentTerm.value.exampleUsage || '';
      status.value = currentTerm.value.status;
    }
  }
});

function autoSlug() {
  if (isNew.value || !slug.value) {
    slug.value = term.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
}

async function handleSave() {
  const data = {
    term: term.value,
    slug: slug.value,
    shortDefinition: shortDefinition.value,
    longDefinition: longDefinition.value || undefined,
    abbreviation: abbreviation.value || undefined,
    acronymExpansion: acronymExpansion.value || undefined,
    alternateNames: alternateNamesInput.value ? alternateNamesInput.value.split(',').map(s => s.trim()).filter(Boolean) : undefined,
    exampleUsage: exampleUsage.value || undefined,
    status: status.value,
  };

  if (isNew.value) {
    const result = await create(data);
    if (result) router.push(`/glossary/${result.id}`);
  } else {
    await update(id.value, data);
    await loadById(id.value);
  }
}
</script>

<template>
  <div>
    <div class="topbar">
      <div>
        <div class="breadcrumb">
          <router-link to="/glossary">Glossary</router-link> <span>›</span> {{ isNew ? 'New' : 'Edit' }}
        </div>
        <h1>{{ isNew ? 'New Glossary Term' : 'Edit Glossary Term' }}</h1>
      </div>
    </div>

    <div v-if="error" class="error-bar">{{ error }}</div>

    <div class="section">
      <div class="two-col">
        <div class="form-group">
          <label class="form-label">Term</label>
          <input v-model="term" @blur="autoSlug" type="text" class="form-input term-input" placeholder="Term name">
        </div>
        <div class="form-group">
          <label class="form-label">Slug</label>
          <input v-model="slug" type="text" class="form-input slug-input" placeholder="auto-generated">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Short Definition</label>
        <textarea v-model="shortDefinition" class="form-textarea" rows="3" placeholder="Brief definition (max 250 chars)"></textarea>
        <div class="char-count">{{ shortDefinition.length }} / 250</div>
      </div>

      <div class="form-group">
        <label class="form-label">Long Definition</label>
        <TiptapEditor v-model="longDefinition" placeholder="Extended definition…" />
      </div>

      <div class="two-col">
        <div class="form-group">
          <label class="form-label">Abbreviation</label>
          <input v-model="abbreviation" type="text" class="form-input" placeholder="e.g. 4-H">
        </div>
        <div class="form-group">
          <label class="form-label">Acronym Expansion</label>
          <input v-model="acronymExpansion" type="text" class="form-input" placeholder="e.g. Head, Heart, Hands, Health">
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Alternate Names (comma-separated)</label>
        <input v-model="alternateNamesInput" type="text" class="form-input" placeholder="e.g. Four-H, 4H">
      </div>

      <div class="form-group">
        <label class="form-label">Example Usage</label>
        <textarea v-model="exampleUsage" class="form-textarea" rows="2" placeholder="A sentence showing the term in use…"></textarea>
      </div>

      <div class="form-group">
        <label class="form-label">Status</label>
        <select v-model="status" class="filter-select">
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </div>
    </div>

    <div class="form-actions">
      <button @click="handleSave" class="btn btn-primary" :disabled="loading">Save</button>
      <router-link to="/glossary" class="btn btn-secondary">Cancel</router-link>
    </div>
  </div>
</template>

<style scoped>
.topbar { margin-bottom: 24px; }
.topbar h1 { font-family: var(--font-display); font-size: 26px; font-weight: 700; }
.breadcrumb { font-size: 13px; color: var(--color-ink-muted); margin-bottom: 4px; }
.breadcrumb a { color: var(--color-ink-muted); }
.breadcrumb span { margin: 0 6px; }
.error-bar { background: var(--color-rust-pale); color: var(--color-rust); padding: 10px 16px; border-radius: var(--radius-sm); margin-bottom: 16px; font-size: 14px; }
.section { background: var(--color-warm-white); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 24px; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.form-group { margin-bottom: 20px; }
.form-label { display: block; font-size: 13px; font-weight: 600; color: var(--color-ink-light); margin-bottom: 6px; }
.form-input { width: 100%; padding: 10px 14px; font-family: var(--font-body); font-size: 15px; border: 1.5px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-warm-white); }
.form-input:focus { outline: none; border-color: var(--color-rust); }
.term-input { font-family: var(--font-display); font-size: 18px; font-weight: 600; }
.slug-input { font-family: var(--font-mono); font-size: 13px; color: var(--color-ink-muted); }
.form-textarea { width: 100%; padding: 10px 14px; font-family: var(--font-body); font-size: 15px; border: 1.5px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-warm-white); resize: vertical; }
.form-textarea:focus { outline: none; border-color: var(--color-rust); }
.char-count { font-size: 11px; color: var(--color-ink-muted); text-align: right; margin-top: 4px; }
.filter-select { padding: 8px 14px; font-size: 13px; border: 1.5px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-warm-white); font-family: var(--font-ui); }
.form-actions { display: flex; gap: 12px; padding-top: 24px; }
.btn { display: inline-flex; align-items: center; justify-content: center; padding: 9px 18px; font-family: var(--font-ui); font-size: 14px; font-weight: 500; border-radius: var(--radius-sm); border: 1.5px solid transparent; cursor: pointer; text-decoration: none; }
.btn-primary { background: var(--color-rust); color: #fff; }
.btn-primary:hover { background: var(--color-rust-light); }
.btn-secondary { background: var(--color-warm-white); border-color: var(--color-border); color: var(--color-ink-light); }
</style>
