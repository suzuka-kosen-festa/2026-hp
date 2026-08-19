// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // canonical URL と sitemap の絶対URLの基準。
  // 本番は www 側が正で、apex(snct-fes.info) は www へ301、
  // snct-fes-2026.pages.dev も同じ中身を返すため、canonical でここに寄せる
  site: 'https://www.snct-fes.info',
  integrations: [
    react(),
    // /gallery は開発用（noindex）なので sitemap からも外す
    sitemap({ filter: (page) => !page.includes('/gallery') }),
  ],
});
