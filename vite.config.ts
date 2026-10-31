import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/digoliyetanidasdi/',
  plugins: [react(), tailwindcss()],
  build: {
    copyPublicDir: false,
  },
  server: {
    fs: {
      allow: ['..', '/Users/julietmcvicker/code/workshop-transcription'],
    },
  },
});
