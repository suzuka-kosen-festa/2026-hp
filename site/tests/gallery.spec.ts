import { test } from "@playwright/test";
import { describePage } from "./_shared";

describePage("gallery", "/gallery/");

// 本番の成果物からは除外されるページなので、本番モードのビルドでは検査できない
// （scripts/strip-dev-pages.mjs）
test.skip(process.env.APPLY_RELEASE === "1", "/gallery/ は本番の成果物から除外されるため");
