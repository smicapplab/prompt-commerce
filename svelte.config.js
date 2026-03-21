import adapter from '@sveltejs/adapter-node';

/**
 * NOTE: .svelte-kit cache is redirected to /tmp to avoid EPERM issues on
 * macOS-mounted host filesystems. Before first build on a new machine, run:
 *
 *   mkdir -p /tmp/svelte-kit-prompt-commerce && \
 *   ln -sf $(pwd)/node_modules /tmp/svelte-kit-prompt-commerce/node_modules
 *
 * This is handled automatically by `npm run build` if you add it to the
 * prebuild script. See package.json.
 */

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({ out: 'build' }),
    // Keep .svelte-kit cache outside the mounted host folder to avoid EPERM
    outDir: '/tmp/svelte-kit-prompt-commerce',
    alias: {
      '$lib': './src/lib',
      '$lib/*': './src/lib/*',
    },
  }
};

export default config;
