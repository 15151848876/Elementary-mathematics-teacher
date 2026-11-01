/* 本地示例数据 —— 开发者工具里点「示例数据」时使用，不联网 */
var UNIT_POOL = ['颗', '个', '本', '支', '元'];

function rnd(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pick(arr) {
  return arr[rnd(0, arr.length - 1)];
}

/* 竖式加法（保证至少一次进位） */
function qVerticalAdd() {
  var a = rnd(16, 89);
  var b = rnd(11, 79);
  if ((a % 10) + (b % 10) < 10) b = b + 2;
  return { no: 1, stem: a + ' + ' + b + ' = ?', kind: 'vertical_add', params: { a: a, b: b }, confidence: rnd(93, 99) };
}

/* 竖式减法（保证至少一次退位） */
function qVerticalSub() {
  var a = rnd(21, 99);
  var b = rnd(11, 89);
  if (a <= b) { var t = a; a = b; b = t; }
  if ((a % 10) >= (b % 10)) b = (b - (b % 10)) + ((a % 10) + rnd(1, 4)) % 10 + 1;
  if (b >= a) b = a - 1 - rnd(0, 9);
  if (b < 10) b = b + 10;
  return { no: 1, stem: a + ' − ' + b + ' = ?', kind: 'vertical_sub', params: { a: a, b: b }, confidence: rnd(93, 99) };
}

/* 多几少几 */
function qBarMore() {
  var m = rnd(8, 36);
  var d = rnd(2, 9);
  var unit = pick(UNIT_POOL);
  return { no: 2, stem: '小明有 ' + m + ' ' + unit + '，小红比小明多 ' + d + ' ' + unit + '。两人一共有多少' + unit + '？', kind: 'bar_more', params: { a: m, d: d, unit: unit }, confidence: rnd(91, 98) };
}

/* 异分母分数加法 */
function qFracAdd() {
  var den1 = rnd(2, 6);
  var den2 = rnd(2, 6);
  if (den1 === den2) den2 = den1 + 1;
  var num1 = rnd(1, den1 - 1);
  var num2 = rnd(1, den2 - 1);
  return { no: 3, stem: num1 + '/' + den1 + ' + ' + num2 + '/' + den2 + ' = ?', kind: 'frac_add', params: { a: num1, b: den1, c: num2, d: den2 }, confidence: rnd(90, 97) };
}

/* 数轴加法/减法 */
function qNumberLine() {
  var op = Math.random() < 0.5 ? '+' : '-';
  var a = op === '+' ? rnd(3, 15) : rnd(8, 20);
  var b = op === '+' ? rnd(2, 8) : rnd(2, Math.min(8, a - 1));
  return {
    no: 4,
    stem: '在数轴上表示：' + a + ' ' + op + ' ' + b + ' = ?',
    kind: op === '+' ? 'numberline_add' : 'numberline_sub',
    params: { a: a, b: b },
    confidence: rnd(90, 98)
  };
}

/* 小棒计数器进位加法 */
function qCounter() {
  var a = rnd(23, 48);
  var b = rnd(23, 48);
  if ((a % 10) + (b % 10) < 10) b = b + (10 - ((a % 10) + (b % 10)) % 10);
  if (b > 99) b = b - 10;
  return { no: 5, stem: '用小棒摆一摆：' + a + ' + ' + b + ' = ?', kind: 'counter_add', params: { a: a, b: b }, confidence: rnd(92, 98) };
}

/* 几何板：长方形周长/面积 */
function qGeoBoard() {
  var r = rnd(3, 5);
  var c = rnd(4, 6);
  return { no: 6, stem: '方格纸上的长方形，宽 ' + r + ' 格、长 ' + c + ' 格。它的周长和面积各是多少？', kind: 'geoboard_rect', params: { r: r, c: c }, confidence: rnd(90, 97) };
}

/* 天平方程 x + a = c */
function qBalance() {
  var a = rnd(2, 9);
  var x = rnd(3, 9);
  var c = a + x;
  return { no: 7, stem: '看图列方程：x + ' + a + ' = ' + c + '，x = ?', kind: 'balance_eq', params: { a: a, b: 1, c: c }, confidence: rnd(91, 98) };
}

/* 条形统计图 */
function qChart() {
  var labels = ['苹果', '香蕉', '橘子'];
  var values = [rnd(4, 12), rnd(4, 12), rnd(4, 12)];
  return { no: 8, stem: '统计水果数量：苹果 ' + values[0] + ' 个，香蕉 ' + values[1] + ' 个，橘子 ' + values[2] + ' 个。', kind: 'chart_bar', params: { labels: labels, values: values }, confidence: rnd(90, 97) };
}

/* 轮换：竖式必出（第 1 题固定），另从剩余七类里随机抽 2 题（保证新原语能随机出现，且竖式稳定可见） */
function mockQuestions() {
  // 第 1 题固定竖式（加法或减法交替，覆盖两种竖式）
  var first = Math.random() < 0.5 ? qVerticalAdd() : qVerticalSub();
  // 其余 7 类洗牌取 2
  var rest = [qBarMore, qFracAdd, qNumberLine, qCounter, qGeoBoard, qBalance, qChart];
  var idx = [0, 1, 2, 3, 4, 5, 6];
  for (var i = idx.length - 1; i > 0; i--) {
    var j = rnd(0, i);
    var t = idx[i]; idx[i] = idx[j]; idx[j] = t;
  }
  var picked = [first].concat(idx.slice(0, 2).map(function (k) { return rest[k](); }));
  return picked;
}

module.exports = mockQuestions;
