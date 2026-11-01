/* 云客户端初始化
 *
 * 通过 WorkBuddy 云服务的免密钥 LLM 通道调大模型做「拍照识别试卷」。
 * publicConfig 四个值里，小程序用到的两个都在这里：
 *   endpoint  —— 固定网关，发布流程会自动把它登记进微信的 request 合法域名
 *   publishableKey —— 应用标识，本身不含权限
 * 这两个值换成别的应用时才会变，平时不用动。
 */
var publicConfig = {
  endpoint: 'https://mp-api.app.workbuddy.host',
  publishableKey: 'wbpk_vPaqwPpYzLMR55XV6Ouxg6_Sr3nmXZn3q1vzV9CEgFMqOWRr82Dg9Nx'
};

var sdk = require('@tencent-ai/workbuddy-cloud-sdk/miniprogram');
var diag = require('./workbuddy-cloud-diagnostics');

var cloud = sdk.createMiniProgramWorkBuddyCloud({
  endpoint: publicConfig.endpoint,
  publishableKey: publicConfig.publishableKey,
  wx: diag.createDiagnosticWx(wx)
});

module.exports = {
  cloud: cloud,
  llm: cloud.llm
};
