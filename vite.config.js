import { defineConfig } from 'vite'
import { gui } from '@opencode/plugin/gui/vite'

export default defineConfig({
  build: { emptyOutDir: false },
  plugins: [gui({ entry: 'src/gui.tsx', outFile: 'dist/gui-experimental.cjs' })],
})
