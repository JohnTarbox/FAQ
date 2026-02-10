import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  { path: '/', name: 'dashboard', component: () => import('../pages/DashboardPage.vue') },
  { path: '/faq', name: 'faq-list', component: () => import('../pages/FaqListPage.vue') },
  { path: '/faq/new', name: 'faq-new', component: () => import('../pages/FaqEditPage.vue') },
  { path: '/faq/:id', name: 'faq-edit', component: () => import('../pages/FaqEditPage.vue') },
  { path: '/glossary', name: 'glossary-list', component: () => import('../pages/GlossaryListPage.vue') },
  { path: '/glossary/new', name: 'glossary-new', component: () => import('../pages/GlossaryEditPage.vue') },
  { path: '/glossary/:id', name: 'glossary-edit', component: () => import('../pages/GlossaryEditPage.vue') },
  { path: '/categories', name: 'categories', component: () => import('../pages/CategoriesPage.vue') },
  { path: '/tags', name: 'tags', component: () => import('../pages/TagsPage.vue') },
];

export const router = createRouter({
  history: createWebHistory('/admin/'),
  routes,
});
