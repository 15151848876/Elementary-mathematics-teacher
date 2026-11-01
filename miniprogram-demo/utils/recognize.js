/* 识别适配层 v0.6.1 —— 真实拍照识别（加固版）
 *
 * 小程序端只依赖这里的一个函数：recognize(filePath) -> Promise<{ source, questions }>
 * questions[i] = { no, stem, kind, params, confidence }
 *
 * v0.6.1 加固（针对真机拍照识别失败的排查与兜底）：
 *   1. 上传前先 wx.compressImage 压图——真实照片 3~8MB，base64 后超限会被网关/小程序拒绝
 *   2. normalizeQuestions 更宽容——数字字符串强转、kind 别名归一、
 *      expression 里「简单两整数±」自动转回竖式板（保证竖式题仍出竖式动画）
 *   3. 失败自动重试一次；错误信息按原因细分，结果页会显示具体原因便于定位
 *
 * 分工（v0.3 定下的架构不变）：
 *   云端多模态模型只做「识别」——看图、切题、判题型、抽数字；
 *   讲解步骤仍然由本地确定性引擎 planners.js 推导，模型不碰数学。
 *
 * 走 WorkBuddy 云服务的免密钥 LLM 通道：无需 API Key，
 * publishableKey 只标识应用，权限由服务端校验。
 */

var cloud = require('./cloud.js');
var MODEL_ID = 'glm-5.3-flash'; // 多模态视觉模型，可换成目录里其它 supportsImages 的模型

var KINDS = ['vertical_add', 'vertical_sub', 'vertical_mul', 'vertical_div', 'bar_more', 'bar_sumdiff', 'frac_add', 'numberline_add', 'numberline_sub', 'counter_add', 'geoboard_rect', 'balance_eq', 'chart_bar', 'expression', 'square_peri_area', 'rect_reverse', 'triangle_area', 'composite_area', 'circle_peri_area', 'parallelogram_area', 'trapezoid_area'];

var SYSTEM_PROMPT = [
  '你是小学数学试卷识别器。输入一张试卷照片，你要逐题识别，输出严格的 JSON。',
  '输出格式：{"questions":[{"no":题号(整数),"stem":"题干原文","kind":"题型代码","params":{},"confidence":0到100的整数}]}',
  '【竖式优先，务必最先判断】只要图中是一个数字竖着写、另一个数字写在它下面、用横线分隔、下面留空填答案的算式（两位数/三位数加减），一律判定为竖式，不要归到数轴、计数器或其它题型：',
  '1. vertical_add —— 竖式加法（数字上下排列 + 加号 + 横线 + 空答案位）。params: {"a":上面第一个数,"b":下面第二个数}',
  '2. vertical_sub —— 竖式减法（数字上下排列 + 减号 + 横线 + 空答案位）。params: {"a":上面被减数,"b":下面减数}',
  '其余题型代码与 params 也必须严格从下面选，认不出的题直接跳过，不要编造：',
  '3. bar_more —— "A 有 x 个，B 比 A 多/少 d 个，求两人一共"类应用题。params: {"a":A的数量,"d":多或少的数量,"unit":单位字}',
  '4. bar_sumdiff —— "两数之和是 S，相差 D，求两数"类和差应用题。params: {"S":和,"D":差,"unit":单位字}',
  '5. frac_add —— 异分母分数加法。params: {"a":分子1,"b":分母1,"c":分子2,"d":分母2}',
  '6. numberline_add —— 题目明确要求"在数轴上表示"且画有数轴箭头的加法。params: {"a":加数,"b":加数}',
  '7. numberline_sub —— 题目明确要求"在数轴上表示"且画有数轴箭头的减法。params: {"a":被减数,"b":减数}',
  '8. counter_add —— 图中有小棒捆/计数器珠子图的进位加法。params: {"a":第一个数,"b":第二个数}',
  '9. geoboard_rect —— 方格纸上求长方形周长/面积（r 行 c 列）。params: {"r":行数(宽),"c":列数(长)}',
  '10. balance_eq —— 天平表示的一步方程 x + a = c。params: {"a":已知加数,"b":未知数个数(通常1),"c":和}',
  '11. chart_bar —— 条形统计图（几个类别各有多少）。params: {"labels":["类别1","类别2",...],"values":[数值1,数值2,...]}',
  '12. vertical_mul —— 竖式乘法（数字上下排列 + × 号 + 横线）。params: {"a":被乘数,"b":乘数}',
  '13. vertical_div —— 竖式除法（数字上下排列 + ÷ 号）。params: {"a":被除数,"b":除数}',
  '14. expression —— 任意四则混合算式/脱式计算（含括号、分数、小数），如 "8×3+4"、"1/2+1/3"、"0.5×4"。params: {"expr":"完整算式字符串"}。竖式能判定的优先判定为竖式，其它普通算式都归这一类。',
  '15. square_peri_area —— 正方形，已知边长求周长和面积。params: {"s":边长}',
  '16. rect_reverse —— 长方形，已知周长和其中一条边，求另一条边。params: {"S":周长,"known":已知边,"unit":单位字(如"厘米")}',
  '17. triangle_area —— 三角形，已知底和高求面积。params: {"a":底,"h":高}',
  '18. composite_area —— 组合图形（可拆成两个长方形），求总面积。params: {"a":第一块的长,"b":第一块的宽,"c":第二块的长,"d":第二块的宽}',
  '19. circle_peri_area —— 圆，已知半径求周长和面积。params: {"r":半径}',
  '20. parallelogram_area —— 平行四边形，已知底和高求面积。params: {"a":底,"h":高}',
  '21. trapezoid_area —— 梯形，已知上底、下底、高求面积。params: {"a":上底,"b":下底,"h":高}',
  '【几何题判定规则，务必遵守】先仔细读题干，判断题目问的是「哪个量」，再决定 kind：',
  '- 问「周长/绕一圈多长」→ 属于求周长，选带 peri 的 kind（square_peri_area 或 circle_peri_area）；',
  '- 问「面积/多大/铺满」→ 属于求面积，选带 area 的 kind（triangle_area、parallelogram_area、trapezoid_area、composite_area、square_peri_area、circle_peri_area）；',
  '- 问「边长/另一条边/半径」→ 属于求边长，选 rect_reverse（已知周长反求一边）或 square_peri_area（已知面积反求边长）；',
  '- 严禁把「求边长」理解成「求周长」，严禁把「求周长」理解成「求面积」。题干里的「周长」「面积」「边长」三个词是判定的关键。',
  '要求：数字必须从图中如实识别，不得推测或修正；labels/values 长度一致；只输出 JSON，不要任何解释文字。'
].join('\n');

/* 读照片为 base64 data URL（先压图：真机照片太大是识别失败的首要嫌疑） */
function compressImage(filePath) {
  return new Promise(function (resolve) {
    if (!wx.compressImage) { resolve(filePath); return; }
    wx.compressImage({
      src: filePath,
      quality: 40,
      success: function (res) { resolve(res.tempFilePath); },
      fail: function () { resolve(filePath); } // 压缩失败就用原图
    });
  });
}

function readImage(filePath) {
  return new Promise(function (resolve, reject) {
    wx.getFileSystemManager().readFile({
      filePath: filePath,
      encoding: 'base64',
      success: function (res) { resolve('data:image/jpeg;base64,' + res.data); },
      fail: function () { reject(new Error('读照片失败，请重拍一张')); }
    });
  });
}

/* 剥掉模型可能加的 ```json 围栏 */
function stripFence(text) {
  var t = (text || '').trim();
  if (t.indexOf('```') === 0) {
    t = t.replace(/^```[a-zA-Z]*\s*/, '').replace(/```\s*$/, '');
  }
  return t.trim();
}

/* 「25+38」「60-24」这类简单两整数算式 → 竖式题型（模型归为 expression 时的兜底） */
var SIMPLE_EXPR = /^\s*(\d{1,4})\s*([+\-−×*xX÷/])\s*(\d{1,4})\s*$/;
function exprToVertical(expr) {
  var m = SIMPLE_EXPR.exec(String(expr || ''));
  if (!m) return null;
  var a = Number(m[1]), b = Number(m[3]), op = m[2];
  if (op === '+') return { kind: 'vertical_add', params: { a: a, b: b } };
  if (op === '-' || op === '−') return a >= b ? { kind: 'vertical_sub', params: { a: a, b: b } } : null;
  if (op === '×' || op === '*' || op === 'x' || op === 'X') return { kind: 'vertical_mul', params: { a: a, b: b } };
  if (op === '÷' || op === '/') return b !== 0 && a % b === 0 ? { kind: 'vertical_div', params: { a: a, b: b } } : null;
  return null;
}

/* kind 别名归一（模型偶尔输出变体写法） */
function normalizeKind(kind) {
  var k = String(kind || '').trim();
  if (KINDS.indexOf(k) >= 0) return k;
  var alias = {
    vertical: null, // 有 op 才能定，在 normalizeQuestions 里特判
    addition: 'vertical_add', add: 'vertical_add', plus: 'vertical_add',
    subtraction: 'vertical_sub', subtract: 'vertical_sub', minus: 'vertical_sub',
    multiplication: 'vertical_mul', mul: 'vertical_mul',
    division: 'vertical_div', div: 'vertical_div',
    expression_expr: 'expression', formula: 'expression', equation_expr: 'expression'
  };
  return alias[k] !== undefined ? alias[k] : null;
}

/* 校验并规范化模型输出，坏项直接丢弃；能救的救回来 */
function normalizeQuestions(raw) {
  var list = raw && raw.questions;
  if (!Array.isArray(list)) return null;
  var out = [];
  for (var i = 0; i < list.length; i++) {
    var q = list[i];
    if (!q || !q.params || typeof q.params !== 'object') continue;

    var kind = normalizeKind(q.kind);
    var params = q.params;

    // kind='vertical' 无方向：看 params 里有没有 op/expr 线索
    if (q.kind === 'vertical' && !kind) {
      if (params.op === '+') kind = 'vertical_add';
      else if (params.op === '-') kind = 'vertical_sub';
    }

    // expression：简单两整数±×÷直接转竖式（用户预期看到竖式板）
    if (kind === 'expression' && params.expr) {
      var v = exprToVertical(params.expr);
      if (v) { kind = v.kind; params = v.params; }
    }

    if (!kind || KINDS.indexOf(kind) < 0) continue;

    // 数字参数统一强转（模型偶尔返回字符串数字）
    var np = {};
    var numKeys = ['a', 'b', 'c', 'd', 'S', 'D', 'r'];
    for (var key in params) {
      if (numKeys.indexOf(key) >= 0) {
        var n = Number(params[key]);
        if (!isFinite(n)) { np = null; break; }
        np[key] = n;
      } else {
        np[key] = params[key];
      }
    }
    if (!np) continue;

    // 竖式加减必须 a>b（减法）或都是正整数
    if (kind === 'vertical_sub' && np.a <= np.b) continue;

    // chart 的 labels/values 校验
    if (kind === 'chart_bar') {
      if (!Array.isArray(np.labels) || !Array.isArray(np.values) || !np.labels.length || np.labels.length !== np.values.length) continue;
    }
    if (kind === 'expression' && !np.expr) continue;

    out.push({
      no: Number(q.no) || i + 1,
      stem: String(q.stem || ''),
      kind: kind,
      params: np,
      confidence: Math.max(0, Math.min(100, Number(q.confidence) || 0))
    });
  }
  return out;
}

/* 云端错误 → 用户能看懂的提示。完整错误细节进 console，页面上只给一句话 */
function friendlyError(err) {
  var code = (err && err.error && err.error.code) || '';
  var msg = (err && err.error && err.error.message) || '';
  console.error('[识别] 云模型调用失败', code, msg, (err && err.requestId) || '');
  if (code.indexOf('quota_') === 0) return new Error('云服务额度不足或被限流，请稍后再试');
  if (code.indexOf('auth_') === 0) return new Error('云服务校验未通过，请重新进入小程序再试');
  if (code.indexOf('gateway_') === 0 || code.indexOf('model_') === 0) {
    return new Error('识别服务暂时不可用，请再试一次');
  }
  return new Error('识别没成功，请重拍一张试试');
}

/* 单次云端识别：图片 → 多模态模型 → 题目 JSON（流式接口，一次性收满再解析） */
async function recognizeOnce(filePath) {
  var compressed = await compressImage(filePath);
  var dataUrl = await readImage(compressed);

  var answer = '';
  var stream = await cloud.llm.chat.completions.create({
    model: MODEL_ID,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: dataUrl } },
          { type: 'text', text: '识别这张试卷照片里的题目，按约定输出 JSON。' }
        ]
      }
    ],
    stream: true,
    response_format: { type: 'json_object' }
  });

  for await (var chunk of stream) {
    var delta = chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
    if (delta && delta.content) answer += delta.content;
  }

  console.log('[识别] 模型原始输出：', answer.slice(0, 300));

  var parsed;
  try { parsed = JSON.parse(stripFence(answer)); }
  catch (e) { throw new Error('识别结果解析失败，请重拍一张试试'); }

  var questions = normalizeQuestions(parsed);
  if (!questions) throw new Error('这张照片上没有认出可讲解的题目，请拍清楚一点');

  return { source: 'cloud', questions: questions };
}

/* 真实识别入口：失败自动重试一次（网络抖动/流中断等瞬态错误） */
async function recognizeCloud(filePath) {
  try {
    return await recognizeOnce(filePath);
  } catch (firstErr) {
    console.warn('[识别] 第一次尝试失败，重试一次：', firstErr && firstErr.message);
    try {
      return await recognizeOnce(filePath);
    } catch (err) {
      if (err && err.error && err.error.code) throw friendlyError(err);
      throw err;
    }
  }
}

/* ---------------- 对外入口 ---------------- */

function recognize(filePath) {
  // 有照片走云端识别；没有照片（开发者工具里的「示例数据」入口）继续走本地示例
  if (filePath) return recognizeCloud(filePath);

  return new Promise(function (resolve) {
    setTimeout(function () {
      resolve({ source: 'mock', questions: require('./mock-questions.js')() });
    }, 900);
  });
}

module.exports = {
  recognize: recognize,
  isMock: function () { return false; },
  MODEL_ID: MODEL_ID
};
