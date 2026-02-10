<script setup lang="ts">
defineProps<{ status: string }>();

const statusMap: Record<string, { label: string; class: string }> = {
  draft: { label: 'Draft', class: 'badge-draft' },
  pending_review: { label: 'Pending', class: 'badge-pending' },
  published: { label: 'Published', class: 'badge-published' },
  rejected: { label: 'Rejected', class: 'badge-rejected' },
};
</script>

<template>
  <span class="status-badge" :class="statusMap[status]?.class || 'badge-draft'">
    {{ statusMap[status]?.label || status }}
  </span>
</template>

<style scoped>
.status-badge {
  display: inline-block;
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 100px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.badge-draft { background: #f0f0f0; color: var(--color-status-draft); }
.badge-pending { background: var(--color-gold-pale); color: var(--color-status-pending); }
.badge-published { background: var(--color-sage-light); color: var(--color-status-published); }
.badge-rejected { background: var(--color-rust-pale); color: var(--color-status-rejected); }
</style>
