// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

import { isInSitemap } from './src/lib/release.ts';

// https://astro.build/config
export default defineConfig({
  // canonical URL と sitemap の絶対URLの基準。
  // 本番は www 側が正で、apex(snct-fes.info) は www へ301、
  // snct-fes-2026.pages.dev も同じ中身を返すため、canonical でここに寄せる
  site: 'https://www.snct-fes.info',
  integrations: [
    react(),
    // 公開しているページだけ載せる（src/data/release.json）。
    // 準備中のページは noindex なので、sitemap に出すと矛盾する。
    // /gallery と /holding は isPublished の対象外（常にtrue）なのでここで明示的に外す
    // 本番に実在するURLだけを載せる。実体の無いURLを申告し続けると、
    // 消えたあとも検索結果から飛ばれ続ける（/booth/ で実際に起きた）
    sitemap({ filter: (page) => isInSitemap(new URL(page).pathname) }),
  ],
});
