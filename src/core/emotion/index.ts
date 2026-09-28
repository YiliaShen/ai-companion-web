import type { Emotion, EmotionEngine, EmotionReading, ReplyStrategy, Scene } from '../../contracts';

const emotionRules: [Emotion, RegExp, number][] = [
  ['angry', /生气|愤怒|气死|窝火|烦死|吵架|委屈/, .65],
  ['anxious', /焦虑|紧张|担心|害怕|恐慌|心慌|压力|失眠|睡不着/, .62],
  ['sad', /难过|难受|伤心|哭|失落|分手|绝望|崩溃/, .64],
  ['lonely', /孤独|孤单|寂寞|没人陪|没人理|想你|一个人好/, .55],
  ['tired', /疲惫|好累|太累|很累|累了|加班|耗尽|没力气/, .56],
  ['happy', /开心|高兴|快乐|太棒|成功|通过|升职|上岸|拿到.*offer|录取|做到了|庆祝/, .64]
];

export function createEmotionEngine(): EmotionEngine {
  return {
    analyze(input, persona, memories): EmotionReading {
      const text = input.normalize('NFKC').trim();
      // A conservative local guard; the injected SafetyEngine remains authoritative in the controller.
      const urgent = /自杀|自残|不想活|想死|结束生命|伤害自己|杀了自己|跳楼|割腕|吞药|杀了他|杀了她|suicid|kill myself/i.test(text);
      let scene: Scene = 'daily_share';
      let emotion: Emotion = 'calm';
      let intensity = .25;
      for (const [candidate, expression, base] of emotionRules) {
        if (expression.test(text)) { emotion = candidate; intensity = base; break; }
      }
      if (/工作|老板|同事|加班|绩效|项目|面试|考试|裁员/.test(text)) scene = 'work_stress';
      else if (/吵架|争吵|冲突|生气|冷战|气死/.test(text)) scene = 'conflict';
      else if (/分手|对象|伴侣|男朋友|女朋友|恋爱|关系|父母|家人|朋友/.test(text)) scene = 'relationship';
      else if (/失眠|睡不着|深夜|凌晨|半夜|晚安|夜里/.test(text)) scene = 'late_night';
      else if (emotion === 'lonely') scene = 'loneliness';
      if (emotion === 'happy') scene = 'celebration';
      if (/有点|一点点|还好|不太/.test(text)) intensity -= .15;
      if (/非常|特别|真的|太|受不了|崩溃|绝望/.test(text)) intensity += .18;
      if (/[!！]{2,}/.test(input)) intensity += .08;
      if (/并不|不再|没有|不/.test(text) && /(?:不|没有|不再)(?:那么|很)?(?:难过|焦虑|生气|孤独|难受)/.test(text)) {
        emotion = 'calm'; intensity = .25;
      }
      let strategy: ReplyStrategy = emotion === 'happy' ? 'celebrate'
        : emotion === 'angry' ? 'validate'
        : ['sad', 'lonely', 'anxious', 'tired'].includes(emotion) ? 'comfort' : 'listen';
      if (/怎么办|建议|帮我分析|怎么做|想办法/.test(text)) strategy = 'gently_reframe';
      if (/只(?:能|许).*我|不要.*(?:别人|朋友)|只要有你|代替.*(?:医生|心理咨询)|假装.*真人/.test(text)) strategy = 'set_boundary';
      if (/只想.*(?:说|听)|不要建议|别.*(?:分析|讲道理)/.test(text)) strategy = 'listen';
      const imageRequest = /想你了|想看看你|看看你|看一?张.*(?:照片|自拍)|(?:发|来|给|拍).*?(?:照片|自拍)|海边|看海/.test(text);
      const imageDeclined = /(?:不|别|不要|不用).*?(?:照片|自拍|拍照|看你|发图|图片)/.test(text);
      const shouldGenerateImage = !urgent && strategy !== 'set_boundary' && imageRequest && !imageDeclined;
      const scopedMemoryCount = memories.filter(memory => memory.personaId === persona.id).length;
      if (urgent) { scene = 'crisis'; emotion = 'crisis'; intensity = 1; strategy = 'safety_redirect'; }
      return {
        scene, emotion, intensity: Math.round(Math.max(0, Math.min(1, intensity)) * 100) / 100, strategy,
        shouldGenerateImage,
        ...(shouldGenerateImage ? { imagePrompt: `${persona.name}的虚构角色场景插画，${/海|沙滩/.test(text) ? '海边' : scene}，自然、温和，不暗示真人照片` } : {}),
        shouldOfferMusic: !urgent && ['late_night', 'loneliness'].includes(scene) && emotion !== 'happy',
        safety: urgent ? { level: 'urgent', reason: '检测到需要优先确认安全的表达' } : { level: 'none', reason: '本地场景分析未发现明确危机表达' },
        rationale: `local-rules-v1; persona=${persona.id}; scene=${scene}; emotion=${emotion}; scopedMemories=${scopedMemoryCount}`
      };
    }
  };
}
