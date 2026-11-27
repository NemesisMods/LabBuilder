import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: process.env.SUITE_BASE ?? './',
  plugins: [react()],
  worker: { format: 'es' },
})