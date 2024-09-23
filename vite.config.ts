import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import wasm from 'vite-plugin-wasm'
import assetPlugin from './plugins/assets'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [wasm(), preact(), assetPlugin()],
  appType: 'spa'
})
