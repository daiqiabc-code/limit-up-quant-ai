import ModelHealthCard from '../components/ModelHealthCard';

export default function Settings() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold">设置</h1>

      <ModelHealthCard />

      <div className="panel max-w-lg">
        <div className="panel-header"><h2 className="text-sm font-semibold">数据源</h2></div>
        <div className="panel-body space-y-4">
          <div>
            <label className="block text-sm text-terminal-dim mb-1">数据模式</label>
            <select className="w-full bg-terminal-card border border-terminal-border rounded px-3 py-2 text-sm">
              <option value="simulator">模拟器（Simulator）</option>
              <option value="akshare">AKShare（需要网络）</option>
              <option value="auto">自动切换</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-terminal-dim mb-1">模拟器种子</label>
            <input type="number" defaultValue={42}
              className="w-full bg-terminal-card border border-terminal-border rounded px-3 py-2 text-sm font-mono" />
          </div>
        </div>
      </div>

      <div className="panel max-w-lg">
        <div className="panel-header"><h2 className="text-sm font-semibold">AI 模型</h2></div>
        <div className="panel-body space-y-4">
          <div>
            <label className="block text-sm text-terminal-dim mb-1">LLM 提供商</label>
            <select className="w-full bg-terminal-card border border-terminal-border rounded px-3 py-2 text-sm">
              <option value="off">关闭（仅使用规则引擎）</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-terminal-dim mb-1">ML 重训阈值（新样本数）</label>
            <input type="number" defaultValue={30}
              className="w-full bg-terminal-card border border-terminal-border rounded px-3 py-2 text-sm font-mono" />
          </div>
        </div>
      </div>

      <div className="panel max-w-lg">
        <div className="panel-header"><h2 className="text-sm font-semibold">数据更新</h2></div>
        <div className="panel-body space-y-3 text-sm text-terminal-dim">
          <p>定时任务默认已启用（15:10/15:30/16:00/18:00/20:00）</p>
          <p>当前数据模式: <span className="text-terminal-accent">模拟器</span> — 所有数据为伪随机生成，仅供演示和原型验证</p>
        </div>
      </div>

      <div className="text-xs text-terminal-dim mt-8">
        Limit-Up Quant AI v1.0 · 用于A股短线量化研究与学习 · 不构成投资建议
      </div>
    </div>
  );
}
