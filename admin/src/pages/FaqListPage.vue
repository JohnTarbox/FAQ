<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useFaq } from '../composables/useFaq';
import StatusBadge from '../components/StatusBadge.vue';

const router = useRouter();
const { faqs, loading, loadList, deleteFaq } = useFaq();

const statusFilter = ref('');
const searchFilter = ref('');

onMounted(() => loadList());

async function applyFilters() {
  await loadList({ status: statusFilter.value || undefined, search: searchFilter.value || undefined });
}

async function handleDelete(id: number) {
  if (confirm('Delete this FAQ?')) {
    await deleteFaq(id);
    await loadList();
  }
}
</script>

<template>
  <div>
    <div class="topbar">
      <h1>FAQs</h1>
      <router-link to="/faq/new" class="btn btn-primary">+ New FAQ</router-link>
    </div>

    <div class="filters-row">
      <input v-model="searchFilter" @input="applyFilters" type="text" class="filter-input" placeholder="Search FAQs…">
      <select v-model="statusFilter" @change="applyFilters" class="filter-select">
        <option value="">All Statuses</option>
        <option value="draft">Draft</option>
        <option value="pending_review">Pending Review</option>
        <option value="published">Published</option>
        <option value="rejected">Rejected</option>
      </select>
    </div>

    <div class="table-section">
      <table class="admin-table">
        <thead>
          <tr>
            <th>Question</th>
            <th>Status</th>
            <th>Author</th>
            <th>Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="faq in faqs" :key="faq.id">
            <td class="question-cell">{{ faq.question }}</td>
            <td><StatusBadge :status="faq.status" /></td>
            <td>{{ faq.authorEmail }}</td>
            <td>{{ faq.updatedAt?.split('T')[0] }}</td>
            <td>
              <div class="actions">
                <router-link :to="`/faq/${faq.id}`" class="btn-icon" title="Edit">Edit</router-link>
                <button @click="handleDelete(faq.id)" class="btn-icon danger" title="Delete">Del</button>
              </div>
            </td>
          </tr>
          <tr v-if="!faqs.length && !loading">
            <td colspan="5" style="text-align:center; color:var(--color-ink-muted); padding:32px;">No FAQs found.</td>
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
.btn-primary:hover { background: var(--color-rust-light); color: #fff; }
.filters-row { display: flex; gap: 12px; margin-bottom: 20px; }
.filter-input { padding: 8px 14px; font-size: 13px; border: 1.5px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-warm-white); flex: 1; font-family: var(--font-ui); }
.filter-input:focus { outline: none; border-color: var(--color-rust); }
.filter-select { padding: 8px 14px; font-size: 13px; border: 1.5px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-warm-white); font-family: var(--font-ui); }
.table-section { background: var(--color-warm-white); border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; }
.admin-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.admin-table th { text-align: left; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-ink-muted); padding: 10px 12px; border-bottom: 2px solid var(--color-border); }
.admin-table td { padding: 12px; border-bottom: 1px solid var(--color-border); color: var(--color-ink-light); }
.admin-table tr:hover td { background: rgba(250,247,242,0.5); }
.question-cell { font-weight: 500; color: var(--color-ink); max-width: 300px; }
.actions { display: flex; gap: 6px; }
.btn-icon { padding: 4px 8px; font-size: 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: transparent; cursor: pointer; color: var(--color-ink-muted); text-decoration: none; }
.btn-icon:hover { border-color: var(--color-border-dark); color: var(--color-ink-light); }
.btn-icon.danger { color: var(--color-status-rejected); }
.btn-icon.danger:hover { background: var(--color-rust-pale); }
</style>
