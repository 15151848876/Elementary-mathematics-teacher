var P = require('../../utils/planners.js');
var R = require('../../utils/recognize.js');

var SCAN_STEPS = ['正在定位试卷…', '正在切分题目…', '正在识别数学式…', '正在匹配讲法…'];
var TASK_LABELS = ['定位试卷边缘并校正透视', '切分题目', '识别文字与数学式', '匹配题型与讲法'];

function delay(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function freshTasks() {
  return TASK_LABELS.map(function (label) { return { label: label, state: '' }; });
}

Page({
  data: {
    screen: 'home',
    solved: 46,
    photo: '',
    busy: false,
    errMsg: '',
    source: '',
    scanTitle: SCAN_STEPS[0],
    scanTasks: freshTasks(),
    questions: [],
    current: null,
    stepIndex: 0,
    stepTitle: '',
    stepText: '',
    isAsk: false,
    ask: null,
    answered: false,
    wrongIndex: -1,
    snap: null
  },

  /* ---------------- 入口 ---------------- */

  // 真实拍照：调系统相机，无需额外权限声明
  takePhoto: function () {
    var that = this;
    if (this.data.busy) return;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      sizeType: ['compressed'],
      success: function (res) {
        var file = res.tempFiles && res.tempFiles[0];
        if (!file) return;
        that.run(file.tempFilePath);
      },
      fail: function () {
        // 用户取消拍照，或环境不支持相机：安静退回首页，不打断
      }
    });
  },

  // 无相机环境（如开发者工具）用示例数据走同一条链路
  useDemo: function () {
    if (this.data.busy) return;
    this.run('');
  },

  /* ---------------- 主流程 ---------------- */

  run: function (photoPath) {
    var that = this;
    if (this.busy) return;
    this.busy = true;

    this.setData({
      screen: 'scan',
      photo: photoPath || '',
      errMsg: '',
      source: '',
      scanTitle: SCAN_STEPS[0],
      scanTasks: freshTasks()
    });

    var anim = this.playScan();
    var recog = R.recognize(photoPath).then(
      function (data) { return { ok: true, data: data }; },
      function (err) { return { ok: false, err: err }; }
    );

    Promise.all([anim, recog]).then(function (out) {
      var rec = out[1];
      that.busy = false;

      if (!rec.ok) {
        that.setData({
          screen: 'results',
          questions: [],
          errMsg: '识别没成功：' + ((rec.err && rec.err.message) || '请重拍一张试试'),
          source: ''
        });
        return;
      }

      var list = that.buildQuestions(rec.data.questions);
      if (!list.length) {
        that.setData({
          screen: 'results',
          questions: [],
          errMsg: '识别出来了，但这几道题暂时没有对应的讲解模板。',
          source: rec.data.source
        });
        return;
      }

      that.setData({
        screen: 'results',
        questions: list,
        source: rec.data.source,
        errMsg: ''
      });
    });
  },

  // 扫描动画节拍：四个阶段依次点亮
  playScan: function () {
    var that = this;
    var seq = Promise.resolve();

    SCAN_STEPS.forEach(function (title, i) {
      seq = seq.then(function () {
        var tasks = that.data.scanTasks.map(function (t, j) {
          return { label: t.label, state: j < i ? 'done' : (j === i ? 'active' : '') };
        });
        that.setData({ scanTitle: title, scanTasks: tasks });
        return delay(520);
      });
    });

    return seq.then(function () {
      var done = that.data.scanTasks.map(function (t) { return { label: t.label, state: 'done' }; });
      that.setData({ scanTitle: '识别完成', scanTasks: done });
      return delay(280);
    });
  },

  // 识别结果 → 引擎产生的讲解步骤。算不出讲解的题直接丢掉，不硬讲
  buildQuestions: function (items) {
    var out = [];
    for (var i = 0; i < items.length; i++) {
      var q = P.build(items[i]);
      if (!q) continue;
      q.no = items[i].no;
      q.confidence = items[i].confidence;
      q.id = i;
      q.steps = q.steps.map(function (s, si) {
        return { title: s.title, text: s.text, ask: s.ask || null, snap: s.snap, idx: si };
      });
      out.push(q);
    }
    return out;
  },

  /* ---------------- 解题页 ---------------- */

  openQuestion: function (e) {
    var idx = Number(e.currentTarget.dataset.index);
    var current = this.data.questions[idx];
    if (!current) return;
    this.setData({ screen: 'solve', current: current, stepIndex: 0 });
    this.updateStep(current, 0);
  },

  updateStep: function (current, stepIndex) {
    var step = current.steps[stepIndex];
    if (!step) return;
    this.setData({
      stepTitle: step.title,
      stepText: step.text,
      isAsk: !!step.ask,
      ask: step.ask || null,
      answered: false,
      wrongIndex: -1,
      snap: step.snap
    });
  },

  answerQuestion: function (e) {
    var index = Number(e.currentTarget.dataset.index);
    var step = this.data.current.steps[this.data.stepIndex];
    if (!step.ask) return;
    if (index === step.ask.answer) this.setData({ answered: true, wrongIndex: -1 });
    else this.setData({ wrongIndex: index });
  },

  nextStep: function () {
    var d = this.data;
    if (d.isAsk && !d.answered) return;
    if (d.stepIndex >= d.current.steps.length - 1) {
      this.setData({ screen: 'results', solved: d.solved + 1 });
      return;
    }
    var next = d.stepIndex + 1;
    this.setData({ stepIndex: next });
    this.updateStep(d.current, next);
  },

  prevStep: function () {
    if (this.data.stepIndex <= 0) return;
    var next = this.data.stepIndex - 1;
    this.setData({ stepIndex: next });
    this.updateStep(this.data.current, next);
  },

  backToResults: function () {
    this.setData({ screen: 'results' });
  },

  goHome: function () {
    this.setData({ screen: 'home', questions: [], photo: '', errMsg: '' });
  },

  retry: function () {
    this.setData({ screen: 'home', errMsg: '', questions: [], photo: '' });
    this.takePhoto();
  }
});
