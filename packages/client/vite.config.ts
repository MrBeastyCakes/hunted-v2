import { defineConfig } from 'vite';

// On `vite build` (GitHub Pages), assets are served under /hunted-v2/.
// In dev, serve from root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/hunted-v2/' : '/',
  server: { port: 5173 },
}));
