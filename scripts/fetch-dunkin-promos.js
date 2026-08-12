const fs = require('fs');
const path = require('path');

const EVENT_URL = 'https://www.dunkindonuts.co.kr/event?flag=A';
const BASE_URL = 'https://www.dunkindonuts.co.kr';
const rootDir = path.join(__dirname, '..');
const collectionDir = path.join(rootDir, '_dunkin');

function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDateRange(text) {
  // 예: "2026. 08. 10 ~ 2026. 08. 12" 또는 "2022. 07. 10 ~" (종료일 없음)
  const match = text.match(/(\d{4})\.\s*(\d{2})\.\s*(\d{2})\s*~\s*(?:(\d{4})\.\s*(\d{2})\.\s*(\d{2}))?/);
  if (!match) return { raw: null, start: null, end: null };
  const [, sy, sm, sd, ey, em, ed] = match;
  return {
    raw: match[0].trim(),
    start: `${sy}-${sm}-${sd}`,
    end: ey ? `${ey}-${em}-${ed}` : null
  };
}

async function main() {
  let html;
  try {
    const res = await fetch(EVENT_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    html = await res.text();
  } catch (err) {
    console.log('던킨 페이지 요청 실패:', err.message);
    return;
  }

  const linkPattern = /<a[^>]+href="(\/event\/view\?id=(\d+))"[^>]*>([\s\S]*?)<\/a>/g;
  const found = [];
  let m;
  while ((m = linkPattern.exec(html)) !== null) {
    const [, href, id, inner] = m;
    const text = stripTags(inner);
    if (!text) continue;
    const { raw, start, end } = parseDateRange(text);
    const title = raw ? text.replace(raw, '').trim() : text;
    found.push({
      id,
      external_url: BASE_URL + href,
      title: title || text,
      period_raw: raw,
      period_start: start,
      period_end: end
    });
  }

  if (found.length === 0) {
    console.log('이벤트 목록을 찾지 못했어요. 사이트 구조가 바뀌었을 수 있어요.');
    return;
  }

  if (!fs.existsSync(collectionDir)) fs.mkdirSync(collectionDir, { recursive: true });

  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const postedAt = kstNow.toISOString().slice(0, 10);

  let createdCount = 0;

  found.forEach(promo => {
    const filePath = path.join(collectionDir, `${promo.id}.md`);
    if (fs.existsSync(filePath)) return; // 이미 게시된 프로모션은 건너뜀

    const frontMatter = {
      layout: 'dunkin-post',
      title: promo.title,
      event_id: promo.id,
      period_raw: promo.period_raw,
      period_start: promo.period_start,
      period_end: promo.period_end,
      external_url: promo.external_url,
      posted_at: postedAt
    };

    const content = `---\n${JSON.stringify(frontMatter, null, 2)}\n---\n`;
    fs.writeFileSync(filePath, content, 'utf8');
    createdCount++;
    console.log('새 프로모션 게시:', promo.title);
  });

  console.log(`총 ${found.length}개 조회, 새로 게시된 글 ${createdCount}개`);
}

main();
