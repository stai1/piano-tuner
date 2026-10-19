import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    // Full-bleed background so launchers can crop maskable icons to any shape.
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#23517a' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#23517a' } },
  },
  images: ['public/icon.svg'],
});
