import type { CandidateMemory, MemoryEngine, PersonaId } from '../../contracts';

const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[\s，。！？、,.!?]/g, '');
const tokens = (value: string): Set<string> => {
  const text = normalize(value);
  const result = new Set(text.match(/[a-z0-9]{2,}/g) ?? []);
  for (let i = 0; i < text.length - 1; i++) result.add(text.slice(i, i + 2));
  return result;
};

/** Bind a persona where possible. Unbound mixed-persona input fails closed. */
export function createMemoryEngine(personaId?: PersonaId): MemoryEngine {
  return {
    extract(input, requestedPersonaId): CandidateMemory[] {
      if (personaId && personaId !== requestedPersonaId) return [];
      const candidates: CandidateMemory[] = [];
      const seen = new Set<string>();
      for (const raw of input.normalize('NFKC').split(/[。！？!?；;\n]/)) {
        const clause = raw.trim().replace(/^[，,\s]+|[，,\s]+$/g, '');
        if (!clause || clause.length > 240 || /[“”「」]|如果|假如|比如|举例|可能|也许|开玩笑|假装|他说|她说|朋友说|帮我记住.*(?:密钥|密码)|api.?key|sk-[a-z0-9]{8}/i.test(clause)) continue;
        // Feelings, negative self-judgments, crisis statements and tentative wishes are not durable facts.
        if (/焦虑|难过|伤心|孤独|失眠|崩溃|想死|自杀|自残|没用|废物|讨厌自己|现在.*(?:累|烦)|今天.*(?:累|烦)/.test(clause)) continue;
        let kind: CandidateMemory['kind'] | undefined;
        let title = '';
        let confidence = .9;
        if (/(?:我(?:不希望|不接受|不喜欢)|请(?:不要|别)|不要叫我|别叫我).*(?:叫|称呼|建议|说教|隐私|联系|提起|玩笑|评价|分享|身体)/.test(clause)) {
          kind = 'boundary'; title = '希望被尊重的边界'; confidence = .96;
        } else if (/(?:我(?:一直|平时|通常|最|特别|更)?(?:喜欢|爱喝|爱吃|习惯|偏爱)|我(?:不喜欢|不吃|不喝|讨厌))[^，,]{1,60}/.test(clause)
          && !/今天|现在|这会儿|突然|想要|希望你/.test(clause)) {
          kind = 'preference'; title = /不喜欢|不吃|不喝|讨厌/.test(clause) ? '不喜欢的事物' : '日常偏好';
        } else if (/(?:我(?:计划|打算|的目标是|正在准备|准备在)|我的目标)[^，,]{2,}/.test(clause)) {
          kind = 'goal'; title = '正在努力的目标';
        } else if (/(?:我(?:的)?(?:生日|入职|毕业|搬家)|我(?:今天|昨天|明天|下周|下个月|今年|去年|已经|刚刚|刚).*(?:入职|毕业|搬家|结婚|离职|面试|考试|录取|通过)|我在.{1,30}(?:工作|上学|读书|生活))/.test(clause)) {
          kind = 'event'; title = /生日/.test(clause) ? '生日' : '生活中的重要事件'; confidence = .92;
        } else if (/(?:我(?:的)?(?:妈妈|爸爸|父母|姐姐|妹妹|哥哥|弟弟|伴侣|男朋友|女朋友|室友|朋友))[^，,]{2,}/.test(clause)
          && /叫|住在|一起住|认识|结婚|异地|是/.test(clause)) {
          kind = 'relationship'; title = '重要的人与关系'; confidence = .88;
        }
        if (!kind || seen.has(normalize(clause))) continue;
        seen.add(normalize(clause));
        candidates.push({ kind, title, content: clause, confidence, tags: [kind, ...Array.from(tokens(clause)).filter(t => t.length > 2).slice(0, 3)] });
        if (candidates.length === 5) break;
      }
      return candidates;
    },
    rankRelevant(memories, input, limit = 6) {
      const target = personaId ?? (new Set(memories.map(memory => memory.personaId)).size === 1 ? memories[0]?.personaId : undefined);
      if (!target || !Number.isFinite(limit) || limit <= 0) return [];
      const query = tokens(input);
      const recall = /记得|记住|了解我|关于我|我的.*(?:喜欢|生日|目标)/.test(input);
      return memories.filter(memory => memory.personaId === target).map(memory => {
        const words = tokens(`${memory.title} ${memory.content} ${memory.tags.join(' ')}`);
        const overlap = [...query].filter(word => words.has(word)).length;
        const score = overlap * 3 + (memory.kind === 'boundary' ? 2 : 0) + (memory.source === 'user' ? .4 : 0) + memory.confidence * .3;
        return { memory, score, relevant: overlap > 0 || memory.kind === 'boundary' || recall };
      }).filter(row => row.relevant)
        .sort((a, b) => b.score - a.score || b.memory.updatedAt.localeCompare(a.memory.updatedAt) || a.memory.id.localeCompare(b.memory.id))
        .slice(0, Math.floor(limit)).map(row => row.memory);
    }
  };
}
