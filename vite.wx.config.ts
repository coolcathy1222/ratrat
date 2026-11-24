import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'minigame',
    emptyOutDir: false,
    minify: true,
    lib: {
      entry: resolve(__dirname, 'src/wx-main.ts'),
      name: 'RatRat',
      formats: ['iife'],
      fileName: () => 'game.js',
    },
    rollupOptions: {
      output: {
        extend: true,
        inlineDynamicImports: true,
      },
    },
  },
})
