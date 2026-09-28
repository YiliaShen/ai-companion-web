// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../../contracts';
import { personas } from '../../core/personas';
import { Composer } from './Composer';
import { MessageStream } from './MessageStream';

afterEach(cleanup);

describe('chat composition', () => {
  it('ignores Enter while composing Chinese text, sends once, and preserves a failed draft', async () => {
    const onSend = vi.fn().mockResolvedValue(false);
    render(<Composer name="沈叙" sending={false} onSend={onSend} onStop={vi.fn()} />);
    const textbox = screen.getByRole('textbox', { name: '给沈叙的消息' });
    fireEvent.change(textbox, { target: { value: '  今天有些累  ' } });
    fireEvent.keyDown(textbox, { key: 'Enter', isComposing: true, keyCode: 229 });
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(textbox, { key: 'Enter', keyCode: 13 });
    await waitFor(() => expect(onSend).toHaveBeenCalledExactlyOnceWith('今天有些累'));
    expect(textbox).toHaveValue('  今天有些累  ');
  });

  it('lets an emotion shortcut fill a draft and clears only after a successful send', async () => {
    const onSend = vi.fn().mockResolvedValue(true);
    render(<Composer name="林澈" sending={false} onSend={onSend} onStop={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '睡不着' }));
    expect(screen.getByRole('textbox')).toHaveValue('还没睡着，想找你说说话。');
    fireEvent.click(screen.getByRole('button', { name: '发送消息' }));
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(''));
    expect(onSend).toHaveBeenCalledExactlyOnceWith('还没睡着，想找你说说话。');
  });

  it('exposes a stop action throughout streaming and disables shortcuts', () => {
    const onStop = vi.fn();
    render(<Composer name="沈叙" sending onSend={vi.fn()} onStop={onStop} />);
    expect(screen.getByRole('button', { name: '有点累' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: '发送消息' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '停止回复' }));
    expect(onStop).toHaveBeenCalledOnce();
  });
});

describe('conversation stream', () => {
  it('renders user, assistant, system and photo messages, and opens the selected photo', () => {
    const base = { conversationId: 'conversation-1', createdAt: '2026-09-28T12:00:00Z', status: 'sent' as const };
    const messages: ChatMessage[] = [
      { ...base, id: 'user', role: 'user', kind: 'text', text: '想看看海边' },
      { ...base, id: 'system', role: 'system', kind: 'system', text: '新的记忆已保存' },
      { ...base, id: 'assistant', role: 'assistant', kind: 'text', text: '一起听听海风。' },
      { ...base, id: 'photo', role: 'assistant', kind: 'selfie', text: '', imageUrl: 'assets/scenes/seaside.jpg', imageCaption: '今天的海' },
    ];
    const onPhoto = vi.fn();
    render(<MessageStream messages={messages} persona={personas.shenxu} sending={false} reducedMotion onRetry={vi.fn()} onPhoto={onPhoto} />);
    expect(screen.getByRole('log')).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByText('新的记忆已保存')).toBeVisible();
    expect(screen.getByText('一起听听海风。')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '查看照片：今天的海' }));
    expect(onPhoto).toHaveBeenCalledExactlyOnceWith(messages[3]);
  });
});
