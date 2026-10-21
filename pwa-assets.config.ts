// Genera le icone PNG da public/icon.svg (comando: npm run icons).
// L'icona è a tutta pagina: iOS arrotonda gli angoli da solo.
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

const bg = { background: '#0B0B0E' }

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: bg },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: bg },
  },
  images: ['public/icon.svg'],
})
