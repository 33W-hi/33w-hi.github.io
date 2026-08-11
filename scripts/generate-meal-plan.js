const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', '_data');
const configPath = path.join(dataDir, 'ingredients.json');
const outputPath = path.join(dataDir, 'current_week.json');

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

// KST(한국시간) 기준으로 계산. 이 스크립트는 일요일 09시(KST)에 실행되며,
// 그 다음날인 월요일부터 시작하는 한 주를 기준으로 라벨을 만든다.
const now = new Date();
const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
const nextMonday = new Date(kstNow);
nextMonday.setUTCDate(kstNow.getUTCDate() + 1);

const month = nextMonday.getUTCMonth() + 1;
const weekOfMonth = Math.ceil(nextMonday.getUTCDate() / 7);
const weekLabel = `${nextMonday.getUTCFullYear()}년 ${month}월 ${weekOfMonth}주차`;

const output = {
  generated_at_kst: kstNow.toISOString().replace('Z', '+09:00'),
  week_label: weekLabel,
  days
};

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
console.log('식단표 생성 완료:', weekLabel);
