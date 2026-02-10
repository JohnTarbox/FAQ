<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useApi } from '../composables/useApi';

const api = useApi();
const categories = ref<any[]>([]);
const newName = ref('');

async function load() {
  const result = await api.get<any[]>('/categories');
  if (result) categories.value = result;
}

async function addCategory() {
  if (!newName.value.trim()) return;
  await api.post('/categories', { name: newName.value.trim() });
  newName.value = '';
  await load();
}

async function deleteCategory(id: number) {
  if (confirm('Delete this category?')) {
    await api.del(`/categories/${id}`);
    await load();
  }
}

onMounted(load);
</script>

<template>
  <div>
    <div class="topbar">
      <h1>FAQ Categories</h1>
    </div>

    <div class="section">
      <div class="add-row">
        <input v-model="newName" @keyup.enter="addCategory" type="text" class="form-input" placeholder="New category name…">
        <button @click="addCategory" class="btn btn-primary">Add</button>
      </div>

      <table class="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Slug</th>
            <th>Sort Order</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="cat in categories" :key="cat.id">
            <td class="name-cell">{{ cat.name }}</td>
            <td class="slug-cell">{{ cat.slug }}</td>
            <td>{{ cat.sortOrder }}</td>
            <td><button @click="deleteCategory(cat.id)" class="btn-icon danger">Delete</button></td>
          </tr>
          <tr v-if="!categories.length">
            <td colspan="4" style="text-align:center; color:var(--color-ink-muted); padding:24px;">No categories yet.</td>
          </tr>
        </tbody>
      </table>
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
.admin-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.admin-table th { text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-ink-muted); padding: 10px 12px; border-bottom: 2px solid var(--color-border); }
.admin-table td { padding: 12px; border-bottom: 1px solid var(--color-border); }
.name-cell { font-weight: 500; color: var(--color-ink); }
.slug-cell { font-family: var(--font-mono); font-size: 12px; color: var(--color-ink-muted); }
.btn-icon { padding: 4px 8px; font-size: 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: transparent; cursor: pointer; }
.btn-icon.danger { color: var(--color-status-rejected); border-color: var(--color-status-rejected); }
</style>
