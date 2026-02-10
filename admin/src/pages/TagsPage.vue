<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useApi } from '../composables/useApi';

const api = useApi();
const tags = ref<any[]>([]);
const newName = ref('');

async function load() {
  const result = await api.get<any[]>('/tags');
  if (result) tags.value = result;
}

async function addTag() {
  if (!newName.value.trim()) return;
  await api.post('/tags', { name: newName.value.trim() });
  newName.value = '';
  await load();
}

async function deleteTag(id: number) {
  if (confirm('Delete this tag?')) {
    await api.del(`/tags/${id}`);
    await load();
  }
}

onMounted(load);
</script>

<template>
  <div>
    <div class="topbar">
      <h1>FAQ Tags</h1>
    </div>

    <div class="section">
      <div class="add-row">
        <input v-model="newName" @keyup.enter="addTag" type="text" class="form-input" placeholder="New tag name…">
        <button @click="addTag" class="btn btn-primary">Add</button>
      </div>

      <div class="tags-grid">
        <div v-for="tag in tags" :key="tag.id" class="tag-chip">
          <span>{{ tag.name }}</span>
          <button @click="deleteTag(tag.id)" class="remove" title="Delete">&times;</button>
        </div>
        <div v-if="!tags.length" style="color:var(--color-ink-muted); font-size:14px;">No tags yet.</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.topbar { margin-bottom: 24px; }
.topbar h1 { font-family: var(--font-display); font-size: 26px; font-weight: 700; }
.section { background: var(--color-warm-white); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 24px; }
.add-row { display: flex; gap: 12px; margin-bottom: 20px; }
.form-input { flex: 1; padding: 10px 14px; font-size: 14px; border: 1.5px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-warm-white); font-family: var(--font-ui); }
.form-input:focus { outline: none; border-color: var(--color-rust); }
.btn { padding: 9px 18px; font-family: var(--font-ui); font-size: 14px; font-weight: 500; border-radius: var(--radius-sm); border: none; cursor: pointer; }
.btn-primary { background: var(--color-rust); color: #fff; }
.tags-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.tag-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 14px;
  background: var(--color-sage-light);
  color: var(--color-sage);
  border-radius: 100px;
  font-size: 13px;
  font-weight: 500;
}
.tag-chip .remove {
  background: none; border: none; cursor: pointer;
  font-size: 16px; line-height: 1;
  color: var(--color-sage); opacity: 0.5;
}
.tag-chip .remove:hover { opacity: 1; }
</style>
