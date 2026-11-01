/* 识别适配层 v0.4 —— 真实拍照识别
 *
 * 小程序端只依赖这里的一个函数：recognize(filePath) -> Promise<{ source, questions }>
 * questions[i] = { no, stem, kind, params, confidence }
 *
 * 分工（v0.3 定下的架构不变）：
 *   云端多模态模型只做「识别」——看图、切题、判题型、抽数字；
 *   讲解步骤仍然由本地确定性引擎 planners.js 推导，模型不碰数学。
 *   所以步骤正确率不依赖模型，模型只决定「认没认对题」。
 *
 * 走 WorkBuddy 云服务的免密钥 LLM 通道：无需 API Key，
 * publishableKey 只标识应用，权限由服务端校验。
 * 真机首次使用前，需在微信开发者工具里「构建 npm」一次。
 */

var cloud = require('./cloud.js');
var MODEL_ID = 'glm-5.3-flash'; // 多模态视觉模型，可换成目录里其它 supportsImages 的模型

var KINDS = ['vertical_add', 'vertical_sub', 'bar_more', 'bar_sumdiff', 'frac_add', 'numberline_add', 'numberline_sub', 'counter_add', 'geoboard_rect', 'balance_eq', 'chart_bar'];

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
  '要求：数字必须从图中如实识别，不得推测或修正；labels/values 长度一致；只输出 JSON，不要任何解释文字。'
].join('\n');

/* 读照片为 base64 data URL */
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

/* 校验并规范化模型输出，坏项直接丢弃 */
function normalizeQuestions(raw) {
  var list = raw && raw.questions;
  if (!Array.isArray(list)) return null;
  var out = [];
  for (var i = 0; i < list.length; i++) {
    var q = list[i];
    if (!q || KINDS.indexOf(q.kind) < 0) continue;
    if (!q.params || typeof q.params !== 'object') continue;
    out.push({
      no: Number(q.no) || i + 1,
      stem: String(q.stem || ''),
      kind: q.kind,
      params: q.params,
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

/* 真实识别：图片 → 多模态模型 → 题目 JSON（流式接口，一次性收满再解析） */
async function recognizeCloud(filePath) {
  var dataUrl = await readImage(filePath);

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

  var parsed;
  try { parsed = JSON.parse(stripFence(answer)); }
  catch (e) { throw new Error('识别结果解析失败，请重拍一张试试'); }

  var questions = normalizeQuestions(parsed);
  if (!questions) throw new Error('这张照片上没有认出可讲解的题目，请拍清楚一点');

  return { source: 'cloud', questions: questions };
}

/* ---------------- 对外入口 ---------------- */

function recognize(filePath) {
  // 有照片走云端识别；没有照片（开发者工具里的「示例数据」入口）继续走本地示例
  if (filePath) return recognizeCloud(filePath).catch(function (err) {
    // 云端失败时把友好信息抛回页面；页面统一显示并给出「重拍」按钮
    if (err && err.error && err.error.code) throw friendlyError(err);
    throw err;
  });

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
