// scripts/scrape-donuts.mjs
// 던킨코리아 메뉴(도넛) 페이지를 렌더링해서 상품명 + 이미지를 수집하고
// donuts/ 폴더에 "상품명.jpg" 형태로 저장한다.
//
// 실행: node scripts/scrape-donuts.mjs
// (GitHub Actions 워크플로에서 자동으로 실행됨)

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "https://www.dunkindonuts.co.kr";
const LIST_URL = `${BASE}/menu?cat=1`; // 도넛 카테고리
const OUT_DIR = path.resolve("donuts");

function sanitizeFileName(name) {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[\\/:*?"<>|]/g, "") // 파일명에 쓸 수 없는 문자 제거
    .slice(0, 100);
}

async function downloadImage(page, url, destPath) {
  const resp = await page.request.get(url);
  if (!resp.ok()) {
    throw new Error(`이미지 다운로드 실패 (${resp.status()}): ${url}`);
  }
  const buffer = await resp.body();
  fs.writeFileSync(destPath, buffer);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  });
  const page = await context.newPage();

  console.log(`목록 페이지 접속: ${LIST_URL}`);
  await page.goto(LIST_URL, { waitUntil: "networkidle", timeout: 60000 });

  // 페이지가 무한스크롤/탭 형태일 수 있으므로, 있으면 "더보기" 버튼을 몇 번 눌러본다.
  for (let i = 0; i < 10; i++) {
    const moreBtn = page.locator(
      'button:has-text("더보기"), a:has-text("더보기"), button:has-text("더 보기")'
    );
    if ((await moreBtn.count()) > 0 && (await moreBtn.first().isVisible())) {
      try {
        await moreBtn.first().click({ timeout: 3000 });
        await page.waitForTimeout(800);
      } catch {
        break;
      }
    } else {
      break;
    }
  }

  // 상세페이지 링크(/menu/view?cat=1&sub=...&id=...) 전부 수집
  const links = await page.$$eval('a[href*="/menu/view?cat=1"]', (as) =>
    Array.from(
      new Set(
        as.map((a) => a.getAttribute("href")).filter((h) => h && h.includes("id="))
      )
    )
  );

  console.log(`상세페이지 링크 ${links.length}개 발견`);

  const results = [];

  for (const href of links) {
    const url = href.startsWith("http") ? href : `${BASE}${href}`;
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

      // 상품명: h1/h2/제목 영역에서 추출 (사이트 구조가 바뀔 수 있어 여러 후보 시도)
      let name = await page
        .locator("h1, h2, .product-name, .menu-name, .tit")
        .first()
        .innerText()
        .catch(() => null);

      if (!name) {
        name = await page.title();
      }
      name = sanitizeFileName(name || `donut-${Date.now()}`);

      // 대표 이미지: og:image 메타 태그 우선, 없으면 본문 내 큰 이미지 중 첫번째
      let imageUrl = await page
        .locator('meta[property="og:image"]')
        .first()
        .getAttribute("content")
        .catch(() => null);

      if (!imageUrl) {
        imageUrl = await page
          .locator("img")
          .first()
          .getAttribute("src")
          .catch(() => null);
      }

      if (!imageUrl) {
        console.warn(`이미지 없음, 건너뜀: ${name} (${url})`);
        continue;
      }
      if (!imageUrl.startsWith("http")) {
        imageUrl = new URL(imageUrl, BASE).toString();
      }

      const ext = path.extname(new URL(imageUrl).pathname) || ".jpg";
      let destPath = path.join(OUT_DIR, `${name}${ext}`);

      // 이름 중복 시 뒤에 번호 붙이기
      let counter = 2;
      while (fs.existsSync(destPath)) {
        destPath = path.join(OUT_DIR, `${name}_${counter}${ext}`);
        counter++;
      }

      await downloadImage(page, imageUrl, destPath);
      console.log(`저장 완료: ${destPath}`);
      results.push({ name, url, imageUrl, file: path.basename(destPath) });
    } catch (err) {
      console.error(`실패: ${url} -> ${err.message}`);
    }
  }

  fs.writeFileSync(
    path.join(OUT_DIR, "_index.json"),
    JSON.stringify(results, null, 2),
    "utf-8"
  );

  console.log(`총 ${results.length}개 이미지 저장 완료`);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
