import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  base: '/collect/',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('react-syntax-highlighter') ||
            id.includes('prismjs') ||
            id.includes('highlight.js') ||
            id.includes('refractor') ||
            id.includes('lowlight') ||
            id.includes('character-entities') ||
            id.includes('hast-util') ||
            id.includes('parse5') ||
            id.includes('unist-util') ||
            id.includes('vfile') ||
            id.includes('fault') ||
            id.includes('format')
          ) {
            return 'vendor-syntax'
          }
          if (id.includes('firebase')) {
            return 'vendor-firebase'
          }
          if (id.includes('lucide-react') || id.includes('lucide')) {
            return 'vendor-lucide'
          }
          if (
            id.includes('react') ||
            id.includes('scheduler') ||
            id.includes('react-dom') ||
            id.includes('react-router') ||
            id.includes('@remix-run')
          ) {
            return 'vendor-react'
          }
          if (id.includes('node_modules') || id.includes('.pnpm')) {
            return 'vendor-others'
          }
        }
      }
    }
  },
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
