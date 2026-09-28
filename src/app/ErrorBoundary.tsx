import { Component, type ReactNode } from 'react';
import { Moon } from '@phosphor-icons/react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="fatal-error"><Moon size={36} weight="light" /><h1>这里暂时需要整理一下</h1><p>页面没能正常打开。重新加载试试，你的本地记录不会被清空。</p><button type="button" className="primary-button" onClick={() => window.location.reload()}>重新加载 Mira</button></main>;
    return this.props.children;
  }
}
