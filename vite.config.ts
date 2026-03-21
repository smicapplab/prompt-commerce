import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit(),
  ],
  resolve: {
    // The SvelteKit outDir lives in /tmp/ with a symlinked node_modules.
    // preserveSymlinks stops Vite following the symlink and computing a broken
    // relative path (../../../../Users/steve/...) back to the real location.
    preserveSymlinks: true,
  },
  build: {
    // Don't try to empty the output dir before building —
    // the host-mounted filesystem blocks deletion of previously built files.
    emptyOutDir: false,
  },
});
