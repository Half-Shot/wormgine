import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import assetPlugin from './plugins/assets'

const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig({
  clearScreen: false,
  plugins: [preact(), assetPlugin()],
  appType: 'spa',
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    minify: false,
    assetsInlineLimit: 0,
  },
  define: {
    global: {},
  },
  server: {
    // Tauri expects a fixed port, fail if that port is not available
    strictPort: true,
    // if the host Tauri is expecting is set, use it
    host: host || false,
    port: 5173,
  },
})
