import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Group heavy libraries into their own chunks so they cache independently of the app code. */
function manualChunks(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined
  if (id.includes('/three/') || id.includes('three-stdlib') || id.includes('postprocessing') || id.includes('n8ao')) return 'three'
  if (id.includes('@react-three') || id.includes('/react/') || id.includes('react-dom') || id.includes('scheduler') || id.includes('zustand')) return 'react'
  if (id.includes('gsap')) return 'gsap'
  return undefined
}

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1400,
    rollupOptions: { output: { manualChunks } },
  },
  test: { environment: 'node' },
} as never)
