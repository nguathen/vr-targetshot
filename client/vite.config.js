import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { copyFileSync, mkdirSync, readdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = resolve(__dirname, 'src');

// Plugin to copy A-Frame components (non-module scripts)
function copyComponentsPlugin() {
  return {
    name: 'copy-components',
    closeBundle() {
      const srcComponents = resolve(srcDir, 'js/components');
      const destComponents = resolve(__dirname, 'dist/js/components');
      const srcCore = resolve(srcDir, 'js/core');
      const destCore = resolve(__dirname, 'dist/js/core');

      // Create directories
      mkdirSync(destComponents, { recursive: true });
      mkdirSync(destCore, { recursive: true });

      // Copy all component files
      readdirSync(srcComponents).forEach(file => {
        if (file.endsWith('.js')) {
          copyFileSync(resolve(srcComponents, file), resolve(destComponents, file));
        }
      });

      // Copy core files
      readdirSync(srcCore).forEach(file => {
        if (file.endsWith('.js')) {
          copyFileSync(resolve(srcCore, file), resolve(destCore, file));
        }
      });

      console.log('[vite] Copied A-Frame components and core to dist/');
    }
  };
}

export default defineConfig({
  root: srcDir,
  publicDir: resolve(__dirname, 'public'),
  plugins: [copyComponentsPlugin()],
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
