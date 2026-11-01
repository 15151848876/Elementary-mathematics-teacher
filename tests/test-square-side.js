/* 验证 square_side 修复：正方形周长40求边长 */
global.wx = {}; // Node 环境下 stub 小程序全局对象（cloud.js 诊断层需要）
var P = require('../miniprogram-demo/utils/planners.js');
var R = require('../miniprogram-demo/utils/recognize.js');

// 1) 模型正确输出 square_side
var q1 = P.build({ kind: 'square_side', params: { S: 40, by: 'peri', unit: '厘米' } });
console.log('square_side peri:', q1 ? q1.answer + '，' + q1.steps.length + ' 步' : 'FAIL(null)');

// 2) 已知面积反求边长
var q2 = P.build({ kind: 'square_side', params: { S: 36, by: 'area' } });
console.log('square_side area:', q2 ? q2.answer + '，' + q2.steps.length + ' 步' : 'FAIL(null)');

// 3) 模型仍错误输出 rect_reverse 且缺 known —— 应被 normalize 丢弃
var norm = R._normalizeForTest || null;
// recognize.js 未导出 normalize，直接验证 build 层防御
var q3 = P.build({ kind: 'rect_reverse', params: { S: 40 } });
console.log('rect_reverse 缺 known:', q3 === null ? '已拦截(返回null)' : 'FAIL(仍生成)');

// 4) 快照字段无 null 泄漏
if (q1) {
  var bad = [];
  q1.steps.forEach(function (s, i) {
    var txt = s.title + s.text + (s.snap && s.snap.eq || '');
    if (txt.indexOf('null') >= 0 || txt.indexOf('undefined') >= 0) bad.push(i);
  });
  console.log('null/undefined 泄漏检查:', bad.length ? 'FAIL 步骤' + bad : '通过');
}
