const fs = require('fs');
const path = require('path');

const LIST_URL = 'https://www.ppomppu.co.kr/zboard/zboard.php?id=phone';
const rootDir = path.join(__dirname, '..');
const collectionDir = path.join(rootDir, '_phonedeals');

// 딜/특가 관련이라고 판단할 키워드
const KEYWORDS = [
  '성지', '완납', '무약정', '핫딜', '특가', '폰테크', '공짜', '무료개통',
  '땡처리', '재고처리', '한정수량', '프로모션', '저렴', '초특가', '역대급'
];

function slugify(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-가-힣]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^\-+|\-+$/g, '');
}

async function main() {
  let buffer;
  try {
    const res = await fetch(LIST_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    buffer = await res.arrayBuffer();
  } catch (err) {
    console.log('뽐뿌 페이지 요청 실패:', err.message);
    return;
  }

  // 뽐뿌는 EUC-KR 인코딩을 사용함
  let html;
  try {
    html = new TextDecoder('euc-kr').decode(buffer);
  } catch (err) {
    console.log('EUC-KR 디코딩 실패, UTF-8로 재시도:', err.message);
    html = new TextDecoder('utf-8').decode(buffer);
  }

  const linkPattern = /<a[^>]+href="([^"]*view\.php\?id=phone[^"]*no=(\d+)[^"]*)"[^>]*>([^<]+)<\/a>/g;
  const found = [];
  const seenIds = new Set();
  let m;
  while ((m = linkPattern.exec(html)) !== null) {
    const [, href, id, titleRaw] = m;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const title = titleRaw.replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim();
    if (!title || title.length < 3) continue;

    const isDeal = KEYWORDS.some(kw => title.includes(kw));
    if (!isDeal) continue;

    const url = href.startsWith('http') ? href : `https://www.ppomppu.co.kr${href.startsWith('/') ? '' : '/'}${href}`;
    found.push({ id, title, url: url.replace(/&amp;/g, '&') });
  }

  if (found.length === 0) {
    console.log('오늘은 조건에 맞는 새 글이 없어요 (또는 페이지 구조가 바뀌었을 수 있어요).');
    return;
  }

  if (!fs.existsSync(collectionDir)) fs.mkdirSync(collectionDir, { recursive: true });

  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const postedAt = kstNow.toISOString().slice(0, 10);

  let createdCount = 0;

  found.forEach(deal => {
    const filePath = path.join(collectionDir, `ppomppu-${deal.id}.md`);
    if (fs.existsSync(filePath)) return;

    const frontMatter = {
      title: deal.title,
      external_url: deal.url,
      source: '뽐뿌 휴대폰포럼',
      posted_at: postedAt
    };

    const content = `---\n${JSON.stringify(frontMatter, null, 2)}\n---\n`;
    fs.writeFileSync(filePath, content, 'utf8');
    createdCount++;
    console.log('새 글 게시:', deal.title);
  });

  console.log(`딜 관련 후보 ${found.length}개 중 새로 게시된 글 ${createdCount}개`);
}

main();
