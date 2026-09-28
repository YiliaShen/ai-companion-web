import type { ChatMessage, SafetyDecision, SafetyEngine } from '../../contracts';

export interface SafetyOptions {
  reminderAfterMs?: number;
  dependencyReminderEnabled?: boolean;
  now?: () => Date;
}

export const DEPENDENCY_REMINDER = '我们已经聊了一段时间。可以先放下屏幕，喝点水、活动一下，或给现实中信任的人发条消息。AI 陪伴是补充，你也值得拥有真实的人际支持。';
export const DEFAULT_REMINDER_AFTER_MS = 45 * 60 * 1000;

// These local language rules are a routing guard, not a diagnosis or risk assessment.
const urgentPatterns = [
  /(?:我|自己)?(?:现在|真的|已经|马上|今晚|准备|打算|决定|要|想|会|正在|忍不住|可能会|快要)*\s*(?:自杀|轻生|自残|割腕|割脉|跳楼|跳桥|跳河|上吊|服毒|结束(?:自己)?(?:的)?生命|杀死自己|伤害自己)/,
  /(?:不想|不愿|不打算|没法|无法|不能|活不下去|活不下来了)(?:再)?(?:活(?:着|下去|了)?|继续活)/,
  /(?:我想死|好想死|想死了|我快死了|我活不下去|让我死|想一死了之|不如死了|死了算了|(?:想|要|准备|决定)结束(?:这)?一切|撑不下去了.*(?:死|跳|药|刀))/,
  /(?:吃|吞|服)(?:了|下|掉)?(?:一整瓶|一瓶|很多|大量|过量|全部).{0,8}(?:药|安眠|止痛)/,
  /(?:已经|刚刚|正在).{0,6}(?:割伤|割了|割开|伤害了).{0,6}(?:自己|手腕|腕|动脉)/,
  /(?:我|现在).{0,12}(?:天台|楼顶|桥边|轨道).{0,12}(?:跳|死|结束)|(?:刀|药|绳).{0,8}(?:准备好了|就在手边).{0,12}(?:死|结束|自杀)/,
  /(?:他|她|有人|伴侣).{0,8}(?:要杀我|正打我|掐住我|拿刀威胁)|(?:无法|不能|没法|保证不了).{0,8}(?:保证|保持)?(?:自己|我)?.{0,4}安全/,
  /\b(?:i\s+(?:(?:am|'m)\s+)?(?:want to|plan to|intend to|will|might|am going to|feel like|need to)|i'm going to)\s+(?:kill|hurt|cut|harm)\s+myself\b/,
  /\b(?:kill myself|end my life|take my own life|commit suicide|i(?:'m| am) suicidal|i want to die|i wish i (?:was|were) dead|i can'?t go on living|i (?:want to|will|plan to|am going to) end it all)\b/,
  /\b(?:i\s+(?:have\s+)?(?:took|taken|swallowed).{0,25}(?:too many|all the|a bottle of|an overdose)|i(?:'ve| have)?\s+overdosed|i(?:'m| am)\s+(?:bleeding|cutting myself))\b/,
  /\b(?:can(?:not|'t)\s+(?:keep myself|stay) safe|(?:he|she|someone)\s+is\s+(?:trying to kill|choking) me)\b/
];
const negatedSignals = /(?:不会|不想|没有想|没有想过|没想|没想过|不打算|不准备|不愿|不再想|从没想|从来没想)(?:再|真的|要|去)?(?:自杀|自残|轻生|伤害自己|死)|(?:没有|没)(?:自杀|自残|轻生|伤害自己)(?:的)?(?:想法|念头|计划)|\b(?:don'?t|do not|won'?t|will not|would never|no longer)\s+(?:want to |plan to |intend to )?(?:kill myself|hurt myself|die)|\bnot (?:going to |planning to )(?:kill myself|hurt myself|die)|\b(?:not|never) suicidal\b/g;
const watchPattern = /活着.{0,5}(?:没意思|没意义)|没有活着的意义|不想醒来|消失就好了|想消失|想逃离一切|没人会在乎|没有人需要我|绝望|一无是处|撑不下去|自杀|自残|轻生|伤害自己|suicid|self[ -]?harm|wish i (?:could disappear|wouldn'?t wake up)|life (?:is|feels) (?:pointless|meaningless)|better off without me|hopeless/i;
const safeHandoff = /(?:已经|现在).{0,8}(?:联系|找到|叫来).{0,8}(?:急救|警察|医生|朋友|家人)|(?:朋友|家人|医护|医生).{0,6}(?:在我身边|陪着我)|i(?:'m| am) (?:with|talking to) (?:a doctor|my friend|my family|emergency services)/i;

function normalize(input: string): string {
  return input.normalize('NFKC').toLowerCase().replace(/[\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g, '').replace(/[’‘]/g, "'");
}

function classify(input: string): SafetyDecision['level'] {
  const text = normalize(input);
  let watch = false;
  for (const clause of text.split(/[。！？!?；;\n]|[,.，](?!\d)|\b(?:but|and|however)\b|但是|可是|可我|然而|但我|却/)) {
    // Scope negation/history to a clause so a later statement of intent still wins.
    const activeClause = clause.replace(negatedSignals, '');
    const contextual = /(?:以前|曾经|去年|几年前|过去).{0,18}(?:自杀|自残|轻生|伤害自己)|(?:used to|years? ago|last year).{0,24}(?:suicid|kill myself|self.harm)/.test(activeClause);
    const informational = /(?:小说|电影|新闻|剧中)(?:里|中|里的|中的)?(?:的)?(?:角色|主角|人物|主人公).{0,6}(?:自杀|轻生)|(?:解释|什么是|预防|研究|报道).{0,8}(?:自杀|自残)|自杀(?:预防|干预|研究|报道|新闻|是什么)|\b(?:suicide prevention|what is suicide|a character|in (?:a|the) movie)\b/.test(activeClause);
    if (urgentPatterns.some((pattern) => pattern.test(activeClause)) && !contextual && !informational) return 'urgent';
    if (!informational && (contextual || watchPattern.test(activeClause))) watch = true;
  }
  return watch ? 'watch' : 'none';
}

export function createSafetyEngine(options: SafetyOptions = {}): SafetyEngine {
  const configuredDelay = options.reminderAfterMs ?? DEFAULT_REMINDER_AFTER_MS;
  const reminderAfterMs = Number.isFinite(configuredDelay) && configuredDelay > 0 ? configuredDelay : DEFAULT_REMINDER_AFTER_MS;
  const clock = options.now ?? (() => new Date());
  return {
    assess(input: string, history: ChatMessage[]): SafetyDecision {
      const current = classify(input);
      if (current === 'urgent') return { level: 'urgent', reason: '出现当前自伤、轻生意图或人身危险信号，需要优先联系现实援助。' };
      // A request for a romantic reply/photo must not bypass a recent unresolved crisis.
      // Stop at a concrete handoff; ignore assistant text and stale past sessions.
      const now = clock().getTime();
      for (const message of history.filter((item) => item.role === 'user').slice(-6).reverse()) {
        const age = now - Date.parse(message.createdAt);
        if (!Number.isFinite(age) || age < 0 || age > 30 * 60 * 1000) continue;
        if (safeHandoff.test(normalize(message.text))) break;
        if (classify(message.text) === 'urgent') {
          if (safeHandoff.test(normalize(input))) return { level: 'watch', reason: '已描述联系现实支持，继续温和确认安全。' };
          return { level: 'urgent', reason: '近期危机信号尚未出现现实支持接手，继续优先安全回应。' };
        }
      }
      if (current === 'watch') return { level: 'watch', reason: '出现绝望、消失愿望或既往自伤线索，需要温和确认当前安全。' };
      return { level: 'none', reason: '未识别到明确危机线索。' };
    },
    buildSafetyReply(decision: SafetyDecision): string {
      // Deliberately independent of persona romance, prompts, or untrusted userMessage.
      if (decision.level === 'urgent') {
        return '听到你现在可能处在危险中，我很担心你的安全。请先暂停聊天，把眼前的安全放在第一位。\n\n如果你已经受伤、服用了过量药物，或可能马上伤害自己，请立即联系当地急救或报警，或请身边的人陪你前往最近的急诊。不要等待这里的回复。\n\n在能安全做到的情况下，远离可能伤害你的物品和危险地点，去有其他人的安全地方。现在联系一个你信任的人，直接告诉 TA：“我现在可能会伤害自己，需要你马上来陪我并帮我联系紧急援助。”尽量不要独处。\n\n我是 AI，无法到场或代你联系救援，也不能替代现实中的紧急援助。你现在是否已经受伤，或有一个可以立刻联系、来到你身边的人？';
      }
      if (decision.level === 'watch') {
        return '听起来你正在承受很重的感受。想先确认一下：你现在是否安全，有没有正在伤害自己，或打算马上伤害自己的念头？如果有，请立即联系当地急救或报警，并让信任的人到你身边。即使没有眼前危险，也可以把这些感受告诉现实中信任的人，或联系当地可核实的专业支持。';
      }
      return '';
    },
    shouldShowDependencyReminder(sessionStartedAt: string, now = clock()): boolean {
      if (options.dependencyReminderEnabled === false) return false;
      const started = Date.parse(sessionStartedAt);
      const elapsed = now.getTime() - started;
      return Number.isFinite(elapsed) && elapsed >= reminderAfterMs;
    }
  };
}
