import { build } from 'vite'
import { copyFile } from 'node:fs/promises'

// Build in an isolated output directory; never empty the repository root.
await build()
await copyFile(new URL('../dist/gui-experimental.cjs', import.meta.url), new URL('../gui-experimental.cjs', import.meta.url))
