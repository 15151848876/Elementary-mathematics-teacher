/* 通用表达式分步求值引擎（小程序版）
 *
 * 目标：把任意「加减乘除 + 括号 + 分数 + 小数」的算式，拆成「一步一算」的讲解序列。
 * 每一步输出一份完整快照 { expr, focus, result, note }，渲染层只做纯映射。
 *
 * 与 planners.js 的分工：
 *   planners.js 管「有专属板子的题型」（竖式、线段图、面积模型…）
 *   本引擎管「没有专属板子、但能按运算顺序分步脱式的算式」——即泛化的兜底。
 *
 * 安全：完全自写 tokenizer + 递归下降解析 + 分步求值，不用 eval，不碰任意字符串执行。
 *
 * 数值表示：内部用「分数」精确表示（分子/分母），避免浮点误差；
 *   整数/小数/分数统一归一为 {num, den}，输出时再转回人类可读字符串。
 */

/* ---------- 分数运算（精确，无浮点误差） ---------- */

function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { var t = a % b; a = b; b = t; }
  return a || 1;
}

function frac(n, d) {
  if (d < 0) { n = -n; d = -d; }
  var g = gcd(n, d);
  return { num: n / g, den: d / g };
}

function fadd(a, b) { return frac(a.num * b.den + b.num * a.den, a.den * b.den); }
function fsub(a, b) { return frac(a.num * b.den - b.num * a.den, a.den * b.den); }
function fmul(a, b) { return frac(a.num * b.num, a.den * b.den); }
function fdiv(a, b) { return frac(a.num * b.den, a.den * b.num); }

/* 分数 → 人类可读字符串。整数给整数；能除尽给小数；否则给带分数 */
function fmtFrac(f) {
  if (f.den === 1) return String(f.num);
  if (f.num % f.den === 0) return String(f.num / f.den);
  // 除得尽的小数（分母只含 2/5 因子，且位数不多）
  var d = f.den;
  var copy = d;
  while (copy % 2 === 0) copy /= 2;
  while (copy % 5 === 0) copy /= 5;
  if (copy === 1 && d <= 1000) {
    return String(f.num / f.den);
  }
  // 假分数 → 带分数
  var sign = f.num < 0 ? '-' : '';
  var n = Math.abs(f.num);
  if (n > f.den) {
    var whole = Math.floor(n / f.den);
    var rem = n % f.den;
    return sign + whole + '又' + rem + '/' + f.den;
  }
  return sign + n + '/' + f.den;
}

/* ---------- Tokenizer ---------- */

function tokenize(src) {
  var s = (src || '').replace(/\s+/g, '');
  var tokens = [];
  var i = 0;
  while (i < s.length) {
    var c = s[i];
    if ('+-*/×÷()'.indexOf(c) >= 0) {
      var op = c;
      if (c === '×') op = '*';
      if (c === '÷') op = '/';
      tokens.push({ type: 'op', val: op });
      i++;
    } else if (/[0-9.]/.test(c)) {
      var j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      var numStr = s.slice(i, j);
      // 支持「带分数」如 1又1/2 或 1 1/2：数字后紧跟「又」或空格+分数
      if (s[j] === '又') {
        var whole = Number(numStr);
        j++; // 跳过「又」
        var k = j;
        while (k < s.length && /[0-9]/.test(s[k])) k++;
        var n2 = s.slice(j, k);
        if (s[k] === '/') {
          k++;
          var m = k;
          while (m < s.length && /[0-9]/.test(s[m])) m++;
          var d2 = s.slice(k, m);
          tokens.push({ type: 'num', val: frac(whole * Number(d2) + Number(n2), Number(d2)) });
          i = m;
          continue;
        }
      }
      if (s[j] === '/' && /[0-9]/.test(s[j + 1] || '')) {
        // 真分数/假分数 如 1/2
        var num = Number(numStr);
        j++;
        var k2 = j;
        while (k2 < s.length && /[0-9]/.test(s[k2])) k2++;
        var den = s.slice(j, k2);
        tokens.push({ type: 'num', val: frac(num, Number(den)) });
        i = k2;
      } else {
        // 整数或小数
        var v = Number(numStr);
        if (numStr.indexOf('.') >= 0) {
          var parts = numStr.split('.');
          var dec = parts[1] || '';
          var dd = Math.pow(10, dec.length);
          tokens.push({ type: 'num', val: frac(Number(parts[0]) * dd + Number(dec || 0), dd) });
        } else {
          tokens.push({ type: 'num', val: frac(v, 1) });
        }
        i = j;
      }
    } else {
      // 非法字符：跳过（识别层已尽量给干净算式）
      i++;
    }
  }
  return tokens;
}

/* ---------- 递归下降解析 AST ---------- */

function Parser(tokens) {
  this.tokens = tokens;
  this.pos = 0;
}
Parser.prototype.peek = function () { return this.tokens[this.pos]; };
Parser.prototype.next = function () { return this.tokens[this.pos++]; };

Parser.prototype.parseExpr = function () {
  var left = this.parseTerm();
  while (this.peek() && this.peek().type === 'op' && (this.peek().val === '+' || this.peek().val === '-')) {
    var op = this.next().val;
    var right = this.parseTerm();
    left = { type: 'bin', op: op, left: left, right: right };
  }
  return left;
};
Parser.prototype.parseTerm = function () {
  var left = this.parseFactor();
  while (this.peek() && this.peek().type === 'op' && (this.peek().val === '*' || this.peek().val === '/')) {
    var op = this.next().val;
    var right = this.parseFactor();
    left = { type: 'bin', op: op, left: left, right: right };
  }
  return left;
};
Parser.prototype.parseFactor = function () {
  var t = this.peek();
  if (!t) throw new Error('算式不完整');
  if (t.type === 'num') { this.next(); return { type: 'num', val: t.val }; }
  if (t.type === 'op' && t.val === '(') {
    this.next();
    var e = this.parseExpr();
    if (!this.peek() || this.peek().val !== ')') throw new Error('括号不匹配');
    this.next();
    return e;
  }
  // 负号（一元）
  if (t.type === 'op' && t.val === '-') {
    this.next();
    var f = this.parseFactor();
    return { type: 'neg', child: f };
  }
  throw new Error('无法识别的算式');
};

/* ---------- AST → 字符串（用于展示当前算式） ---------- */

function nodeText(node) {
  if (node.type === 'num') return fmtFrac(node.val);
  if (node.type === 'neg') return '−' + nodeText(node.child);
  var L = nodeText(node.left);
  var R = nodeText(node.right);
  var needParen = node.type === 'bin' && (node.op === '*' || node.op === '/');
  var leftS = needParen && node.left.type === 'bin' && (node.left.op === '+' || node.left.op === '-') ? '(' + L + ')' : L;
  var rightS = needParen && node.right.type === 'bin' && (node.right.op === '+' || node.right.op === '-') ? '(' + R + ')' : R;
  var opc = node.op === '*' ? '×' : (node.op === '/' ? '÷' : node.op);
  return leftS + ' ' + opc + ' ' + rightS;
}

/* ---------- 分步求值：核心 ----------
 * 按运算优先级从内到外、从左到右，找到「下一个该算的运算」，算掉它，产出一份快照。
 * 递归折叠，直到整棵树收敛为一个数字。
 */

function findFirstStep(node) {
  // 返回「最优先被计算的那一步」：一个 {op, aVal, bVal, aText, bText} 描述
  if (node.type === 'num' || node.type === 'neg') return null;
  // bin：若左右子树里还有更该先算的，先深入；否则本节点这一步
  if (node.left.type === 'bin') {
    var l = findFirstStep(node.left);
    if (l) return l;
  }
  if (node.right.type === 'bin') {
    var r = findFirstStep(node.right);
    if (r) return r;
  }
  return {
    op: node.op,
    aVal: evalNode(node.left),
    bVal: evalNode(node.right),
    aText: nodeText(node.left),
    bText: nodeText(node.right)
  };
}

function evalNode(node) {
  if (node.type === 'num') return node.val;
  if (node.type === 'neg') return frac(-evalNode(node.child).num, evalNode(node.child).den);
  var a = evalNode(node.left), b = evalNode(node.right);
  if (node.op === '+') return fadd(a, b);
  if (node.op === '-') return fsub(a, b);
  if (node.op === '*') return fmul(a, b);
  if (node.op === '/') return fdiv(a, b);
  return a;
}

/* 把 AST 中「等于某个结构」的子树替换成数字 */
function fold(node, target, newVal) {
  if (node === target) return { type: 'num', val: newVal };
  if (node.type === 'num' || node.type === 'neg') return node;
  return {
    type: 'bin', op: node.op,
    left: fold(node.left, target, newVal),
    right: fold(node.right, target, newVal)
  };
}

function foldFirst(node) {
  // 返回 { newTree, step }
  if (node.type === 'num') return { newTree: node, step: null };
  if (node.type === 'neg') {
    var inner = foldFirst(node.child);
    return { newTree: { type: 'neg', child: inner.newTree }, step: inner.step };
  }
  // bin：先看左子树有没有可算的
  var l = foldFirst(node.left);
  if (l.step) return { newTree: { type: 'bin', op: node.op, left: l.newTree, right: node.right }, step: l.step };
  var r = foldFirst(node.right);
  if (r.step) return { newTree: { type: 'bin', op: node.op, left: node.left, right: r.newTree }, step: r.step };
  // 左右都算完了，本节点这一步
  var a = evalNode(node.left), b = evalNode(node.right);
  var res = node.op === '+' ? fadd(a, b) : node.op === '-' ? fsub(a, b) : node.op === '*' ? fmul(a, b) : fdiv(a, b);
  var step = {
    aText: nodeText(node.left),
    bText: nodeText(node.right),
    op: node.op,
    result: fmtFrac(res)
  };
  return { newTree: { type: 'num', val: res }, step: step };
}

/* ---------- 对外入口：expr → 步骤列表 ---------- */

function planExpression(expr) {
  var tokens = tokenize(expr);
  if (!tokens.length) return null;
  var parser = new Parser(tokens);
  var ast;
  try { ast = parser.parseExpr(); }
  catch (e) { return null; }
  if (parser.pos < tokens.length) return null; // 有残留 token，说明格式不对

  // 原式全文
  var fullText = nodeText(ast);

  // 逐步折叠，收集每一步快照
  var steps = [];
  var cur = ast;
  var guard = 0;
  while (cur.type !== 'num' && guard < 100) {
    guard++;
    var before = nodeText(cur);
    var out = foldFirst(cur);
    cur = out.newTree;
    if (!out.step) break;
    var opc = out.step.op === '*' ? '×' : (out.step.op === '/' ? '÷' : out.step.op);
    steps.push({
      title: '先算 ' + out.step.aText + ' ' + opc + ' ' + out.step.bText,
      text: '按照运算顺序，这一步先算 ' + out.step.aText + ' ' + opc + ' ' + out.step.bText + ' = ' + out.step.result + '。',
      snap: {
        kind: 'expression',
        expr: before,
        aText: out.step.aText,
        bText: out.step.bText,
        op: opc,
        result: out.step.result
      }
    });
  }

  if (!steps.length) return null;
  var answer = nodeText(cur);

  // 最后一步：亮出答案
  steps.push({
    title: '答案是 ' + answer,
    text: fullText + ' = ' + answer + '。',
    snap: {
      kind: 'expression',
      expr: fullText,
      aText: '',
      bText: '',
      op: '=',
      result: answer,
      final: true
    }
  });

  return {
    kind: 'expression',
    fullText: fullText,
    answer: answer,
    steps: steps
  };
}

module.exports = {
  planExpression: planExpression,
  tokenize: tokenize,
  fmtFrac: fmtFrac
};
