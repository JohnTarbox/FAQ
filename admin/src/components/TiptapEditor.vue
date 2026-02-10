<script setup lang="ts">
import { useEditor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Placeholder from '@tiptap/extension-placeholder';
import { watch } from 'vue';

const props = defineProps<{
  modelValue: string;
  placeholder?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const editor = useEditor({
  content: props.modelValue,
  extensions: [
    StarterKit,
    Image,
    Link.configure({ openOnClick: false }),
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    Placeholder.configure({ placeholder: props.placeholder || 'Start writing…' }),
  ],
  onUpdate({ editor }) {
    emit('update:modelValue', editor.getHTML());
  },
});

watch(() => props.modelValue, (val) => {
  if (editor.value && editor.value.getHTML() !== val) {
    editor.value.commands.setContent(val, false);
  }
});

function addImage() {
  const url = prompt('Image URL:');
  if (url && editor.value) {
    editor.value.chain().focus().setImage({ src: url }).run();
  }
}

function addLink() {
  const url = prompt('Link URL:');
  if (url && editor.value) {
    editor.value.chain().focus().setLink({ href: url }).run();
  }
}
</script>

<template>
  <div class="tiptap-wrapper" v-if="editor">
    <div class="toolbar">
      <button type="button" @click="editor!.chain().focus().toggleBold().run()" :class="{ active: editor!.isActive('bold') }"><strong>B</strong></button>
      <button type="button" @click="editor!.chain().focus().toggleItalic().run()" :class="{ active: editor!.isActive('italic') }"><em>I</em></button>
      <span class="sep" />
      <button type="button" @click="editor!.chain().focus().toggleHeading({ level: 2 }).run()" :class="{ active: editor!.isActive('heading', { level: 2 }) }">H2</button>
      <button type="button" @click="editor!.chain().focus().toggleHeading({ level: 3 }).run()" :class="{ active: editor!.isActive('heading', { level: 3 }) }">H3</button>
      <span class="sep" />
      <button type="button" @click="addLink">Link</button>
      <button type="button" @click="addImage">Img</button>
      <span class="sep" />
      <button type="button" @click="editor!.chain().focus().toggleBulletList().run()" :class="{ active: editor!.isActive('bulletList') }">UL</button>
      <button type="button" @click="editor!.chain().focus().toggleOrderedList().run()" :class="{ active: editor!.isActive('orderedList') }">OL</button>
      <span class="sep" />
      <button type="button" @click="editor!.chain().focus().toggleBlockquote().run()" :class="{ active: editor!.isActive('blockquote') }">Quote</button>
      <button type="button" @click="editor!.chain().focus().toggleCodeBlock().run()" :class="{ active: editor!.isActive('codeBlock') }">Code</button>
    </div>
    <EditorContent :editor="editor" class="editor-content" />
  </div>
</template>

<style scoped>
.tiptap-wrapper {
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.toolbar {
  display: flex; gap: 2px; flex-wrap: wrap;
  padding: 6px 8px;
  background: #f8f6f2;
  border-bottom: 1px solid var(--color-border);
}
.toolbar button {
  width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: none;
  border-radius: 3px; cursor: pointer;
  font-family: var(--font-ui); font-size: 12px; font-weight: 600;
  color: var(--color-ink-light);
  transition: background 0.15s;
}
.toolbar button:hover { background: rgba(0,0,0,0.06); }
.toolbar button.active { background: rgba(0,0,0,0.1); color: var(--color-rust); }
.sep { width: 1px; margin: 4px; background: var(--color-border); }
.editor-content {
  min-height: 240px;
  padding: 16px;
  font-family: var(--font-body);
  font-size: 15px;
  line-height: 1.7;
  background: var(--color-warm-white);
}
.editor-content :deep(.tiptap) { outline: none; min-height: 200px; }
.editor-content :deep(.tiptap p) { margin-bottom: 0.8em; }
.editor-content :deep(.tiptap h2) { font-family: var(--font-display); font-size: 22px; margin: 1em 0 0.5em; }
.editor-content :deep(.tiptap h3) { font-family: var(--font-display); font-size: 18px; margin: 0.8em 0 0.4em; }
.editor-content :deep(.tiptap ul), .editor-content :deep(.tiptap ol) { padding-left: 1.5em; margin-bottom: 0.8em; }
.editor-content :deep(.tiptap blockquote) { border-left: 3px solid var(--color-border); padding-left: 1em; color: var(--color-ink-light); }
.editor-content :deep(.tiptap img) { max-width: 100%; border-radius: var(--radius-sm); }
.editor-content :deep(.is-empty::before) { content: attr(data-placeholder); color: var(--color-ink-muted); pointer-events: none; float: left; height: 0; }
</style>
