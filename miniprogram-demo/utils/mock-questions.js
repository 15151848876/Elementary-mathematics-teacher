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

/* 正方形周长面积 */
function qSquare() {
  var s = rnd(4, 12);
  return { no: 9, stem: '一个正方形的边长是 ' + s + ' 厘米，它的周长和面积各是多少？', kind: 'square_peri_area', params: { s: s }, confidence: rnd(91, 98) };
}

/* 长方形反求边长 */
function qRectReverse() {
  var other = rnd(4, 12);
  var known = rnd(4, 12);
  var S = 2 * (other + known);
  return { no: 10, stem: '一个长方形的周长是 ' + S + ' 厘米，其中一条边是 ' + known + ' 厘米，另一条边是多少厘米？', kind: 'rect_reverse', params: { S: S, known: known, unit: '厘米' }, confidence: rnd(91, 98) };
}

/* 三角形面积 */
function qTriangle() {
  var a = rnd(4, 10);
  var h = rnd(3, 8);
  return { no: 11, stem: '一个三角形的底是 ' + a + ' 厘米，高是 ' + h + ' 厘米，它的面积是多少？', kind: 'triangle_area', params: { a: a, h: h }, confidence: rnd(91, 98) };
}

/* 组合图形面积 */
function qComposite() {
  var a = rnd(3, 6), b = rnd(3, 6), c = rnd(3, 6), d = rnd(3, 6);
  return { no: 12, stem: '一个 L 形组合图形，可以分成 ' + a + '×' + b + ' 和 ' + c + '×' + d + ' 两个长方形，求总面积。', kind: 'composite_area', params: { a: a, b: b, c: c, d: d }, confidence: rnd(91, 98) };
}

/* 圆的周长面积 */
function qCircle() {
  var r = rnd(2, 8);
  return { no: 13, stem: '一个圆的半径是 ' + r + ' 厘米，它的周长和面积各是多少？（π 取 3.14）', kind: 'circle_peri_area', params: { r: r }, confidence: rnd(91, 98) };
}

/* 平行四边形面积 */
function qParallelogram() {
  var a = rnd(4, 12);
  var h = rnd(3, 9);
  return { no: 14, stem: '一个平行四边形的底是 ' + a + ' 厘米，高是 ' + h + ' 厘米，它的面积是多少？', kind: 'parallelogram_area', params: { a: a, h: h }, confidence: rnd(91, 98) };
}

/* 梯形面积 */
function qTrapezoid() {
  var a = rnd(3, 8), b = rnd(a + 1, 12), h = rnd(3, 9);
  return { no: 15, stem: '一个梯形的上底是 ' + a + ' 厘米，下底是 ' + b + ' 厘米，高是 ' + h + ' 厘米，它的面积是多少？', kind: 'trapezoid_area', params: { a: a, b: b, h: h }, confidence: rnd(91, 98) };
}

/* 轮换：竖式必出（第 1 题固定），另从剩余七类里随机抽 2 题（保证新原语能随机出现，且竖式稳定可见） */
/* 竖式乘法 */
function qVerticalMul() {
  var a = rnd(12, 98);
  var b = rnd(3, 9);
  return { no: 2, stem: a + ' × ' + b + ' = ?', kind: 'vertical_mul', params: { a: a, b: b }, confidence: rnd(92, 98) };
}

/* 竖式除法 */
function qVerticalDiv() {
  var b = rnd(3, 9);
  var q = rnd(10, 40);
  var a = b * q;
  return { no: 3, stem: a + ' ÷ ' + b + ' = ?', kind: 'vertical_div', params: { a: a, b: b }, confidence: rnd(92, 98) };
}

/* 综合运算（脱式计算） */
function qExpression() {
  var exps = [
    { e: '8×3+4', ans: '28' },
    { e: '(8+6)×3', ans: '42' },
    { e: '2+3×4', ans: '14' },
    { e: '1/2+1/3', ans: '5/6' },
    { e: '0.5+0.25', ans: '0.75' },
    { e: '100-25÷5', ans: '95' },
    { e: '7×(2+3)', ans: '35' },
    { e: '36÷(4+5)', ans: '4' }
  ];
  var p = pick(exps);
  return { no: 4, stem: p.e + ' = ?', kind: 'expression', params: { expr: p.e }, confidence: rnd(90, 97) };
}

function mockQuestions() {
  // 第 1 题固定竖式（加法或减法交替，覆盖两种竖式）
  var first = Math.random() < 0.5 ? qVerticalAdd() : qVerticalSub();
  // 第 2 题固定一个「乘除/综合运算」类（保证新引擎可见）
  var calc = pick([qVerticalMul, qVerticalDiv, qExpression]);
  // 第 3 题：几何类优先（本轮目标），从几何题库随机抽；其余类作为补充池
  var geo = [qGeoBoard, qSquare, qRectReverse, qTriangle, qComposite, qCircle, qParallelogram, qTrapezoid];
  var rest = [qBarMore, qFracAdd, qNumberLine, qCounter, qBalance, qChart];
  var third;
  if (Math.random() < 0.6) {
    third = pick(geo)();
  } else {
    third = pick(rest)();
  }
  var picked = [first, calc(), third];
  return picked;
}

module.exports = mockQuestions;
