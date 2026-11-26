import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@interview-prep\/shared\/tutor$/,
        replacement: path.resolve(__dirname, '../shared/src/schemas/tutorBarrel.ts')
      },
      {
        find: /^@interview-prep\/shared$/,
        replacement: path.resolve(__dirname, '../shared/src/index.ts')
      }
    ]
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:5000',
        ws: true
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-icons': ['lucide-react'],
          'vendor-motion': ['framer-motion']
        }
      }
    }
  }
});
