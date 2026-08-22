import { defineConfig } from 'vite';

// Repository Pages is served from /SharetheSpoils/ rather than the domain root.
export default defineConfig({
  base: '/SharetheSpoils/',
  // The supplied game icons are published as static assets without duplicating them.
  publicDir: 'itemImage',
});
