import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/admin/',
  build: {
    // Output into the main project's public/ so Vercel serves it at /admin/
    outDir: '../public/admin',
    emptyOutDir: true,
  },
})
