import { Heart, Lifebuoy, X } from '@phosphor-icons/react';
import type { SafetyDecision } from '../contracts';

export function SafetyBanner({ decision, dependencyReminder, onDismiss }: { decision: SafetyDecision; dependencyReminder: boolean; onDismiss: () => void }) {
  if (decision.level === 'none' && !dependencyReminder) return null;
  const urgent = decision.level === 'urgent';
  return <aside className={`safety-banner ${urgent ? 'safety-urgent' : ''}`} role={urgent ? 'alert' : 'status'}>
    {urgent ? <Lifebuoy size={24} /> : <Heart size={22} />}
    <div><strong>{urgent ? '先照顾好此刻的安全' : decision.level === 'watch' ? '这些感受，不必独自扛着' : '也给屏幕之外的自己一点时间'}</strong>
      <p>{urgent ? '如果你可能马上伤害自己或他人，请远离危险物品，联系身边信任的人和当地急救。中国大陆可拨 120 / 110，心理援助可拨 12356。' : decision.userMessage || (decision.level === 'watch' ? '可以找一个信任的人陪着你。Mira 能听你说，但不能替代专业心理支持。' : '起身喝点水，看看窗外，或给信任的人发条消息。这里的对话可以随时继续。')}</p>
      {urgent && <div className="safety-links"><a href="tel:120">拨打 120</a><a href="tel:12356">心理援助 12356</a></div>}
    </div>
    {!urgent && <button type="button" className="icon-button" onClick={onDismiss} aria-label="收起提醒"><X size={18} /></button>}
  </aside>;
}
