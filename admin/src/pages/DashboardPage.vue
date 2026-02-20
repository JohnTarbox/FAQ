<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useApi } from '../composables/useApi';
import StatusBadge from '../components/StatusBadge.vue';

const api = useApi();
const stats = ref({ total: 0, published: 0, pending: 0, drafts: 0 });
const pendingReviews = ref<any[]>([]);
const recentItems = ref<any[]>([]);
const suggestionStats = ref<Record<string, number>>({ new: 0, accepted: 0, dismissed: 0 });
const recentSuggestions = ref<any[]>([]);

onMounted(async () => {
  const [allResult, pendingResult, sugStats, sugNew] = await Promise.all([
    api.get<any>('/faq?page=1'),
    api.get<any>('/faq?status=pending_review'),
    api.get<Record<string, number>>('/suggestions/stats').catch(() => null),
    api.get<any>('/suggestions?status=new&limit=5').catch(() => null),
  ]);
  if (allResult) stats.value.total = allResult.items?.length || 0;
  if (pendingResult) {
    pendingReviews.value = pendingResult.items || [];
    stats.value.pending = pendingReviews.value.length;
  }
  if (sugStats) suggestionStats.value = sugStats;
  if (sugNew) recentSuggestions.value = sugNew.items || [];
});
</script>

<template>
  <div>
    <div class="topbar">
      <h1>Dashboard</h1>
    </div>

    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">Total FAQs</div>
        <div class="stat-value">{{ stats.total }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Published</div>
        <div class="stat-value published">{{ stats.published }}</div>
      </div>
      <div class="stat-card highlight">
        <div class="stat-label">Pending Review</div>
        <div class="stat-value pending">{{ stats.pending }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Drafts</div>
        <div class="stat-value">{{ stats.drafts }}</div>
      </div>
    </div>

    <div class="section" v-if="suggestionStats.new > 0">
      <h2>AI Suggestions</h2>
      <div class="stats-row" style="margin-bottom:12px;">
        <div class="stat-card mini">
          <div class="stat-label">New</div>
          <div class="stat-value pending" style="font-size:20px;">{{ suggestionStats.new }}</div>
        </div>
        <div class="stat-card mini">
          <div class="stat-label">Accepted</div>
          <div class="stat-value published" style="font-size:20px;">{{ suggestionStats.accepted }}</div>
        </div>
      </div>
      <div v-for="s in recentSuggestions" :key="s.id" class="review-item">
        <div class="review-question">{{ s.question }}</div>
        <div class="review-author">{{ s.confidenceScore }}% confidence</div>
        <router-link to="/suggestions" class="btn btn-gold btn-sm">Review</router-link>
      </div>
    </div>

    <div class="section" v-if="pendingReviews.length">
      <h2>Pending Review</h2>
      <div v-for="item in pendingReviews" :key="item.id" class="review-item">
        <div class="review-question">{{ item.question }}</div>
        <div class="review-author">by {{ item.authorEmail }}</div>
        <router-link :to="`/faq/${item.id}`" class="btn btn-gold btn-sm">Review</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.topbar { margin-bottom: 28px; }
.topbar h1 { font-family: var(--font-display); font-size: 26px; font-weight: 700; }
.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
.stat-card { background: var(--color-warm-white); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 20px; }
.stat-card.highlight { border-color: var(--color-gold); background: var(--color-gold-pale); }
.stat-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-ink-muted); margin-bottom: 6px; }
.stat-value { font-family: var(--font-display); font-size: 32px; font-weight: 700; }
.stat-value.published { color: var(--color-sage); }
.stat-value.pending { color: var(--color-gold); }
.section { background: var(--color-warm-white); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 24px; margin-bottom: 24px; }
.section h2 { font-size: 15px; font-weight: 600; margin-bottom: 16px; }
.review-item { display: flex; align-items: center; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--color-border); font-size: 14px; }
.review-item:last-child { border-bottom: none; }
.review-question { flex: 1; font-weight: 500; }
.review-author { color: var(--color-ink-muted); font-size: 13px; }
.btn { display: inline-flex; padding: 5px 12px; font-size: 12px; font-weight: 500; border-radius: var(--radius-sm); border: none; cursor: pointer; text-decoration: none; }
.btn-gold { background: var(--color-gold); color: #fff; }
.btn-gold:hover { background: #b08726; }
</style>
