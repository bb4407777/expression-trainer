/**
 * 直播法律问答助手
 * 检测主播（复读粉丝提问）说出的法律问题 → LLM 生成口语化参考答复
 * 可选：本地 legal-search 服务（127.0.0.1:8081）抓类似判例
 */

const { callAPI, getProviderConfig } = require('./ai-feedback');

// 法律领域关键词（命中其一才可能是法律问题）
const LEGAL_KEYWORDS = /醉驾|酒驾|判刑|判几年|坐牢|拘留|逮捕|取保|缓刑|量刑|自首|累犯|罚金|没收财产|死刑|无期|有期|监外执行|正当防卫|故意伤害|寻衅滋事|抢劫|盗窃|抢夺|敲诈|勒索|诈骗|传销|洗钱|走私|赌博|吸毒|贩毒|嫖娼|贪污|受贿|行贿|挪用|非法经营|偷税|漏税|危险驾驶|肇事|逃逸|离婚|抚养|彩礼|嫁妆|赡养|收养|监护|遗产|继承|家暴|工伤|赔偿|欠钱|欠条|借条|老赖|利息|高利贷|合同|违约|仲裁|起诉|立案|上诉|再审|律师费|定金|订金|押金|加班|辞退|裁员|离职|社保|公积金|试用期|竞业|车祸|交通事故|医疗事故|房产|过户|租房|商标|专利|侵权|著作权|名誉权|肖像权|隐私|诽谤|侮辱|性骚扰|网暴|个人信息|未成年人|法庭|法院|法官|官司/;

// 疑问句式特征
const QUESTION_HINTS = /吗|呢|？|\?|怎么|如何|几年|多久|多少|能不能|可不可以|会不会|要不要|犯法|违法|犯罪|算不算|犯不犯|违不违|判|赔|告|办|归谁|谁|啥|什么|哪/;

const CASE_SEARCH_URL = 'http://127.0.0.1:8081/api/search';
const CASE_PAGE_URL = 'http://127.0.0.1:8081/case/';

// 限流：同一时间只处理一个问题，且两次 LLM 调用至少间隔 4 秒
let busy = false;
let lastCallAt = 0;
let lastQuestion = '';
const MIN_INTERVAL_MS = 4000;

/**
 * 判断一句定稿文本是否像法律提问
 */
function detectLegalQuestion(text) {
  if (!text || text.trim().length < 5) return false;
  const t = text.trim();
  return LEGAL_KEYWORDS.test(t) && QUESTION_HINTS.test(t);
}

/**
 * 提取用于判例检索的关键词（取第一个命中的法律关键词）
 */
function extractKeyword(text) {
  const m = text.match(LEGAL_KEYWORDS);
  return m ? m[0] : text.slice(0, 10);
}

/**
 * 查本地 legal-search 服务，取前 3 条判例；服务未启动或超时则返回空数组
 */
async function searchCases(keyword) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const url = `${CASE_SEARCH_URL}?search=${encodeURIComponent(keyword)}&search_type=keyword&limit=3`;
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) return [];
    const data = await resp.json();
    const list = data.results || data.data || data.items || (Array.isArray(data) ? data : []);
    return list.slice(0, 3).map(item => ({
      title: item.title || item.case_name || item.name || '相关判例',
      url: item.id ? `${CASE_PAGE_URL}${item.id}` : null
    }));
  } catch (e) {
    return []; // 服务没开/超时，静默跳过
  } finally {
    clearTimeout(timer);
  }
}

function buildMessages(question) {
  return [
    {
      role: 'system',
      content:
        '你是直播间的法律助手（中国大陆法律）。主播正在直播，会复读粉丝的法律提问，你负责在后台给出参考答复，主播会直接照念。\n' +
        '要求：\n' +
        '1. 2-4句话，口语化，结论先行，再说依据（法条写到简称+条号即可，如《刑法》第133条之一）；\n' +
        '2. 不涉及具体案件细节，不做个案承诺；拿不准就说「这个要看具体情况」；\n' +
        '3. 末尾固定加一句：以上仅供参考，具体建议咨询专业律师；\n' +
        '4. 不要寒暄、不要标题、不要分点编号，直接给可以念出口的话。'
    },
    { role: 'user', content: `粉丝提问：${question}` }
  ];
}

/**
 * 处理一次法律提问：LLM 答复 + 判例检索（并行）
 * @returns {Promise<{question, answer, cases}|null>} 被限流/检测不通过时返回 null
 */
async function answerLegalQuestion(text, settings) {
  const question = text.trim();

  const now = Date.now();
  if (busy || now - lastCallAt < MIN_INTERVAL_MS) return null;
  if (question === lastQuestion) return null;

  busy = true;
  lastCallAt = now;
  lastQuestion = question;

  try {
    const keyword = extractKeyword(question);
    const config = getProviderConfig(settings);

    const [answer, cases] = await Promise.all([
      callAPI(config.endpoint, config.apiKey, config.model, buildMessages(question), 300),
      searchCases(keyword)
    ]);

    return { question, answer: (answer || '').trim(), cases };
  } finally {
    busy = false;
  }
}

module.exports = { detectLegalQuestion, answerLegalQuestion };
