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

/* ============================ 竖式：乘法 ============================ */

function planMul(a, b) {
  // 让 a 是较长的数（被乘数），b 是乘数；b 建议是 1~2 位
  if (String(a).length < String(b).length) { var t = a; a = b; b = t; }
  var prod = a * b;
  var n = String(a).length;
  var cols = Math.max(n + 1, String(prod).length);
  var A = rtlNum(a);
  var steps = [];
  var asked = false;

  steps.push({
    title: '先摆好乘法竖式',
    text: a + ' × ' + b + '。把 ' + b + ' 写在 ' + a + ' 的个位下面，从个位起逐位相乘。',
    snap: vertSnap('×', cols, cells(a, cols), cells(b, cols), carryCells(new Array(cols).fill('')), cells('', cols))
  });

  // 单步：b 的每一位 × a 的每一位
  var bStr = String(b);
  var partials = [];
  var bDigits = bStr.split('').reverse().map(function (c) { return Number(c); });

  for (var bi = 0; bi < bDigits.length; bi++) {
    var bd = bDigits[bi];
    var carry = 0;
    var lineStr = '';
    var lineSteps = [];
    for (var ai = 0; ai < n; ai++) {
      var ad = A[ai];
      var s = ad * bd + carry;
      var out = s % 10;
      carry = Math.floor(s / 10);
      var say = posName(ai) + '：' + ad + ' × ' + bd;
      if (carry) say += ' = ' + s + '，写 ' + out + '，向' + posName(ai + 1) + '进 ' + carry;
      else say += ' = ' + s;
      lineStr = String(out) + lineStr;
      lineSteps.push({
        title: '乘' + posName(ai),
        text: say + '。',
        snap: vertSnap('×', cols, cells(a, cols, ai, 'hl-a'), cells(b, cols), carryCells(new Array(cols).fill('')), cells(lineStr, cols, ai, 'new'))
      });
      if (carry && !asked && ai === n - 1) {
        asked = true;
        steps.push({
          title: '想一想进位',
          text: '先自己想一想，再选答案。',
          ask: {
            question: ad + ' × ' + bd + ' = ' + s + '，满十要向' + posName(ai + 1) + '进几？',
            options: ['进 ' + carry, '不用进', '进 1'],
            answer: 0,
            hint: s + ' 里有 ' + carry + ' 个十，向' + posName(ai + 1) + '进 ' + carry + '。'
          },
          snap: vertSnap('×', cols, cells(a, cols, ai, 'hl-a'), cells(b, cols), carryCells(new Array(cols).fill('')), cells(lineStr, cols))
        });
      }
    }
    if (carry) {
      lineStr = String(carry) + lineStr;
    }
    // 这一步的完整部分积
    var partial = (bi === 0) ? lineStr : lineStr + new Array(bi + 1).join('0');
    partials.push(partial);
    steps.push({
      title: '得部分积 ' + partial,
      text: bd + ' × ' + a + ' = ' + Number(lineStr) * Math.pow(10, bi) + '。这是' + (bi === 0 ? '个位' : posName(bi)) + '乘出来的部分积。',
      snap: vertSnap('×', cols, cells(a, cols), cells(b, cols), carryCells(new Array(cols).fill('')), cells(String(partial), cols))
    });
  }

  // 部分积相加
  if (partials.length > 1) {
    steps.push({
      title: '把部分积加起来',
      text: partials.join(' + ') + ' = ' + prod + '。',
      snap: vertSnap('×', cols, cells(a, cols), cells(b, cols), carryCells(new Array(cols).fill('')), cells(String(prod), cols))
    });
  }

  steps.push({
    title: '答案是 ' + prod,
    text: a + ' × ' + b + ' = ' + prod + '。',
    snap: vertSnap('×', cols, cells(a, cols), cells(b, cols), carryCells(new Array(cols).fill('')), cells(String(prod), cols))
  });

  return { kind: 'vertical', answer: String(prod), steps: steps };
}

/* ============================ 竖式：除法 ============================ */

function planDiv(a, b) {
  if (b === 0) return null;
  var q = Math.floor(a / b);
  var r = a % b;
  var steps = [];
  var cols = Math.max(String(a).length, String(q).length) + 1;

  steps.push({
    title: '先想：' + a + ' 里面有几个 ' + b,
    text: '除法就是看 ' + a + ' 能被 ' + b + ' 分成几份。先估一估：' + b + ' × ？最接近 ' + a + '。',
    snap: vertSnap('÷', cols, cells(a, cols), cells(b, cols), carryCells(new Array(cols).fill('')), cells('', cols))
  });

  steps.push({
    title: '试商：' + b + ' × ' + q + ' = ' + (b * q),
    text: b + ' × ' + q + ' = ' + (b * q) + '，' + (b * q) + ' 不超过 ' + a + '，商 ' + q + ' 合适。',
    snap: vertSnap('÷', cols, cells(a, cols), cells(b, cols), carryCells(new Array(cols).fill('')), cells(String(q), cols))
  });

  if (r > 0) {
    steps.push({
      title: '算余数',
      text: a + ' − ' + (b * q) + ' = ' + r + '。余数是 ' + r + '。',
      snap: vertSnap('÷', cols, cells(a, cols), cells(b, cols), carryCells(new Array(cols).fill('')), cells(String(q), cols))
    });
  }

  steps.push({
    title: r > 0 ? '答案是 ' + q + ' 余 ' + r : '答案是 ' + q,
    text: a + ' ÷ ' + b + ' = ' + q + (r > 0 ? ('……' + r) : '') + '。',
    snap: vertSnap('÷', cols, cells(a, cols), cells(b, cols), carryCells(new Array(cols).fill('')), cells(String(q), cols))
  });

  return { kind: 'vertical', answer: r > 0 ? (q + '余' + r) : String(q), steps: steps };
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

/* ============================ 数轴 ============================ */

function planNumberLine(a, b, op) {
  if (op === '-') { if (a < b) return null; }
  var result = op === '+' ? a + b : a - b;
  var maxU = Math.max(a, op === '+' ? result : a) + 4;
  var unitW = 100 / maxU;
  var steps = [];

  function marks(cur, hlFrom, hlTo) {
    var arr = [];
    for (var i = 0; i <= maxU; i++) {
      var cls = '';
      if (hlFrom !== null && hlFrom !== undefined && i === hlFrom) cls = 'start';
      else if (hlTo !== null && hlTo !== undefined && i === hlTo) cls = 'end';
      else if (hlFrom !== null && hlTo !== undefined && hlFrom !== hlTo && i > hlFrom && i < hlTo) cls = 'trail';
      arr.push({ i: i, label: (i % 5 === 0 ? String(i) : ''), cls: cls });
    }
    return arr;
  }

  steps.push({
    title: '先标出起点',
    text: '数轴上从 0 开始。先把起点 ' + a + ' 找到，站在这里。',
    snap: { kind: 'numberline', unitW: unitW, marks: marks(a, null, null), jump: null, eq: '' }
  });

  if (op === '+') {
    steps.push({
      title: '往右跳 ' + b + ' 步',
      text: '加 ' + b + '，就是往右（变大的方向）跳 ' + b + ' 格。',
      snap: { kind: 'numberline', unitW: unitW, marks: marks(a, a, a + b), jump: { from: a, to: a + b, n: b }, eq: '' }
    });
  } else {
    steps.push({
      title: '往左跳 ' + b + ' 步',
      text: '减 ' + b + '，就是往左（变小的方向）跳 ' + b + ' 格。',
      snap: { kind: 'numberline', unitW: unitW, marks: marks(a, a, a - b), jump: { from: a, to: a - b, n: b }, eq: '' }
    });
  }

  steps.push({
    title: '落在 ' + result,
    text: '从 ' + a + ' 出发，' + (op === '+' ? '往右' : '往左') + '跳 ' + b + ' 格，落在 ' + result + '。所以 ' + a + ' ' + op + ' ' + b + ' = ' + result + '。',
    snap: { kind: 'numberline', unitW: unitW, marks: marks(a, a, result), jump: { from: a, to: result, n: b }, eq: a + ' ' + op + ' ' + b + ' = ' + result }
  });

  return { kind: 'numberline', answer: String(result), steps: steps };
}

/* ============================ 小棒与计数器 ============================ */

function planCounter(a, b) {
  var sum = a + b;
  var steps = [];
  var aBundles = Math.floor(a / 10), aOnes = a % 10;
  var bBundles = Math.floor(b / 10), bOnes = b % 10;
  var carry = (aOnes + bOnes) >= 10;

  function group(n, hiB, hiO, clsB, clsO) {
    var bundles = [], ones = [];
    for (var i = 0; i < Math.floor(n / 10); i++) bundles.push({ i: i, cls: (hiB === i) ? clsB : '' });
    for (var j = 0; j < n % 10; j++) ones.push({ i: j, cls: (hiO === j) ? clsO : '' });
    return { bundles: bundles, ones: ones };
  }

  steps.push({
    title: '先摆出 ' + a,
    text: a + ' 可以看成 ' + Math.floor(a / 10) + ' 捆（每捆 10 根）+ ' + (a % 10) + ' 根。',
    snap: { kind: 'counter', a: group(a, null, null), b: group(0, null, null), carry: false, carryText: '', eq: '' }
  });

  steps.push({
    title: '再摆出 ' + b,
    text: b + ' 是 ' + Math.floor(b / 10) + ' 捆 + ' + (b % 10) + ' 根，摆到下面。',
    snap: { kind: 'counter', a: group(a, null, null), b: group(b, null, null), carry: false, carryText: '', eq: '' }
  });

  steps.push({
    title: '把散的几根合起来',
    text: '散的 ' + aOnes + ' 根 + ' + bOnes + ' 根 = ' + (aOnes + bOnes) + ' 根。',
    snap: { kind: 'counter', a: group(a, null, null, null, 'hi'), b: group(b, null, null, null, 'hi'), carry: carry, carryText: '', eq: '' }
  });

  if (carry) {
    steps.push({
      title: '满十根捆成一捆',
      text: '先自己想一想，再选答案。',
      ask: {
        question: aOnes + ' + ' + bOnes + ' = ' + (aOnes + bOnes) + '，满十了。可以捆成几捆？',
        options: ['捆成 1 捆，剩 ' + ((aOnes + bOnes) % 10) + ' 根', '捆成 2 捆', '不捆'],
        answer: 0,
        hint: '每 10 根捆成 1 捆。' + (aOnes + bOnes) + ' 根里有 1 个十，捆成 1 捆，还剩 ' + ((aOnes + bOnes) % 10) + ' 根。'
      },
      snap: { kind: 'counter', a: group(a, null, null, null, 'hi'), b: group(b, null, null, null, 'hi'), carry: true, carryText: '10 根 → 1 捆', eq: '' }
    });

    steps.push({
      title: '捆好之后',
      text: '多出来的 1 捆，和原来的 ' + (aBundles + bBundles) + ' 捆放到一起，一共 ' + (aBundles + bBundles + 1) + ' 捆，剩 ' + ((aOnes + bOnes) % 10) + ' 根。',
      snap: { kind: 'counter', a: group(a, null, null), b: group(b, null, null), carry: true, carryText: '多 1 捆', eq: '' }
    });
  }

  steps.push({
    title: '答案是 ' + sum,
    text: '一共 ' + Math.floor(sum / 10) + ' 捆 + ' + (sum % 10) + ' 根 = ' + sum + '。所以 ' + a + ' + ' + b + ' = ' + sum + '。',
    snap: { kind: 'counter', a: group(a, null, null), b: group(b, null, null), carry: carry, carryText: '', eq: a + ' + ' + b + ' = ' + sum }
  });

  return { kind: 'counter', answer: String(sum), steps: steps };
}

/* ============================ 几何板：数格子算面积/周长 ============================ */

function planGeoBoard(r, c, want) {
  var area = r * c;
  var peri = 2 * (r + c);
  // want: 'peri' 只求周长 / 'area' 只求面积 / 其它(=both) 都求
  var onlyPeri = want === 'peri';
  var onlyArea = want === 'area';
  var steps = [];

  function cells(hlRow, hlCol, hlAll) {
    var out = [];
    for (var i = 0; i < r; i++) {
      for (var j = 0; j < c; j++) {
        var cls = '';
        if (hlAll) cls = 'all';
        else if (hlRow === i || hlCol === j) cls = 'edge';
        out.push({ i: i, j: j, cls: cls });
      }
    }
    return out;
  }

  steps.push({
    title: '在方格纸上画一个长方形',
    text: '长 ' + c + ' 格，宽 ' + r + ' 格。每一小格就是 1 个单位。',
    snap: { kind: 'geoboard', rows: r, cols: c, cells: cells(-1, -1, false), hl: null, eq: '' }
  });

  if (!onlyArea) {
    steps.push({
      title: '先数一周有多少格（周长）',
      text: '沿着边数：上面 ' + c + ' 格，下面 ' + c + ' 格，左边 ' + r + ' 格，右边 ' + r + ' 格。',
      snap: { kind: 'geoboard', rows: r, cols: c, cells: cells(0, 0, false), hl: 'edge', eq: '' }
    });
    steps.push({
      title: '算周长',
      text: '周长 =（' + c + ' + ' + r + '）× 2 = ' + peri + '。数的是“围一圈”的格子数。',
      snap: { kind: 'geoboard', rows: r, cols: c, cells: cells(-1, -1, true), hl: 'edge', eq: '周长 = (' + c + ' + ' + r + ') × 2 = ' + peri }
    });
  }

  if (!onlyPeri) {
    steps.push({
      title: '再数一共铺了几格（面积）',
      text: '面积是“铺满”一共用了几个格子。数一数：' + r + ' 行，每行 ' + c + ' 格。',
      snap: { kind: 'geoboard', rows: r, cols: c, cells: cells(-1, -1, true), hl: 'area', eq: '' }
    });
    steps.push({
      title: '算面积',
      text: '面积 = ' + r + ' × ' + c + ' = ' + area + '。周长是“围一圈”，面积是“铺满”，别弄混。',
      snap: { kind: 'geoboard', rows: r, cols: c, cells: cells(-1, -1, true), hl: 'area', eq: '面积 = ' + r + ' × ' + c + ' = ' + area }
    });
  }

  var answer;
  if (onlyPeri) answer = '周长 ' + peri;
  else if (onlyArea) answer = '面积 ' + area;
  else answer = '周长 ' + peri + '，面积 ' + area;
  return { kind: 'geoboard', answer: answer, steps: steps };
}

/* ============================ 几何：正方形 ============================ */

function planSquare(s, want) {
  var area = s * s;
  var peri = 4 * s;
  // want: 'peri' 只求周长 / 'area' 只求面积 / 其它(=both) 周长面积都求
  var onlyPeri = want === 'peri';
  var onlyArea = want === 'area';
  var steps = [];
  steps.push({
    title: '画一个正方形',
    text: '正方形四条边一样长，都是 ' + s + '。',
    snap: { kind: 'shape', shape: 'square', a: s, b: null, hl: null, eq: '' }
  });

  if (!onlyArea) {
    steps.push({
      title: '算周长',
      text: '周长 = 边长 × 4 = ' + s + ' × 4 = ' + peri + '。',
      snap: { kind: 'shape', shape: 'square', a: s, b: null, hl: 'peri', eq: '周长 = ' + s + ' × 4 = ' + peri }
    });
  }

  if (!onlyPeri) {
    steps.push({
      title: '想一想面积',
      text: '面积是“铺满”的大小。先自己想一想：' + s + ' × ' + s + ' 等于几？',
      ask: {
        question: s + ' × ' + s + ' = ?',
        options: [String(area), String(s * 4), String(s + s)],
        answer: 0,
        hint: '面积 = 边长 × 边长 = ' + s + ' × ' + s + ' = ' + area + '。'
      },
      snap: { kind: 'shape', shape: 'square', a: s, b: null, hl: 'area', eq: '面积 = ' + s + ' × ' + s + ' = ?' }
    });
    steps.push({
      title: '答案是 ' + area,
      text: '面积 = 边长 × 边长 = ' + s + ' × ' + s + ' = ' + area + '。',
      snap: { kind: 'shape', shape: 'square', a: s, b: null, hl: 'area', eq: '面积 = ' + s + ' × ' + s + ' = ' + area }
    });
  }

  var answer;
  if (onlyPeri) answer = '周长 ' + peri;
  else if (onlyArea) answer = '面积 ' + area;
  else answer = '周长 ' + peri + '，面积 ' + area;
  return { kind: 'shape', answer: answer, steps: steps };
}

/* ============================ 几何：已知周长反求边长/一边 ============================ */

function planRectReverse(S, known, unit) {
  unit = unit || '';
  var side = known;
  var other = Math.round((S - 2 * known) / 2);
  var steps = [];
  steps.push({
    title: '画出来想一想',
    text: '长方形周长是 ' + S + unit + '，其中一边是 ' + known + unit + '，求另一边。',
    snap: { kind: 'shape', shape: 'rect', a: known, b: null, hl: null, eq: '周长 = ' + S }
  });
  steps.push({
    title: '周长的一半是长+宽',
    text: '周长 =（长 + 宽）× 2，所以长 + 宽 = ' + S + ' ÷ 2 = ' + (S / 2) + '。',
    snap: { kind: 'shape', shape: 'rect', a: known, b: null, hl: 'half', eq: '长 + 宽 = ' + S + ' ÷ 2 = ' + (S / 2) }
  });
  steps.push({
    title: '求另一边',
    text: '另一边 = ' + (S / 2) + ' − ' + known + ' = ' + other + '。',
    snap: { kind: 'shape', shape: 'rect', a: known, b: other, hl: 'other', eq: '另一边 = ' + (S / 2) + ' − ' + known + ' = ' + other }
  });
  steps.push({
    title: '验算一下',
    text: '（' + known + ' + ' + other + '）× 2 = ' + (known + other) + ' × 2 = ' + S + '。对得上。',
    snap: { kind: 'shape', shape: 'rect', a: known, b: other, hl: 'check', eq: '(' + known + ' + ' + other + ') × 2 = ' + S }
  });
  return { kind: 'shape', answer: '另一边 ' + other + unit, steps: steps };
}

/* ============================ 几何：正方形反求边长（已知周长或面积） ============================ */

function planSquareSide(S, by, unit) {
  unit = unit || '';
  var side, steps = [];

  if (by === 'area') {
    // 面积 = 边长 × 边长，小学阶段边长取整数
    side = Math.round(Math.sqrt(S));
    if (side <= 0 || side * side !== S) return null; // 不是完全平方数，讲不了
    steps.push({
      title: '画出来想一想',
      text: '正方形的面积是 ' + S + unit + '，求边长。正方形四条边一样长。',
      snap: { kind: 'shape', shape: 'square', a: null, b: null, hl: 'area', eq: '面积 = ' + S }
    });
    steps.push({
      title: '面积 = 边长 × 边长',
      text: '正方形的面积是「边长 × 边长」得到的。想一想：几 × 几 = ' + S + '？',
      ask: {
        question: '边长 × 边长 = ' + S + '，边长是几？',
        options: [String(side), String(Math.round(S / 4)), String(side + 1)],
        answer: 0,
        hint: side + ' × ' + side + ' = ' + S + '。所以边长是 ' + side + unit + '。'
      },
      snap: { kind: 'shape', shape: 'square', a: null, b: null, hl: 'area', eq: '边长 × 边长 = ' + S }
    });
    steps.push({
      title: '答案是 ' + side + unit,
      text: side + ' × ' + side + ' = ' + S + '，所以边长是 ' + side + unit + '。',
      snap: { kind: 'shape', shape: 'square', a: side, b: null, hl: 'side', eq: '边长 = ' + side }
    });
    steps.push({
      title: '验算一下',
      text: '边长 × 边长 = ' + side + ' × ' + side + ' = ' + S + '。对得上。',
      snap: { kind: 'shape', shape: 'square', a: side, b: null, hl: 'check', eq: side + ' × ' + side + ' = ' + S }
    });
    return { kind: 'shape', answer: '边长 ' + side + unit, steps: steps };
  }

  // 默认：已知周长求边长
  if (!(S > 0) || S % 4 !== 0) return null; // 周长不是 4 的倍数，边长非整数，讲不了
  side = S / 4;
  steps.push({
    title: '画出来想一想',
    text: '正方形的周长是 ' + S + unit + '，求边长。正方形四条边一样长。',
    snap: { kind: 'shape', shape: 'square', a: null, b: null, hl: 'peri', eq: '周长 = ' + S }
  });
  steps.push({
    title: '周长 = 边长 × 4',
    text: '正方形有 4 条一样的边，所以边长 = 周长 ÷ 4 = ' + S + ' ÷ 4。先自己想一想等于几。',
    ask: {
      question: '边长 = ' + S + ' ÷ 4，等于几？',
      options: [String(side), String(Math.round(S / 2)), String(side + 1)],
      answer: 0,
      hint: '四七二十八这类口诀倒过来想：' + side + ' × 4 = ' + S + '。所以边长是 ' + side + unit + '。'
    },
    snap: { kind: 'shape', shape: 'square', a: null, b: null, hl: 'peri', eq: '边长 = ' + S + ' ÷ 4 = ?' }
  });
  steps.push({
    title: '答案是 ' + side + unit,
    text: '边长 = ' + S + ' ÷ 4 = ' + side + unit + '。',
    snap: { kind: 'shape', shape: 'square', a: side, b: null, hl: 'side', eq: '边长 = ' + S + ' ÷ 4 = ' + side }
  });
  steps.push({
    title: '验算一下',
    text: '边长 × 4 = ' + side + ' × 4 = ' + S + '。对得上。',
    snap: { kind: 'shape', shape: 'square', a: side, b: null, hl: 'check', eq: side + ' × 4 = ' + S }
  });
  return { kind: 'shape', answer: '边长 ' + side + unit, steps: steps };
}

/* ============================ 几何：三角形面积 ============================ */

function planTriangle(a, h) {
  // 直角边为底 a、高 h 的三角形（或一般三角形，用 底×高÷2）
  var area = a * h / 2;
  var areaTxt = (area % 1 === 0) ? String(area) : (a * h) + '/2';
  var half = a * h;
  var steps = [];
  steps.push({
    title: '画出三角形',
    text: '底是 ' + a + '，高是 ' + h + '。',
    snap: { kind: 'shape', shape: 'triangle', a: a, b: h, hl: null, eq: '' }
  });
  steps.push({
    title: '三角形是长方形的一半',
    text: '把两个一样的三角形拼起来，就是一个长方形：底 ' + a + ' × 高 ' + h + ' = ' + half + '。',
    snap: { kind: 'shape', shape: 'triangle', a: a, b: h, hl: 'doub', eq: '底 × 高 = ' + a + ' × ' + h + ' = ' + half }
  });
  steps.push({
    title: '再除以 2',
    text: '三角形只是这个长方形的一半，所以再 ÷ 2。',
    snap: { kind: 'shape', shape: 'triangle', a: a, b: h, hl: 'half', eq: '面积 = ' + a + ' × ' + h + ' ÷ 2 = ' + areaTxt }
  });
  steps.push({
    title: '答案是 ' + areaTxt,
    text: '面积 = 底 × 高 ÷ 2 = ' + a + ' × ' + h + ' ÷ 2 = ' + areaTxt + '。',
    snap: { kind: 'shape', shape: 'triangle', a: a, b: h, hl: 'area', eq: '面积 = ' + areaTxt }
  });
  return { kind: 'shape', answer: '面积 ' + areaTxt, steps: steps };
}

/* ============================ 几何：组合图形（拆成两个矩形） ============================ */

function planComposite(a, b, c, d) {
  // 一个 L 形 / 组合矩形：可拆成 a×b 和 c×d 两块（约定两块共享一条边，边长均为整数）
  var s1 = a * b;
  var s2 = c * d;
  var total = s1 + s2;
  var steps = [];
  steps.push({
    title: '把组合图形拆开',
    text: '这个图形可以拆成两个长方形：一块 ' + a + '×' + b + '，另一块 ' + c + '×' + d + '。',
    snap: { kind: 'shape', shape: 'composite', a: a, b: b, c: c, d: d, hl: null, eq: '' }
  });
  steps.push({
    title: '算第一块的面积',
    text: a + ' × ' + b + ' = ' + s1 + '。',
    snap: { kind: 'shape', shape: 'composite', a: a, b: b, c: c, d: d, hl: 'p1', eq: '第一块 = ' + a + ' × ' + b + ' = ' + s1 }
  });
  steps.push({
    title: '算第二块的面积',
    text: c + ' × ' + d + ' = ' + s2 + '。',
    snap: { kind: 'shape', shape: 'composite', a: a, b: b, c: c, d: d, hl: 'p2', eq: '第二块 = ' + c + ' × ' + d + ' = ' + s2 }
  });
  steps.push({
    title: '加起来',
    text: '总面积 = ' + s1 + ' + ' + s2 + ' = ' + total + '。',
    snap: { kind: 'shape', shape: 'composite', a: a, b: b, c: c, d: d, hl: 'sum', eq: '总面积 = ' + s1 + ' + ' + s2 + ' = ' + total }
  });
  return { kind: 'shape', answer: '面积 ' + total, steps: steps };
}

/* ============================ 几何：圆的周长/面积 ============================ */

function planCircle(r) {
  var PI = 3.14;
  var peri = Math.round(2 * PI * r * 100) / 100;
  var area = Math.round(PI * r * r * 100) / 100;
  var periTxt = String(peri);
  var areaTxt = String(area);
  var steps = [];
  steps.push({
    title: '画出圆',
    text: '圆的半径是 ' + r + '，直径是 ' + (r * 2) + '。',
    snap: { kind: 'shape', shape: 'circle', a: r, hl: null, eq: '' }
  });
  steps.push({
    title: '算周长',
    text: '周长 = 2 × π × 半径 = 2 × 3.14 × ' + r + ' = ' + periTxt + '。',
    snap: { kind: 'shape', shape: 'circle', a: r, hl: 'peri', eq: '周长 = 2 × 3.14 × ' + r + ' = ' + periTxt }
  });
  steps.push({
    title: '想一想面积',
    text: '面积 = π × 半径 × 半径。先自己想一想：3.14 × ' + r + ' × ' + r + ' 等于几？',
    ask: {
      question: '3.14 × ' + r + ' × ' + r + ' = ?',
      options: [areaTxt, periTxt, String(Math.round(PI * r * 100) / 100)],
      answer: 0,
      hint: '面积 = π × 半径² = 3.14 × ' + r + ' × ' + r + ' = ' + areaTxt + '。'
    },
    snap: { kind: 'shape', shape: 'circle', a: r, hl: 'area', eq: '面积 = 3.14 × ' + r + ' × ' + r + ' = ?' }
  });
  steps.push({
    title: '答案是 ' + areaTxt,
    text: '面积 = π × 半径² = 3.14 × ' + r + ' × ' + r + ' = ' + areaTxt + '。周长和面积别混：周长是“绕一圈”，面积是“圆面大小”。',
    snap: { kind: 'shape', shape: 'circle', a: r, hl: 'area', eq: '面积 = ' + areaTxt }
  });
  return { kind: 'shape', answer: '周长 ' + periTxt + '，面积 ' + areaTxt, steps: steps };
}

/* ============================ 几何：平行四边形面积 ============================ */

function planParallelogram(a, h) {
  var area = a * h;
  var steps = [];
  steps.push({
    title: '画出平行四边形',
    text: '底是 ' + a + '，高是 ' + h + '。',
    snap: { kind: 'shape', shape: 'parallelogram', a: a, b: h, hl: null, eq: '' }
  });
  steps.push({
    title: '沿着高剪开，拼成长方形',
    text: '沿高剪一刀，把左边三角形移到右边，就拼成了一个长方形：长 = 底 = ' + a + '，宽 = 高 = ' + h + '。',
    snap: { kind: 'shape', shape: 'parallelogram', a: a, b: h, hl: 'cut', eq: '拼成长方形：长 ' + a + '，宽 ' + h }
  });
  steps.push({
    title: '面积 = 底 × 高',
    text: '面积 = 底 × 高 = ' + a + ' × ' + h + ' = ' + area + '。',
    snap: { kind: 'shape', shape: 'parallelogram', a: a, b: h, hl: 'area', eq: '面积 = ' + a + ' × ' + h + ' = ' + area }
  });
  steps.push({
    title: '答案是 ' + area,
    text: '注意：平行四边形的高是“垂直的距离”，不是斜边。面积 = 底 × 高 = ' + area + '。',
    snap: { kind: 'shape', shape: 'parallelogram', a: a, b: h, hl: 'area', eq: '面积 = ' + area }
  });
  return { kind: 'shape', answer: '面积 ' + area, steps: steps };
}

/* ============================ 几何：梯形面积 ============================ */

function planTrapezoid(a, b, h) {
  // 上底 a、下底 b、高 h
  var sum = a + b;
  var prod = sum * h;
  var areaTxt = (prod % 2 === 0) ? String(prod / 2) : (prod) + '/2';
  var steps = [];
  steps.push({
    title: '画出梯形',
    text: '上底 ' + a + '，下底 ' + b + '，高 ' + h + '。',
    snap: { kind: 'shape', shape: 'trapezoid', a: a, b: b, c: h, hl: null, eq: '' }
  });
  steps.push({
    title: '两个梯形拼成平行四边形',
    text: '把两个一样的梯形拼起来，就是一个平行四边形，底 = 上底 + 下底 = ' + a + ' + ' + b + ' = ' + sum + '。',
    snap: { kind: 'shape', shape: 'trapezoid', a: a, b: b, c: h, hl: 'doub', eq: '上底 + 下底 = ' + sum }
  });
  steps.push({
    title: '平行四边形面积 =（上底+下底）× 高',
    text: '拼成的平行四边形面积 = ' + sum + ' × ' + h + ' = ' + prod + '。',
    snap: { kind: 'shape', shape: 'trapezoid', a: a, b: b, c: h, hl: 'par', eq: '平行四边形 = ' + sum + ' × ' + h + ' = ' + prod }
  });
  steps.push({
    title: '梯形是它的一半',
    text: '梯形 = 平行四边形 ÷ 2 = ' + prod + ' ÷ 2 = ' + areaTxt + '。',
    snap: { kind: 'shape', shape: 'trapezoid', a: a, b: b, c: h, hl: 'half', eq: '面积 = ' + prod + ' ÷ 2 = ' + areaTxt }
  });
  steps.push({
    title: '答案是 ' + areaTxt,
    text: '梯形面积 =（上底 + 下底）× 高 ÷ 2 = ' + areaTxt + '。',
    snap: { kind: 'shape', shape: 'trapezoid', a: a, b: b, c: h, hl: 'area', eq: '面积 = ' + areaTxt }
  });
  return { kind: 'shape', answer: '面积 ' + areaTxt, steps: steps };
}

/* ============================ 天平与简易方程 ============================ */

function planBalance(a, b, c) {
  var x = c - a;
  var total = a + b;
  var steps = [];

  // 把数量转成「一长串 x / 数字」的数组，渲染层直接遍历
  function ones(n) { var arr = []; for (var i = 0; i < n; i++) arr.push(i); return arr; }

  steps.push({
    title: '天平两边画出来',
    text: '左边：' + a + ' 个 + x 个未知。右边：' + c + ' 个。天平是平的，说明两边一样重。',
    snap: { kind: 'balance', x: ones(b), left: ones(a), right: ones(c), eq: 'x + ' + a + ' = ' + c }
  });

  steps.push({
    title: '两边同时拿掉 ' + a + ' 个',
    text: '为了把 x 单独留下，两边同时拿走 ' + a + ' 个。天平还是平的，因为两边减的一样多。',
    snap: { kind: 'balance', x: ones(b), left: ones(a), right: ones(c), eq: 'x + ' + a + ' − ' + a + ' = ' + c + ' − ' + a }
  });

  steps.push({
    title: '左边只剩 x',
    text: '左边 ' + a + ' − ' + a + ' = 0，只剩 x。右边 ' + c + ' − ' + a + ' = ' + x + '。',
    snap: { kind: 'balance', x: ones(b), left: [], right: ones(c), eq: 'x = ' + c + ' − ' + a }
  });

  steps.push({
    title: '想一想 x 是几',
    text: '先自己想一想，再选答案。',
    ask: {
      question: 'x = ' + c + ' − ' + a + '，x 等于几？',
      options: [String(x), String(c), String(a)],
      answer: 0,
      hint: c + ' 拿走 ' + a + ' 个，剩 ' + x + ' 个。所以 x = ' + x + '。'
    },
    snap: { kind: 'balance', x: ones(b), left: [], right: ones(c), eq: 'x = ' + c + ' − ' + a + ' = ?' }
  });

  steps.push({
    title: '答案是 x = ' + x,
    text: 'x = ' + x + '。验算：' + x + ' + ' + a + ' = ' + c + '，对得上。',
    snap: { kind: 'balance', x: ones(b), left: [], right: ones(x), eq: 'x = ' + x }
  });

  return { kind: 'balance', answer: 'x = ' + x, steps: steps };
}

/* ============================ 统计图 ============================ */

function planChart(labels, values) {
  var n = values.length;
  var sum = 0, max = 0, min = Infinity;
  for (var i = 0; i < n; i++) {
    sum += values[i];
    if (values[i] > max) max = values[i];
    if (values[i] < min) min = values[i];
  }
  var steps = [];

  function bars(hl) {
    return values.map(function (v, i) {
      return { i: i, label: labels[i], v: v, pct: (v / max) * 100, cls: (hl === i) ? 'hi' : '' };
    });
  }

  steps.push({
    title: '把数据做成条形图',
    text: '每个「' + labels.join('、') + '」是一根柱子，柱子越高表示数量越多。',
    snap: { kind: 'chart', chartType: 'bar', bars: bars(-1), eq: '' }
  });

  steps.push({
    title: '最高的是？',
    text: '先自己看一看，再选答案。',
    ask: {
      question: '哪一项的数量最多？',
      options: labels.slice(0, 4),
      answer: values.indexOf(max) < 4 ? values.indexOf(max) : 0,
      hint: '最高的柱子是「' + labels[values.indexOf(max)] + '」，有 ' + max + ' 个。'
    },
    snap: { kind: 'chart', chartType: 'bar', bars: bars(values.indexOf(max)), eq: '' }
  });

  steps.push({
    title: '合起来数一数',
    text: '一共 = ' + values.join(' + ') + ' = ' + sum + '。',
    snap: { kind: 'chart', chartType: 'bar', bars: bars(-1), eq: values.join(' + ') + ' = ' + sum }
  });

  steps.push({
    title: '比一比：最多比最少多多少？',
    text: '最多 ' + max + '，最少 ' + min + '。相差 ' + (max - min) + '。',
    snap: { kind: 'chart', chartType: 'bar', bars: bars(-1), eq: max + ' − ' + min + ' = ' + (max - min) }
  });

  return { kind: 'chart', answer: '总数 ' + sum + '，最多 ' + max, steps: steps };
}

/* ============================ 路由：识别结果 → 讲法 ============================ */

var META = {
  vertical: { templateName: '竖式板', tag: '竖式计算' },
  bar: { templateName: '线段图', tag: '应用题' },
  area: { templateName: '面积模型', tag: '分数计算' },
  numberline: { templateName: '数轴', tag: '数的加减' },
  counter: { templateName: '小棒与计数器', tag: '数的认识' },
  geoboard: { templateName: '几何板', tag: '周长与面积' },
  shape: { templateName: '几何图形', tag: '周长与面积' },
  balance: { templateName: '天平方程', tag: '简易方程' },
  chart: { templateName: '统计图', tag: '数据统计' },
  expression: { templateName: '脱式计算', tag: '综合运算' }
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
  } else if (q.kind === 'numberline_add') {
    plan = planNumberLine(p.a, p.b, '+');
    topic = '数轴加法';
  } else if (q.kind === 'numberline_sub') {
    plan = planNumberLine(p.a, p.b, '-');
    topic = '数轴减法';
  } else if (q.kind === 'counter_add') {
    plan = planCounter(p.a, p.b);
    topic = '小棒计数器进位加法';
  } else if (q.kind === 'geoboard_rect') {
    plan = planGeoBoard(p.r, p.c, p.want);
    topic = '周长与面积';
  } else if (q.kind === 'square_peri_area') {
    plan = planSquare(p.s, p.want);
    topic = '正方形周长面积';
  } else if (q.kind === 'rect_reverse') {
    if (!(p.known > 0)) return null; // 缺已知边，讲不了（不硬讲，避免 null 出现在界面上）
    plan = planRectReverse(p.S, p.known, p.unit || '');
    topic = '长方形反求边长';
  } else if (q.kind === 'square_side') {
    plan = planSquareSide(p.S, p.by === 'area' ? 'area' : 'peri', p.unit || '');
    topic = p.by === 'area' ? '正方形面积反求边长' : '正方形周长反求边长';
  } else if (q.kind === 'triangle_area') {
    plan = planTriangle(p.a, p.h);
    topic = '三角形面积';
  } else if (q.kind === 'composite_area') {
    plan = planComposite(p.a, p.b, p.c, p.d);
    topic = '组合图形面积';
  } else if (q.kind === 'circle_peri_area') {
    plan = planCircle(p.r);
    topic = '圆的周长面积';
  } else if (q.kind === 'parallelogram_area') {
    plan = planParallelogram(p.a, p.h);
    topic = '平行四边形面积';
  } else if (q.kind === 'trapezoid_area') {
    plan = planTrapezoid(p.a, p.b, p.h);
    topic = '梯形面积';
  } else if (q.kind === 'balance_eq') {
    plan = planBalance(p.a, p.b, p.c);
    topic = '天平解方程';
  } else if (q.kind === 'chart_bar') {
    plan = planChart(p.labels, p.values);
    topic = '条形统计图';
  } else if (q.kind === 'vertical_mul') {
    plan = planMul(p.a, p.b);
    topic = '乘法竖式';
  } else if (q.kind === 'vertical_div') {
    plan = planDiv(p.a, p.b);
    topic = '除法竖式';
  } else if (q.kind === 'expression') {
    // 泛化兜底：任意加减乘除/括号/分数/小数算式，走分步求值引擎。
    // 简单两整数±×÷优先给竖式板（小学竖式教学的预期形态）
    var exprStr = String(p.expr || '');
    var simple = /^\s*(\d{1,4})\s*([+\-−×*xX÷/])\s*(\d{1,4})\s*$/.exec(exprStr);
    if (simple) {
      var sa = Number(simple[1]), sb = Number(simple[3]), sop = simple[2];
      if (sop === '+') { plan = planAdd(sa, sb); topic = '加法竖式'; }
      else if (sop === '-' || sop === '−') { if (sa >= sb) { plan = planSub(sa, sb); topic = '减法竖式'; } }
      else if (sop === '×' || sop === '*' || sop === 'x' || sop === 'X') { plan = planMul(sa, sb); topic = '乘法竖式'; }
      else if ((sop === '÷' || sop === '/') && sb !== 0 && sa % sb === 0) { plan = planDiv(sa, sb); topic = '除法竖式'; }
    }
    if (!plan) {
      plan = require('./expression.js').planExpression(exprStr);
      topic = '脱式计算';
    }
  }

  if (!plan) return null;

  // shape 快照里未知量统一显示「？」，绝不把 null/undefined 漏到界面上
  if (plan.kind === 'shape') {
    plan.steps.forEach(function (s) {
      var snap = s.snap;
      if (snap && snap.kind === 'shape') {
        ['a', 'b', 'c', 'd'].forEach(function (k) {
          if (snap[k] === null || snap[k] === undefined || snap[k] === '') snap[k] = '?';
        });
      }
    });
  }

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
  planMul: planMul,
  planDiv: planDiv,
  planBarMore: planBarMore,
  planBarSumDiff: planBarSumDiff,
  planFracAdd: planFracAdd,
  planNumberLine: planNumberLine,
  planCounter: planCounter,
  planGeoBoard: planGeoBoard,
  planSquare: planSquare,
  planRectReverse: planRectReverse,
  planTriangle: planTriangle,
  planComposite: planComposite,
  planCircle: planCircle,
  planParallelogram: planParallelogram,
  planTrapezoid: planTrapezoid,
  planBalance: planBalance,
  planChart: planChart,
  build: build
};
