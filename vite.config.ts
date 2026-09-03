import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const port = Number(process.env.PORT) || 3000;
const basePath = process.env.BASE_PATH || '/';

export default defineConfig({
  base: basePath,
  root: path.resolve(__dirname, 'src/client'),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/client'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
    dedupe: ['react', 'react-dom'],
  },
  build: {
    outDir: path.resolve(__dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
  publicDir: path.resolve(__dirname, 'public'),
});