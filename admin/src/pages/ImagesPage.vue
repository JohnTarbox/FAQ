<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useImages, type ImageItem } from '../composables/useImages';

const { images, nextCursor, uploading, load, loadMore, upload, remove } = useImages();
const dragOver = ref(false);

onMounted(() => load());

async function handleUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = input.files;
  if (!files) return;
  for (const file of files) {
    await upload(file);
  }
  input.value = '';
}

async function handleDrop(event: DragEvent) {
  dragOver.value = false;
  const files = event.dataTransfer?.files;
  if (!files) return;
  for (const file of files) {
    await upload(file);
  }
}

async function handleDelete(img: ImageItem) {
  if (confirm(`Delete ${img.key}?`)) {
    await remove(img.key);
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

function copyUrl(key: string) {
  navigator.clipboard.writeText(`/${key}`);
}
</script>

<template>
  <div>
    <div class="topbar">
      <h1>Images</h1>
    </div>

    <div
      class="upload-zone"
      :class="{ dragover: dragOver }"
      @dragover.prevent="dragOver = true"
      @dragleave="dragOver = false"
      @drop.prevent="handleDrop"
    >
      <label class="upload-label">
        <input type="file" accept="image/*" multiple @change="handleUpload" class="file-input">
        <span v-if="uploading" class="upload-text">Uploading...</span>
        <span v-else class="upload-text">Drop images here or click to upload</span>
      </label>
    </div>

    <div class="image-grid">
      <div v-for="img in images" :key="img.key" class="image-card">
        <div class="image-preview">
          <img :src="`/${img.key}`" :alt="img.key" loading="lazy">
        </div>
        <div class="image-info">
          <div class="image-name" :title="img.key">{{ img.key.split('/').pop() }}</div>
          <div class="image-meta">{{ formatSize(img.size) }} &middot; {{ formatDate(img.uploaded) }}</div>
        </div>
        <div class="image-actions">
          <button class="btn-icon" @click="copyUrl(img.key)" title="Copy URL">Copy</button>
          <button class="btn-icon danger" @click="handleDelete(img)" title="Delete">Del</button>
        </div>
      </div>
    </div>

    <div v-if="!images.length && !uploading" class="empty-msg">No images uploaded yet.</div>

    <div v-if="nextCursor" class="load-more">
      <button class="btn btn-secondary" @click="loadMore()">Load More</button>
    </div>
  </div>
</template>

<style scoped>
.topbar { margin-bottom: 24px; }
.topbar h1 { font-family: var(--font-display); font-size: 26px; font-weight: 700; }
.upload-zone {
  padding: 32px;
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-md);
  text-align: center;
  margin-bottom: 24px;
  transition: border-color 0.15s, background 0.15s;
}
.upload-zone.dragover { border-color: var(--color-rust); background: rgba(192,75,46,0.04); }
.upload-label { cursor: pointer; }
.file-input { display: none; }
.upload-text { font-size: 14px; color: var(--color-ink-muted); }
.image-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
.image-card {
  background: var(--color-warm-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.image-preview { aspect-ratio: 1; overflow: hidden; background: #f5f3ef; }
.image-preview img { width: 100%; height: 100%; object-fit: cover; display: block; }
.image-info { padding: 10px 12px; }
.image-name { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.image-meta { font-size: 11px; color: var(--color-ink-muted); margin-top: 2px; }
.image-actions { display: flex; gap: 6px; padding: 0 12px 10px; }
.btn-icon { padding: 4px 8px; font-size: 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: transparent; cursor: pointer; color: var(--color-ink-muted); }
.btn-icon:hover { border-color: var(--color-border-dark); color: var(--color-ink-light); }
.btn-icon.danger { color: var(--color-status-rejected); }
.btn-icon.danger:hover { background: var(--color-rust-pale); }
.empty-msg { text-align: center; color: var(--color-ink-muted); padding: 40px; font-size: 14px; }
.load-more { text-align: center; margin-top: 20px; }
.btn { display: inline-flex; padding: 8px 16px; font-size: 13px; font-weight: 500; border-radius: var(--radius-sm); border: none; cursor: pointer; font-family: var(--font-ui); }
.btn-secondary { background: var(--color-warm-white); color: var(--color-ink); border: 1.5px solid var(--color-border); }
.btn-secondary:hover { border-color: var(--color-border-dark); }
</style>
