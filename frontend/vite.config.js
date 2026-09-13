import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  server: {
    allowedHosts: true,
    hmr: {
      overlay: false,
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        guide: resolve(__dirname, 'guide.html'),
      }
    }
  }
})

