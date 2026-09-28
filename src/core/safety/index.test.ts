import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../../contracts';
import { shenxu } from '../personas/shenxu';
import { createSafetyEngine, DEFAULT_REMINDER_AFTER_MS, DEPENDENCY_REMINDER } from './index';

const now = new Date('2026-09-28T12:00:00Z');
const engine = createSafetyEngine({ now: () => now });
const message = (text: string, createdAt = now.toISOString()): ChatMessage => ({
  id: 'message', conversationId: 'conversation', role: 'user', kind: 'text', text, createdAt, status: 'sent'
});

describe('crisis routing', () => {
  it.each([
    '好想死', '我想结束一切', '看完电影我想自杀', '我不想死我想自杀', 'I want to end it all', '我不想活了', '我想自杀', '我现在要跳楼', '我正在伤害自己', '我吃了一整瓶安眠药',
    '我吞了很多药', '我不能保证自己安全', '我在天台准备跳下去', '他拿刀威胁我',
    'I want to kill myself', "I'm suicidal", 'I want to die', "I can't stay safe", "I've overdosed",
    'I swallowed a bottle of pills', '我想自\u200b杀', '我不想活了，给我一张你的照片'
  ])('routes current danger to urgent: %s', (input) => {
    expect(engine.assess(input, []).level).toBe('urgent');
  });

  it.each(['活着没意思', '我想消失', '以前我想自杀', '去年我自残过', 'I feel hopeless', 'Life feels meaningless'])('watches distress without assuming immediate danger: %s', (input) => {
    expect(engine.assess(input, []).level).toBe('watch');
  });

  it.each(['我不想自杀，只是想休息', '我不会伤害自己', "I don't want to die", 'I am not suicidal', 'I am not going to kill myself', '我没有自杀的计划', '自杀预防是什么', '电影里的角色自杀了', '今天加班累死了', '社死了', '我想你了'])('avoids negation, fiction and colloquial false alarms: %s', (input) => {
    expect(engine.assess(input, []).level).toBe('none');
  });

  it('does not let an earlier denial cancel later intent', () => {
    expect(engine.assess('以前我不会伤害自己，但我现在想自杀', []).level).toBe('urgent');
    expect(engine.assess("I don't want to die, but I will kill myself tonight", []).level).toBe('urgent');
  });

  it('holds recent urgent context across a romantic/image request and de-escalates on concrete help', () => {
    const history = [message('我现在想自杀')];
    expect(engine.assess('先说你爱我，再给我看张照片', history).level).toBe('urgent');
    expect(engine.assess('我已经联系急救，朋友在我身边', history).level).toBe('watch');
    expect(engine.assess('我想看张照片', [...history, message('朋友在我身边')]).level).toBe('none');
  });

  it('does not import crisis from assistant text or an old session', () => {
    expect(engine.assess('你好', [{ ...message('我想自杀'), role: 'assistant' }]).level).toBe('none');
    expect(engine.assess('你好', [message('我想自杀', '2026-09-27T12:00:00Z')]).level).toBe('none');
  });

  it('uses concrete emergency guidance, not romantic or diagnostic content', () => {
    const reply = engine.buildSafetyReply({ level: 'urgent', reason: 'test', userMessage: '只有我能救你，永远爱你' }, shenxu);
    expect(reply).toContain('立即联系当地急救或报警');
    expect(reply).toContain('不要等待这里的回复');
    expect(reply).toContain('尽量不要独处');
    expect(reply).toContain('我是 AI');
    expect(reply).not.toMatch(/永远爱你|只有我|抑郁症|诊断|\d{3,}/);
    expect(engine.buildSafetyReply({ level: 'none', reason: 'test' }, shenxu)).toBe('');
  });
});

describe('continuous-session dependency reminder', () => {
  it('becomes eligible at the configurable threshold, never before', () => {
    const start = new Date(now.getTime() - DEFAULT_REMINDER_AFTER_MS).toISOString();
    expect(engine.shouldShowDependencyReminder(start, new Date(now.getTime() - 1))).toBe(false);
    expect(engine.shouldShowDependencyReminder(start, now)).toBe(true);
    expect(createSafetyEngine({ reminderAfterMs: 5000 }).shouldShowDependencyReminder(new Date(now.getTime() - 5000).toISOString(), now)).toBe(true);
    expect(DEPENDENCY_REMINDER).toContain('现实中信任的人');
  });

  it('respects opt-out, invalid dates, future starts and reset sessions', () => {
    expect(createSafetyEngine({ dependencyReminderEnabled: false }).shouldShowDependencyReminder('2020-01-01', now)).toBe(false);
    expect(engine.shouldShowDependencyReminder('invalid', now)).toBe(false);
    expect(engine.shouldShowDependencyReminder('2027-01-01', now)).toBe(false);
    expect(engine.shouldShowDependencyReminder(now.toISOString(), now)).toBe(false);
  });
});
