import Link from "next/link";
import { Activity, Code2, AtSign, Send } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-line bg-bg-canvas/60">
      <div className="mx-auto max-w-[1480px] px-4 py-10 lg:px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          <div className="col-span-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-signal/30 bg-signal/10">
                <Activity className="h-4 w-4 text-signal" />
              </span>
              <div className="flex flex-col leading-none">
                <span className="font-display text-sm font-bold text-ink-high">CryptoPulse</span>
                <span className="text-[9px] uppercase tracking-[0.2em] text-signal/80">AI · Intelligence</span>
              </div>
            </div>
            <p className="mt-3 max-w-xs text-sm text-ink-low">
              过去24小时最值得关注的中文 Crypto 信息，由 AI 自动筛选、聚类、分析、验证与持续追踪。
            </p>
            <div className="mt-4 flex items-center gap-2">
              <a className="btn-ghost h-8 w-8 !p-0" href="#"><AtSign className="h-4 w-4" /></a>
              <a className="btn-ghost h-8 w-8 !p-0" href="#"><Send className="h-4 w-4" /></a>
              <a className="btn-ghost h-8 w-8 !p-0" href="#"><Code2 className="h-4 w-4" /></a>
            </div>
          </div>
          <FooterCol title="终端" links={[["情报终端", "/"], ["AI 信号", "/#signals"], ["事件聚类", "/#events"], ["AI 日报", "/daily"]]} />
          <FooterCol title="数据库" links={[["KOL 排行", "/kols"], ["热门项目", "/projects"], ["市场情绪", "/sentiment"], ["事件追踪", "/events"]]} />
          <FooterCol title="系统" links={[["AI 搜索", "/search"], ["后台管理", "/admin"], ["API 文档", "#"], ["状态", "#"]]} />
        </div>
        <div className="mt-8 flex flex-col items-start justify-between gap-3 border-t border-line pt-5 text-xs text-ink-low sm:flex-row sm:items-center">
          <span>© 2026 CryptoPulse · 仅供研究与信息聚合，非投资建议</span>
          <span className="font-mono">数据更新于 {new Date().toISOString().slice(0, 10)} · AI 解读可能存在偏差</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div className="mb-3 text-2xs font-semibold uppercase tracking-wider text-ink-faint">{title}</div>
      <ul className="space-y-2">
        {links.map(([l, h]) => (
          <li key={l}>
            <Link href={h} className="text-sm text-ink-low transition-colors hover:text-signal">
              {l}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
