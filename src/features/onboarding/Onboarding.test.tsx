// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { personas } from '../../core/personas';
import { Onboarding } from './Onboarding';

afterEach(cleanup);

describe('onboarding persona selection', () => {
  it('opens the explicitly selected persona and discloses the AI identity', async () => {
    const onSelect = vi.fn().mockResolvedValue(true);
    render(<Onboarding personas={personas} onSelect={onSelect} />);
    expect(screen.getByText(/三位都是 AI 陪伴角色/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /江野.*刚下课/ }));
    expect(screen.getByRole('button', { name: /江野.*刚下课/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '和江野聊聊' }));
    await waitFor(() => expect(onSelect).toHaveBeenCalledExactlyOnceWith('jiangye'));
  });

  it('keeps the selection and offers another attempt when opening fails', async () => {
    const onSelect = vi.fn().mockResolvedValue(false);
    render(<Onboarding personas={personas} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: '和沈叙聊聊' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('这次没能进入');
    expect(screen.getByRole('button', { name: '和沈叙聊聊' })).toBeEnabled();
  });
});
