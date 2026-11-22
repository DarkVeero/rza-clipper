import { defineConfig } from 'vite'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '#': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'node22',
    sourcemap: true,
    rollupOptions: {
      external: ['electron'],
      output: {
        format: 'cjs',
        entryFileNames: 'preload.js',
      },
    },
  },
})
