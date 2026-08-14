const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const collectionDir = path.join(rootDir, '_area_events');

function pad(n) { return String(n).padStart(2, '0'); }

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function slugify(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-가-힣]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^\-+|\-+$/g, '');
}

function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchDayEvents(year, month, day) {
  const url = `https://www.sisul.or.kr/open_content/sub/schedule/detail.do?year=${year}&month=${pad(month)}&day=${pad(day)}&site_div=skydome`;
  let html;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    html = await res.text();
  } catch (err) {
    console.log(`요청 실패 (${year}-${pad(month)}-${pad(day)}):`, err.message);
    return [];
  }

  const text = stripTags(html);
  const events = [];
  // 형식: [YYYY.MM.DD ~ YYYY.MM.DD] 제목 ... 설명
  const pattern = /\[(\d{4})\.(\d{2})\.(\d{2})\s*~\s*(\d{4})\.(\d{2})\.(\d{2})\]\s*([^\[]+?)(?=\[\d{4}\.|담당부서|$)/g;
  let m;
  while ((m = pattern.exec(text)) !== null) {
    const start = `${m[1]}-${m[2]}-${m[3]}`;
    const end = `${m[4]}-${m[5]}-${m[6]}`;
    const rest = m[7].trim();
    // rest는 "제목 설명문구" 형태로 붙어있어서, 앞부분(제목)만 대략 사용
    const title = rest.split(/\s{2,}| {1,}(?=[가-힣A-Za-z0-9\[])/)[0] || rest.slice(0, 40);
    events.push({ start, end, title: title.trim() || rest.trim() });
  }
  return events;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);

  const monthsToCheck = [
    { year: kstNow.getUTCFullYear(), month: kstNow.getUTCMonth() + 1 },
  ];
  const nextMonthDate = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth() + 1, 1));
  monthsToCheck.push({ year: nextMonthDate.getUTCFullYear(), month: nextMonthDate.getUTCMonth() + 1 });

  const uniqueEvents = new Map();

  for (const { year, month } of monthsToCheck) {
    const total = daysInMonth(year, month);
    for (let day = 1; day <= total; day++) {
      const dayEvents = await fetchDayEvents(year, month, day);
      dayEvents.forEach(ev => {
        const key = `${ev.start}_${ev.end}_${ev.title}`;
        if (!uniqueEvents.has(key)) uniqueEvents.set(key, ev);
      });
      await sleep(250); // 서버에 부담 안 주게 살짝 대기
    }
  }

  if (!fs.existsSync(collectionDir)) fs.mkdirSync(collectionDir, { recursive: true });

  let createdCount = 0;
  const today = kstNow.toISOString().slice(0, 10);

  uniqueEvents.forEach(ev => {
    const slug = `${ev.start}-${slugify(ev.title) || 'event'}`;
    const filePath = path.join(collectionDir, `skydome-${slug}.md`);
    if (fs.existsSync(filePath)) return;

    const frontMatter = {
      title: ev.title,
      start: ev.start,
      end: ev.end,
      source: '고척스카이돔',
      note: null,
      fetched_at: today
    };

    const content = `---\n${JSON.stringify(frontMatter, null, 2)}\n---\n`;
    fs.writeFileSync(filePath, content, 'utf8');
    createdCount++;
    console.log('새 일정 게시:', ev.title, ev.start, '~', ev.end);
  });

  console.log(`총 ${uniqueEvents.size}개 조회, 새로 게시된 일정 ${createdCount}개`);
}

main();
