import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import assetPlugin from './plugins/assets'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [preact(), assetPlugin()],
  appType: 'spa',
})
