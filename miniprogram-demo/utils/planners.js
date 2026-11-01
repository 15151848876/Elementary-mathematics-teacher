/* 确定性数学引擎（小程序版）
 * 与 renderer.html / barmodel.html / areamodel.html 同一套算法，
 * 输出「每步一份完整快照」，渲染层只做纯映射，因此可任意跳步、回退。
 */

var POS = ['个位', '十位', '百位', '千位', '万位'];

function posName(i) { return POS[i] || ('第' + (i + 1) + '位'); }

function rtlNum(n) {
  return String(n).split('').reverse().map(function (c) { return Number(c); });
}

function gcd(x, y) {
  x = Math.abs(x); y = Math.abs(y);
  while (y) { var t = x % y; x = y; y = t; }
  return x || 1;
}

/* 把字符串右对齐铺到 cols 列里，指定列高亮 */
function cells(str, cols, hiCol, cls) {
  var arr = new Array(cols);
  for (var i = 0; i < cols; i++) arr[i] = '';
  var s = String(str);
  var start = cols - s.length;
  for (var j = 0; j < s.length; j++) arr[start + j] = s[j];
  return arr.map(function (ch, idx) {
    var fromRight = cols - 1 - idx;
    var c = '';
    if (hiCol !== null && hiCol !== undefined && fromRight === hiCol) c = cls || 'hi';
    return { i: idx, ch: ch, cls: c };
  });
}

/* 从「左到右的值数组」铺成单元格（支持 '12' 这种借位后的两位数） */
function cellsFromArr(vals, cols, hiCol, cls) {
  var arr = new Array(cols);
  for (var i = 0; i < cols; i++) arr[i] = '';
  var off = cols - vals.length;
  for (var j = 0; j < vals.length; j++) arr[off + j] = vals[j];
  return arr.map(function (ch, idx) {
    var fromRight = cols - 1 - idx;
    var c = '';
    if (hiCol !== null && hiCol !== undefined && fromRight === hiCol) c = cls || 'hi';
    if (ch !== '' && ch.length > 1) c = (c ? c + ' ' : '') + 'wide';
    return { i: idx, ch: ch, cls: c };
  });
}

function carryCells(arr) {
  return arr.map(function (ch, idx) {
    return { i: idx, ch: ch, cls: ch ? 'carry' : '' };
  });
}

function colLabels(cols) {
  var out = [];
  for (var i = cols - 1; i >= 0; i--) out.push(posName(i));
  return out;
}

/* ============================ 竖式：加法 ============================ */

function planAdd(a, b) {
  var n = Math.max(String(a).length, String(b).length);
  var sum = a + b;
  var cols = Math.max(n, String(sum).length);
  var A = rtlNum(a), B = rtlNum(b);
  var carryRow = new Array(cols);
  for (var c0 = 0; c0 < cols; c0++) carryRow[c0] = '';
  var resStr = '';
  var steps = [];
  var asked = false;
  var carry = 0;

  steps.push({
    title: '先把数位对齐',
    text: a + ' 和 ' + b + ' 上下对齐：个位对个位，十位对十位。相同数位上的数才能直接相加。',
    snap: vertSnap('+', cols, cells(a, cols), cells(b, cols), carryCells(carryRow), cells('', cols))
  });

  for (var i = 0; i < n; i++) {
    var da = i < A.length ? A[i] : null;
    var db = i < B.length ? B[i] : null;
    var x = da === null ? 0 : da;
    var y = db === null ? 0 : db;
    var s = x + y + carry;
    var out = s % 10;
    var next = s >= 10 ? 1 : 0;
    var terms = [];
    if (da !== null) terms.push(da);
    if (db !== null) terms.push(db);
    if (carry) terms.push(carry);

    if (next && !asked) {
      asked = true;
      steps.push({
        title: '满十了，向' + posName(i + 1) + '进几？',
        text: '先自己想一想，再选答案。',
        ask: {
          question: terms.join(' + ') + ' = ' + s + '，满十了。要向' + posName(i + 1) + '进几？',
          options: ['进 1', '进 2', '不用进'],
          answer: 0,
          hint: s + ' 里面有 ' + Math.floor(s / 10) + ' 个十和 ' + (s % 10) + ' 个一。把这 1 个十送到' + posName(i + 1) + '，' + posName(i) + '只留 ' + out + '。'
        },
        snap: vertSnap('+', cols, cells(a, cols), cells(b, cols), carryCells(carryRow), cells(resStr, cols))
      });
    }

    if (next) carryRow[cols - 1 - (i + 1)] = '1';
    resStr = String(out) + resStr;

    var say = posName(i) + '：' + terms.join(' + ') + ' = ' + s;
    if (next) say += '。写 ' + out + '，向' + posName(i + 1) + '进 1';

    steps.push({
      title: posName(i) + '算 ' + terms.join(' + '),
      text: say + '。',
      snap: vertSnap('+', cols, cells(a, cols, i, 'hl-a'), cells(b, cols, i, 'hl-a'), carryCells(carryRow), cells(resStr, cols, i, 'new'))
    });

    carry = next;
  }

  if (carry) {
    resStr = '1' + resStr;
    steps.push({
      title: '最高位还剩一个进位',
      text: '最高位还剩下一个进位的 1，直接写在最前面。',
      snap: vertSnap('+', cols, cells(a, cols, n, 'hl-a'), cells(b, cols, n, 'hl-a'), carryCells(carryRow), cells(resStr, cols, n, 'new'))
    });
  }

  steps.push({
    title: '答案是 ' + sum,
    text: a + ' + ' + b + ' = ' + sum + '。算完估一估：' + Math.round(a / 10) * 10 + ' + ' + Math.round(b / 10) * 10 + ' 大概是多少，对得上就放心了。',
    snap: vertSnap('+', cols, cells(a, cols), cells(b, cols), carryCells(carryRow), cells(resStr, cols))
  });

  return { kind: 'vertical', answer: String(sum), steps: steps };
}

/* ============================ 竖式：减法 ============================ */

function planSub(a, b) {
  if (a < b) return null;
  var n = Math.max(String(a).length, String(b).length);
  var cols = n;
  var A = rtlNum(a), B = rtlNum(b);
  var work = [];
  for (var w = 0; w < cols; w++) work.push(w < A.length ? A[w] : 0);
  var carryRow = new Array(cols);
  for (var c0 = 0; c0 < cols; c0++) carryRow[c0] = '';
  // 结果按列存储：显示时再裁前导零。不能在拼装中裁，否则会吃掉合法的中间位 0（2909 变 299）。
  var resArr = new Array(cols);
  for (var r0 = 0; r0 < cols; r0++) resArr[r0] = '';
  var steps = [];
  var asked = false;

  function resText() {
    var s = resArr.join('');
    return s.replace(/^0+(?=\d)/, '');
  }

  function workVals() {
    var vals = [];
    for (var k = cols - 1; k >= 0; k--) vals.push(String(work[k]));
    return vals;
  }

  steps.push({
    title: '先把数位对齐',
    text: a + ' 和 ' + b + ' 上下对齐：个位对个位，十位对十位。',
    snap: vertSnap('−', cols, cellsFromArr(workVals(), cols), cells(b, cols), carryCells(carryRow), cells('', cols))
  });

  for (var i = 0; i < n; i++) {
    var db = i < B.length ? B[i] : null;
    var y = db === null ? 0 : db;
    var before = work[i];
    var borrowed = false;
    var fromCol = -1;

    if (before < y) {
      var j = i + 1;
      while (j < n && work[j] === 0) j++;
      if (j < n) {
        work[j] -= 1;
        for (var k = i + 1; k < j; k++) work[k] = 9;
        fromCol = j;
      }
      work[i] += 10;
      borrowed = true;
    }

    if (borrowed && !asked && fromCol >= 0) {
      asked = true;
      steps.push({
        title: '不够减，向' + posName(fromCol) + '借 1',
        text: '先自己想一想，再选答案。',
        ask: {
          question: posName(i) + '上 ' + before + ' 不够减 ' + y + '，向' + posName(fromCol) + '借 1。这个 1 到了' + posName(i) + '上算几？',
          options: ['算 10', '算 1', '算 5'],
          answer: 0,
          hint: '借来的 1 个十，到了' + posName(i) + '上就是 10 个一。所以这一位从 ' + before + ' 变成 ' + (before + 10) + '。'
        },
        snap: vertSnap('−', cols, cellsFromArr(workVals(), cols), cells(b, cols), carryCells(carryRow), cells(resText(), cols))
      });
    }

    var out = work[i] - y;
    resArr[cols - 1 - i] = String(out);

    var say;
    if (borrowed && fromCol >= 0) {
      say = posName(i) + '上 ' + before + ' 不够减 ' + y + '，向' + posName(fromCol) + '借 1 当 10：' + work[i] + ' − ' + y + ' = ' + out + '。' + posName(fromCol) + '退掉 1，变成 ' + work[fromCol] + '。';
    } else {
      say = posName(i) + '：' + before + ' − ' + y + ' = ' + out + '。';
    }

    steps.push({
      title: posName(i) + '算 ' + before + ' − ' + y,
      text: say,
      snap: vertSnap('−', cols, cellsFromArr(workVals(), cols, i, 'brw'), cells(b, cols, i, 'hl-a'), carryCells(carryRow), cells(resText(), cols, i, 'new'))
    });
  }

  var total = a - b;
  steps.push({
    title: '答案是 ' + total,
    text: a + ' − ' + b + ' = ' + total + '。可以用加法倒着检查：' + total + ' + ' + b + ' = ' + a + '。',
    snap: vertSnap('−', cols, cellsFromArr(workVals(), cols), cells(b, cols), carryCells(carryRow), cells(resText(), cols))
  });

  return { kind: 'vertical', answer: String(total), steps: steps };
}

function vertSnap(op, cols, aCells, bCells, carry, resCells) {
  return {
    kind: 'vertical',
    op: op,
    colLabels: colLabels(cols),
    aCells: aCells,
    bCells: bCells,
    carryCells: carry,
    resCells: resCells
  };
}

/* ============================ 线段图 ============================ */

function barSnap(maxU, rows, braces, eq) {
  return {
    kind: 'bar',
    rows: rows.map(function (r, ri) {
      return {
        i: ri,
        label: r.label,
        value: r.value === undefined || r.value === null || r.value === '' ? '' : String(r.value),
        segs: r.segs.map(function (s, si) {
          return {
            i: si,
            pct: (s.n / maxU) * 100,
            text: s.text || '',
            cls: s.cls
          };
        })
      };
    }),
    braces: (braces || []).map(function (b, bi) {
      return {
        i: bi,
        leftPct: (b.from / maxU) * 100,
        widthPct: ((b.to - b.from) / maxU) * 100,
        text: b.text
      };
    }),
    eq: eq || ''
  };
}

/* 多几少几 */
function planBarMore(a, d, unit) {
  var b = a + d;
  var total = a + b;
  var maxU = a + b;
  var steps = [];
  var r0 = { label: '小明', value: '', segs: [{ n: a, text: '已知', cls: 'a' }] };
  var r1 = { label: '小红', value: '', segs: [] };
  var r2 = { label: '一共', value: '', segs: [] };

  steps.push({
    title: '先画小明',
    text: '小明有 ' + a + ' ' + unit + '，就用一条线段表示。线段有多长，就代表有多少 ' + unit + '。',
    snap: barSnap(maxU, [{ label: '小明', value: a, segs: r0.segs }])
  });

  steps.push({
    title: '画一样多的部分',
    text: '小红比小明多，说明她至少有和小明一样多的那一段。先照着画一段一样长的。',
    snap: barSnap(maxU, [
      { label: '小明', value: a, segs: r0.segs },
      { label: '小红', value: '', segs: [{ n: a, text: '', cls: 'a' }] }
    ])
  });

  steps.push({
    title: '接上多出的 ' + d,
    text: '“多 ' + d + '”就在后面再接一小段。所以小红的整条线段 = ' + a + ' + ' + d + '。',
    snap: barSnap(maxU, [
      { label: '小明', value: a, segs: r0.segs },
      { label: '小红', value: '', segs: [{ n: a, text: '', cls: 'a' }, { n: d, text: '+' + d, cls: 'd' }] }
    ], [{ from: a, to: a + d, text: '多 ' + d }])
  });

  steps.push({
    title: '看图算一算',
    text: '先自己看图，再选择答案。',
    ask: {
      question: '看图想一想：小红一共有多少 ' + unit + '？',
      options: [b + ' ' + unit, a + ' ' + unit, d + ' ' + unit],
      answer: 0,
      hint: '小红 = 和小明一样多的 ' + a + ' ' + unit + ' + 多出来的 ' + d + ' ' + unit + ' = ' + b + ' ' + unit + '。'
    },
    snap: barSnap(maxU, [
      { label: '小明', value: a, segs: r0.segs },
      { label: '小红', value: '', segs: [{ n: a, text: '', cls: 'a' }, { n: d, text: '+' + d, cls: 'd' }] }
    ], [{ from: a, to: a + d, text: '多 ' + d }])
  });

  steps.push({
    title: '小红有 ' + b + ' ' + unit,
    text: b + ' 这一段是“比”出来的，题目里并没有直接告诉你。',
    snap: barSnap(maxU, [
      { label: '小明', value: a, segs: r0.segs },
      { label: '小红', value: b, segs: [{ n: a, text: '', cls: 'a' }, { n: d, text: '+' + d, cls: 'd' }] }
    ], [{ from: a, to: a + d, text: '多 ' + d }])
  });

  steps.push({
    title: '合起来求总数',
    text: '题目问的是一共。把两条线段接起来，合起来就是总数。',
    snap: barSnap(maxU, [
      { label: '小明', value: a, segs: r0.segs },
      { label: '小红', value: b, segs: [{ n: a, text: '', cls: 'a' }, { n: d, text: '+' + d, cls: 'd' }] },
      { label: '一共', value: '', segs: [{ n: a, text: '', cls: 'a' }, { n: b, text: '', cls: 'b' }] }
    ], [{ from: 0, to: maxU, text: '一共 ？' }])
  });

  steps.push({
    title: '答案是 ' + total + ' ' + unit,
    text: a + ' + ' + b + ' = ' + total + '（' + unit + '）。线段图的好处：谁多谁少、一共多少，一眼看清，不用猜。',
    snap: barSnap(maxU, [
      { label: '小明', value: a, segs: r0.segs },
      { label: '小红', value: b, segs: [{ n: a, text: '', cls: 'a' }, { n: d, text: '+' + d, cls: 'd' }] },
      { label: '一共', value: total, segs: [{ n: a, text: '', cls: 'a' }, { n: b, text: '', cls: 'b' }] }
    ], [{ from: 0, to: maxU, text: '一共 ' + total + ' ' + unit }], a + ' + ' + b + ' = ' + total + '（' + unit + '）')
  });

  return { kind: 'bar', answer: String(total), steps: steps };
}

/* 和差问题 */
function planBarSumDiff(S, D, unit) {
  if ((S - D) % 2 !== 0) return null;
  var small = (S - D) / 2;
  var big = (S + D) / 2;
  if (small <= 0) return null;
  var maxU = S + D;
  var base = [
    { label: '小数', value: small, segs: [{ n: small, text: '小数', cls: 'a' }] }
  ];
  var r1 = { label: '大数', value: '', segs: [{ n: small, text: '', cls: 'a' }, { n: D, text: '+' + D, cls: 'd' }] };
  var r2 = { label: '和', value: '', segs: [{ n: small, text: '', cls: 'a' }, { n: big, text: '', cls: 'b' }] };
  var r3 = { label: '补上差', value: '', segs: [{ n: small, text: '', cls: 'a' }, { n: big, text: '', cls: 'b' }, { n: D, text: '+' + D, cls: 'd' }] };
  var steps = [];

  steps.push({
    title: '先画小数',
    text: '和是 ' + S + '，差是 ' + D + '。两条线段，长的叫大数，短的叫小数。先把短的那条画出来。',
    snap: barSnap(maxU, base)
  });

  steps.push({
    title: '大数比小数长',
    text: '大数比小数多，所以起点对齐、画得更长。长出来的那一段，就是差。',
    snap: barSnap(maxU, base.concat([{ label: '大数', value: '', segs: [{ n: small, text: '', cls: 'a' }] }]))
  });

  steps.push({
    title: '长出来的就是差',
    text: '多出来这一段 = ' + D + '，这就是“差”。注意：差不是两个数，是一段长度。',
    snap: barSnap(maxU, base.concat([{ label: '大数', value: '', segs: r1.segs }]), [{ from: small, to: small + D, text: '差 ' + D }])
  });

  steps.push({
    title: '把两条接起来就是和',
    text: '把小数和大数接起来，长度就是“和” = ' + S + '。',
    snap: barSnap(maxU, base.concat([{ label: '大数', value: '', segs: r1.segs }, { label: '和', value: S, segs: r2.segs }]), [{ from: 0, to: S, text: '和 ' + S }])
  });

  steps.push({
    title: '关键一想',
    text: '先自己想一想，再选择答案。',
    ask: {
      question: '给小数也补上差那一段，两条就一样长了。这时合起来是多少？',
      options: [String(S + D), String(S), String(S - D)],
      answer: 0,
      hint: '补上 ' + D + ' 之后，两条都变成“大数”。原来的和 ' + S + ' 再加 ' + D + '，正好是 2 个大数。'
    },
    snap: barSnap(maxU, base.concat([{ label: '大数', value: '', segs: r1.segs }, { label: '和', value: S, segs: r2.segs }]), [{ from: 0, to: S, text: '和 ' + S }])
  });

  steps.push({
    title: '补上差，得到两个大数',
    text: '补上这 ' + D + '：' + S + ' + ' + D + ' = ' + (S + D) + '。这条正好是两个大数拼起来。',
    snap: barSnap(maxU, base.concat([
      { label: '大数', value: '', segs: r1.segs },
      { label: '和', value: S, segs: r2.segs },
      { label: '补上差', value: '', segs: r3.segs }
    ]), [{ from: 0, to: S, text: '和 ' + S }, { from: 0, to: S + D, text: '两个大数' }])
  });

  steps.push({
    title: '大数 = ' + big,
    text: '所以 大数 =（和 + 差）÷ 2 =（' + S + ' + ' + D + '）÷ 2 = ' + big + '。除以 2，是因为现在有两个大数。',
    snap: barSnap(maxU, base.concat([
      { label: '大数', value: big, segs: r1.segs },
      { label: '和', value: S, segs: r2.segs },
      { label: '补上差', value: S + D, segs: r3.segs }
    ]), [{ from: 0, to: S + D, text: '两个大数' }], '大数 = (' + S + ' + ' + D + ') ÷ 2 = ' + big)
  });

  steps.push({
    title: '小数 = ' + small,
    text: '大数是 ' + big + '。小数 = ' + big + ' − ' + D + ' = ' + small + '，也可以直接用 ' + S + ' − ' + big + ' 得到。',
    snap: barSnap(maxU, [
      { label: '小数', value: small, segs: [{ n: small, text: '小数', cls: 'a' }] },
      { label: '大数', value: big, segs: r1.segs },
      { label: '和', value: S, segs: r2.segs },
      { label: '补上差', value: S + D, segs: r3.segs }
    ], [], '小数 = ' + big + ' − ' + D + ' = ' + small)
  });

  return { kind: 'bar', answer: '大数 ' + big + '，小数 ' + small, steps: steps };
}

/* ============================ 面积模型：分数加法 ============================ */

function planFracAdd(a, b, c, d) {
  var den = b * d / gcd(b, d);
  var ca = a * den / b;
  var cb = c * den / d;
  var num = ca + cb;
  var g = gcd(num, den);
  var ansN = num / g;
  var ansD = den / g;
  var ansTxt = ansD === 1 ? String(ansN) : ansN + '/' + ansD;

  // 结果可能超过 1（假分数），此时需要铺开多行整块，否则格子不够涂
  var rows = Math.ceil(num / den) || 1;
  var totalCells = den * rows;
  // 分母很大时（如 8 和 9 → 72 格）一行会挤成细条，改成每行最多 12 格自动换行
  var perRow = Math.min(den, 12);
  var cellW = 100 / perRow;

  function cellsOf(fillA, fillB) {
    var out = [];
    for (var i = 0; i < totalCells; i++) {
      var cls = '';
      if (i < fillA) cls = 'a';
      else if (i < fillA + fillB) cls = 'b';
      out.push({ i: i, cls: cls });
    }
    return out;
  }

  var steps = [];
  var sameDen = (b === d);

  steps.push({
    title: sameDen ? '分母相同，可以直接算' : '分母不一样，不能直接加',
    text: sameDen
      ? a + '/' + b + ' 和 ' + c + '/' + d + ' 每一份一样大，可以直接数格子。'
      : a + '/' + b + ' 和 ' + c + '/' + d + ' 的每一份大小不同，不能直接把分子加起来。',
    snap: { kind: 'area', den: den, cells: cellsOf(0, 0), cellW: cellW, eq: '' }
  });

  steps.push({
    title: '先都切成 ' + den + ' 份',
    text: '把整块平均分成 ' + den + ' 份（' + b + ' 和 ' + d + ' 的最小公倍数），这样每一小格一样大。',
    snap: { kind: 'area', den: den, cells: cellsOf(0, 0), cellW: cellW, eq: '' }
  });

  steps.push({
    title: a + '/' + b + ' 占 ' + ca + ' 格',
    text: a + '/' + b + ' = ' + ca + '/' + den + '，涂满 ' + ca + ' 格。',
    snap: { kind: 'area', den: den, cells: cellsOf(ca, 0), cellW: cellW, eq: a + '/' + b + ' = ' + ca + '/' + den }
  });

  steps.push({
    title: c + '/' + d + ' 占 ' + cb + ' 格',
    text: c + '/' + d + ' = ' + cb + '/' + den + '，再涂 ' + cb + ' 格。现在每一格大小相同了。',
    snap: { kind: 'area', den: den, cells: cellsOf(ca, cb), cellW: cellW, eq: ca + '/' + den + ' + ' + cb + '/' + den }
  });

  steps.push({
    title: '一共涂了几格？',
    text: '先自己数一数，再选答案。',
    ask: {
      question: '蓝格 ' + ca + ' 个，橙格 ' + cb + ' 个，一共涂了几个小格？',
      options: [String(num) + ' 格', String(ca) + ' 格', String(cb) + ' 格'],
      answer: 0,
      hint: ca + ' + ' + cb + ' = ' + num + '。分母不变，因为每一格的大小没有变。'
    },
    snap: { kind: 'area', den: den, cells: cellsOf(ca, cb), cellW: cellW, eq: '' }
  });

  steps.push({
    title: ansN === num && ansD === den ? '答案是 ' + ansTxt : '约分后是 ' + ansTxt,
    text: ca + '/' + den + ' + ' + cb + '/' + den + ' = ' + num + '/' + den + (ansN === num && ansD === den ? '。' : ' = ' + ansTxt + '。') + '分子相加，分母不变——因为分成几份这件事没有变。' + (num > den ? '结果超过 1，所以下面多铺了一整块。' : ''),
    snap: { kind: 'area', den: den, cells: cellsOf(ca, cb), cellW: cellW, eq: ca + '/' + den + ' + ' + cb + '/' + den + ' = ' + ansTxt }
  });

  return { kind: 'area', answer: ansTxt, steps: steps };
}

/* ============================ 路由：识别结果 → 讲法 ============================ */

var META = {
  vertical: { templateName: '竖式板', tag: '竖式计算' },
  bar: { templateName: '线段图', tag: '应用题' },
  area: { templateName: '面积模型', tag: '分数计算' }
};

function build(q) {
  var p = q.params || {};
  var plan = null;
  var topic = '';

  if (q.kind === 'vertical_add') {
    plan = planAdd(p.a, p.b);
    topic = '加法竖式';
  } else if (q.kind === 'vertical_sub') {
    plan = planSub(p.a, p.b);
    topic = '减法竖式';
  } else if (q.kind === 'bar_more') {
    plan = planBarMore(p.a, p.d, p.unit || '个');
    topic = '多几少几';
  } else if (q.kind === 'bar_sumdiff') {
    plan = planBarSumDiff(p.S, p.D, p.unit || '个');
    topic = '和差问题';
  } else if (q.kind === 'frac_add') {
    plan = planFracAdd(p.a, p.b, p.c, p.d);
    topic = '异分母分数加法';
  }

  if (!plan) return null;

  var meta = META[plan.kind];
  return {
    stem: q.stem,
    kind: plan.kind,
    templateName: meta.templateName,
    tag: meta.tag,
    topic: topic,
    confidence: q.confidence,
    answer: plan.answer,
    steps: plan.steps
  };
}

module.exports = {
  planAdd: planAdd,
  planSub: planSub,
  planBarMore: planBarMore,
  planBarSumDiff: planBarSumDiff,
  planFracAdd: planFracAdd,
  build: build
};
