import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(__dirname, 'src');

export default defineConfig({
  root: srcDir,
  publicDir: resolve(__dirname, 'public'),
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    copyPublicDir: true,
    rollupOptions: {
      input: {
        main: resolve(srcDir, 'index.html'),
        game: resolve(srcDir, 'game.html'),
        shop: resolve(srcDir, 'shop.html'),
        stats: resolve(srcDir, 'stats.html'),
        settings: resolve(srcDir, 'settings.html'),
        tutorial: resolve(srcDir, 'tutorial.html'),
        friends: resolve(srcDir, 'friends.html'),
        leaderboard: resolve(srcDir, 'leaderboard.html'),
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
