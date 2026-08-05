import { useState } from 'react';
import { X, Send, Bot } from 'lucide-react';
import { api } from '../lib/api';

export default function ChatBot({ onClose }: { onClose: () => void }) {
  const [msgs, setMsgs] = useState<{ role: string; text: string }[]>([
    { role: 'bot', text: '你好！我是 Limit-Up Quant AI 助手。\n\n可以问我：\n• 今天哪些股票值得关注？\n• 为什么XX排第一？\n• 当前市场情绪如何？\n• 今天哪些股票风险最大？' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setMsgs(prev => [...prev, { role: 'user', text: msg }]);
    setInput('');
    setLoading(true);
    try {
      const res = await api.chat(msg);
      setMsgs(prev => [...prev, { role: 'bot', text: res.reply }]);
    } catch {
      setMsgs(prev => [...prev, { role: 'bot', text: '抱歉，AI 服务暂时不可用。' }]);
    }
    setLoading(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 w-96 h-[500px] bg-terminal-panel border border-terminal-border rounded-xl shadow-2xl flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-terminal-border bg-terminal-card rounded-t-xl">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-terminal-accent" />
          <span className="text-sm font-semibold">AI 助手</span>
        </div>
        <button onClick={onClose} className="text-terminal-dim hover:text-terminal-text"><X size={16} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {msgs.map((m, i) => (
          <div key={i} className={`text-sm ${m.role === 'user' ? 'text-right' : ''}`}>
            <div className={`inline-block max-w-[85%] px-3 py-2 rounded-lg whitespace-pre-wrap ${
              m.role === 'user'
                ? 'bg-terminal-accent/20 text-terminal-text'
                : 'bg-terminal-card text-terminal-text'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && <div className="text-xs text-terminal-dim">AI 正在思考...</div>}
      </div>
      <div className="p-3 border-t border-terminal-border flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="输入问题..."
          className="flex-1 bg-terminal-card border border-terminal-border rounded-lg px-3 py-2 text-sm text-terminal-text placeholder-terminal-dim focus:outline-none focus:border-terminal-accent/50"
        />
        <button onClick={send} disabled={loading}
          className="bg-terminal-accent/15 text-terminal-accent border border-terminal-accent/30 rounded-lg px-3 hover:bg-terminal-accent/25 transition-colors">
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
