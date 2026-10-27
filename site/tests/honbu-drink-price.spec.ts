import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

test("本部のペットボトルドリンク価格が150円で統一されている", () => {
  const entriesDir = new URL("../src/data/entries/", import.meta.url);
  const boothEntries = JSON.parse(
    readFileSync(fileURLToPath(new URL("booth.json", entriesDir)), "utf8"),
  ) as { id: string; description?: string }[];
  const programEntries = JSON.parse(
    readFileSync(fileURLToPath(new URL("program.json", entriesDir)), "utf8"),
  ) as { id: string; description?: string }[];
  const news = JSON.parse(readFileSync(fileURLToPath(new URL("../src/data/news.json", import.meta.url)), "utf8")) as {
    id: string;
    body?: string;
  }[];
  const mapHeadquarters = readFileSync(
    fileURLToPath(new URL("../src/pages/map/headquarters.astro", import.meta.url)),
    "utf8",
  );

  expect(boothEntries.find((entry) => entry.id === "honbu-goods-booth")?.description).toContain("150円");
  expect(boothEntries.find((entry) => entry.id === "honbu-goods-booth")?.description).not.toContain("100円");
  expect(programEntries.find((entry) => entry.id === "honbu-goods")?.description).toContain("150円");
  expect(programEntries.find((entry) => entry.id === "honbu-goods")?.description).not.toContain("100円");
  expect(news.find((item) => item.id === "honbu-goods")?.body).toContain("150円");
  expect(news.find((item) => item.id === "honbu-goods")?.body).not.toContain("100円");
  expect(mapHeadquarters).toContain("ペットボトルドリンクを150円で販売しています。");
  expect(mapHeadquarters).not.toContain("ペットボトルドリンクを100円で販売しています。");
});
