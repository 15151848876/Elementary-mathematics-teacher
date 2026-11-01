/* 本地示例数据 —— 开发者工具里点「示例数据」时使用，不联网 */
var UNIT_POOL = ['颗', '个', '本', '支', '元'];

function rnd(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pick(arr) {
  return arr[rnd(0, arr.length - 1)];
}

function mockQuestions() {
  var a = rnd(16, 89);
  var b = rnd(11, 79);
  if ((a % 10) + (b % 10) < 10) b = b + 2; // 保证至少一次进位，教学价值更高

  var m = rnd(8, 36);
  var d = rnd(2, 9);
  var unit = pick(UNIT_POOL);

  var den1 = rnd(2, 6);
  var den2 = rnd(2, 6);
  if (den1 === den2) den2 = den1 + 1;
  var num1 = rnd(1, den1 - 1);
  var num2 = rnd(1, den2 - 1);

  return [
    { no: 3, stem: a + ' + ' + b + ' = ?', kind: 'vertical_add', params: { a: a, b: b }, confidence: rnd(93, 99) },
    { no: 5, stem: '小明有 ' + m + ' ' + unit + '，小红比小明多 ' + d + ' ' + unit + '。两人一共有多少' + unit + '？', kind: 'bar_more', params: { a: m, d: d, unit: unit }, confidence: rnd(91, 98) },
    { no: 8, stem: num1 + '/' + den1 + ' + ' + num2 + '/' + den2 + ' = ?', kind: 'frac_add', params: { a: num1, b: den1, c: num2, d: den2 }, confidence: rnd(90, 97) }
  ];
}

module.exports = mockQuestions;
