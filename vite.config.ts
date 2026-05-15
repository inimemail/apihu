import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig(() => {
  return {
    root: projectRoot,
    plugins: [vue()],
    server: {
      port: 5174,
    },
  }
})
