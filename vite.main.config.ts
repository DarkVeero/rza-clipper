import { defineConfig } from 'vite'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '#': path.resolve(__dirname, 'src'),
    },
    conditions: ['node'],
    mainFields: ['module', 'jsnext:main', 'jsnext'],
  },
  build: {
    target: 'node22',
    sourcemap: true,
    rollupOptions: {
      external: ['electron', 'onnxruntime-node', 'ffmpeg-static'],
      output: {
        format: 'es',
        entryFileNames: 'main.js',
      },
    },
  },
})
