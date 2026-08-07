"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, CornerDownLeft, X } from "lucide-react";
import { events, kols, projects } from "@/lib/data";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "今天ETH发生什么？",
  "最近谁预测最准？",
  "最近有哪些重大事件？",
  "BTC资金流情况",
  "哪些KOL在看多ETH",
  "Hyperliquid热度分析",
];

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const router = useRouter();
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!openRef.current);
      }
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) {
      setQ("");
      setActive(0);
    }
  }, [open]);

  const ql = q.trim().toLowerCase();
  const evRes = ql
    ? events.filter((e) => (e.title + e.summary + e.assets.join("")).toLowerCase().includes(ql)).slice(0, 3)
    : [];
  const kolRes = ql
    ? kols.filter((k) => (k.name + k.handle + k.tags.join("")).toLowerCase().includes(ql)).slice(0, 3)
    : [];
  const projRes = ql
    ? projects.filter((p) => (p.name + p.symbol).toLowerCase().includes(ql)).slice(0, 3)
    : [];
  const items = [
    ...evRes.map((e) => ({ type: "事件", label: e.title, href: `/events/${e.id}` })),
    ...kolRes.map((k) => ({ type: "KOL", label: k.name, href: `/kols/${k.id}` })),
    ...projRes.map((p) => ({ type: "项目", label: `${p.symbol} · ${p.name}`, href: `/search?q=${p.symbol}` })),
  ];
  const total = items.length;

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const askAI = () => {
    onOpenChange(false);
    router.push(`/search?q=${encodeURIComponent(q || SUGGESTIONS[0])}`);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(total, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active === 0 || !items[active - 1]) askAI();
      else go(items[active - 1].href);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-bg-panel shadow-float animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <Search className="h-4 w-4 text-signal" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKey}
            placeholder="用自然语言搜索：今天ETH发生什么？"
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-low focus:outline-none"
          />
          <kbd className="chip text-[10px]"><X className="h-3 w-3" /></kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-2">
          {/* AI Ask */}
          <button
            onClick={askAI}
            className={cn(
              "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
              active === 0 ? "bg-bg-hover" : "hover:bg-bg-hover"
            )}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-signal/30 bg-signal/10 text-signal">
              <Search className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-ink">询问 AI</div>
              <div className="truncate text-xs text-ink-low">
                {q ? `“${q}”` : "输入问题，AI 返回事件、推文、KOL、项目与总结"}
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-ink-low transition-transform group-hover:translate-x-0.5" />
          </button>

          {total > 0 && (
            <div className="mt-1 px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-ink-faint">
              匹配结果
            </div>
          )}
          {items.map((it, i) => (
            <button
              key={it.href + i}
              onClick={() => go(it.href)}
              onMouseEnter={() => setActive(i + 1)}
              className={cn(
                "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                active === i + 1 ? "bg-bg-hover" : "hover:bg-bg-hover"
              )}
            >
              <span className="chip-signal text-[10px]">{it.type}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink-mid">{it.label}</span>
              {active === i + 1 && <CornerDownLeft className="h-3.5 w-3.5 text-ink-low" />}
            </button>
          ))}

          {total === 0 && (
            <div className="mt-1 px-3 py-2">
              <div className="mb-2 text-2xs font-semibold uppercase tracking-wider text-ink-faint">
                试试问
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setQ(s)}
                    className="rounded-full border border-line bg-bg-elevated px-2.5 py-1 text-xs text-ink-mid transition-colors hover:border-signal/40 hover:text-signal"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line px-4 py-2 text-2xs text-ink-low">
          <div className="flex items-center gap-3">
            <span><kbd className="font-mono">↑↓</kbd> 导航</span>
            <span><kbd className="font-mono">↵</kbd> 选择</span>
          </div>
          <span className="text-signal">CryptoPulse AI</span>
        </div>
      </div>
    </div>
  );
}
