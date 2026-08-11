const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const configPath = path.join(rootDir, '_data', 'ingredients.json');
const collectionDir = path.join(rootDir, '_meal_plans');

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const ingredients = config.ingredients;
const fixed = config.fixed || {};

function pickCombo(count) {
  const shuffled = [...ingredients].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).join(' + ');
}

const DAY_META = [
  { key: 'mon', name: 'Mon', icon: '🌱', weekend: false },
  { key: 'tue', name: 'Tue', icon: '☀️', weekend: false },
  { key: 'wed', name: 'Wed', icon: '🌤️', weekend: false },
  { key: 'thu', name: 'Thu', icon: '🍜', weekend: false },
  { key: 'fri', name: 'Fri', icon: '🍗', weekend: false },
  { key: 'sat', name: 'Sat', icon: '🎤', weekend: true },
  { key: 'sun', name: 'Sun', icon: '⛪', weekend: true }
];

const days = DAY_META.map(d => {
  const lunch = fixed[`${d.key}_lunch`] || pickCombo(2);
  const dinner = fixed[`${d.key}_dinner`] || pickCombo(2);
  return { name: d.name, icon: d.icon, weekend: d.weekend, lunch, dinner };
});

// 이 스크립트는 일요일 09시(KST)에 실행되며, 그 다음날인 월요일부터
// 시작하는 새 한 주를 기준으로 게시물을 만든다.
const now = new Date();
const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
const nextMonday = new Date(kstNow);
nextMonday.setUTCDate(kstNow.getUTCDate() + 1);

const y = nextMonday.getUTCFullYear();
const m = String(nextMonday.getUTCMonth() + 1).padStart(2, '0');
const d = String(nextMonday.getUTCDate()).padStart(2, '0');
const weekStart = `${y}-${m}-${d}`;

const weekOfMonth = Math.ceil(nextMonday.getUTCDate() / 7);
const weekLabel = `${y}년 ${nextMonday.getUTCMonth() + 1}월 ${weekOfMonth}주차`;

if (!fs.existsSync(collectionDir)) {
  fs.mkdirSync(collectionDir, { recursive: true });
}

const filePath = path.join(collectionDir, `${weekStart}.md`);

if (fs.existsSync(filePath)) {
  console.log('이미 이번 주 식단이 있어요:', weekStart);
  process.exit(0);
}

const frontMatter = {
  layout: 'meal-plan',
  title: `${weekLabel} 식단`,
  week_start: weekStart,
  week_label: weekLabel,
  generated_at_kst: kstNow.toISOString().replace('Z', '+09:00'),
  days
};

// YAML은 JSON의 상위 집합이라, front matter를 JSON 그대로 써도 정상 동작한다.
const content = `---\n${JSON.stringify(frontMatter, null, 2)}\n---\n`;

fs.writeFileSync(filePath, content, 'utf8');
console.log('새 식단 게시물 생성:', weekLabel, '->', filePath);
