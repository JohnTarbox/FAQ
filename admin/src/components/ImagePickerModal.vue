<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useImages, type ImageItem } from '../composables/useImages';

const emit = defineEmits<{
  select: [url: string];
  close: [];
}>();

const { images, nextCursor, uploading, load, loadMore, upload } = useImages();
const selected = ref<string | null>(null);
const dragOver = ref(false);

onMounted(() => load());

async function handleUpload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const url = await upload(file);
  if (url) {
    selected.value = url;
  }
}

async function handleDrop(event: DragEvent) {
  dragOver.value = false;
  const file = event.dataTransfer?.files[0];
  if (!file) return;
  const url = await upload(file);
  if (url) {
    selected.value = url;
  }
}

function selectImage(img: ImageItem) {
  // Convert R2 key to public URL path
  selected.value = `/${img.key}`;
}

function confirmSelection() {
  if (selected.value) {
    emit('select', selected.value);
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h2>Select Image</h2>
        <button class="close-btn" @click="emit('close')">&times;</button>
      </div>

      <div class="modal-body">
        <div
          class="upload-zone"
          :class="{ dragover: dragOver }"
          @dragover.prevent="dragOver = true"
          @dragleave="dragOver = false"
          @drop.prevent="handleDrop"
        >
          <label class="upload-label">
            <input type="file" accept="image/*" @change="handleUpload" class="file-input">
            <span v-if="uploading">Uploading...</span>
            <span v-else>Drop an image here or click to upload</span>
          </label>
        </div>

        <div class="browse-section">
          <h3>Existing Images</h3>
          <div class="image-grid">
            <div
              v-for="img in images"
              :key="img.key"
              class="image-thumb"
              :class="{ selected: selected === `/${img.key}` }"
              @click="selectImage(img)"
            >
              <img :src="`/${img.key}`" :alt="img.key" loading="lazy">
              <div class="image-meta">{{ formatSize(img.size) }}</div>
            </div>
          </div>
          <button v-if="nextCursor" class="btn btn-secondary" @click="loadMore()">Load More</button>
          <div v-if="!images.length" class="empty-msg">No images uploaded yet.</div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" @click="emit('close')">Cancel</button>
        <button class="btn btn-primary" :disabled="!selected" @click="confirmSelection">Insert Image</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}
.modal {
  background: #fff;
  border-radius: var(--radius-md);
  width: 640px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 12px 40px rgba(0,0,0,0.2);
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}
.modal-header h2 { font-size: 16px; font-weight: 600; font-family: var(--font-display); }
.close-btn { background: none; border: none; font-size: 22px; cursor: pointer; color: var(--color-ink-muted); padding: 0 4px; }
.close-btn:hover { color: var(--color-ink); }
.modal-body { padding: 20px; overflow-y: auto; flex: 1; }
.upload-zone {
  padding: 24px;
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-sm);
  text-align: center;
  margin-bottom: 20px;
  transition: border-color 0.15s, background 0.15s;
}
.upload-zone.dragover { border-color: var(--color-rust); background: rgba(192,75,46,0.04); }
.upload-label { cursor: pointer; font-size: 14px; color: var(--color-ink-muted); }
.file-input { display: none; }
.browse-section h3 { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-ink-muted); margin-bottom: 12px; }
.image-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 12px; }
.image-thumb {
  border: 2px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.15s;
  aspect-ratio: 1;
}
.image-thumb:hover { border-color: var(--color-ink-muted); }
.image-thumb.selected { border-color: var(--color-rust); box-shadow: 0 0 0 2px rgba(192,75,46,0.2); }
.image-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.image-meta { padding: 4px 6px; font-size: 10px; color: var(--color-ink-muted); background: rgba(0,0,0,0.03); }
.empty-msg { text-align: center; color: var(--color-ink-muted); font-size: 13px; padding: 20px; }
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--color-border);
}
.btn { display: inline-flex; padding: 8px 16px; font-size: 13px; font-weight: 500; border-radius: var(--radius-sm); border: none; cursor: pointer; font-family: var(--font-ui); }
.btn-primary { background: var(--color-rust); color: #fff; }
.btn-primary:hover { background: var(--color-rust-light); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-secondary { background: var(--color-warm-white); color: var(--color-ink); border: 1.5px solid var(--color-border); }
.btn-secondary:hover { border-color: var(--color-border-dark); }
</style>
