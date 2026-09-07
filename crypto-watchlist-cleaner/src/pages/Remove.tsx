// =============================================================
// REMOVE —— 删除池
// 上半：自动识别（Kill Switch）触发删除的币 + 删除原因
// 下半：用户手动移除的币，支持 Undo 恢复
// =============================================================
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Trash2, Undo2, RotateCcw } from "lucide-react";
import { useCryptoStore } from "../store";
import { Panel, Badge } from "../components/ui";
import { GradeBadge } from "../components/GradeBadge";
import { fmtScore, fmtTime, colorBy, fmtPct } from "../lib/utils/format";
import { KILL_REASON_LABELS } from "../lib/scoring/grade";

export default function Remove() {
  const coins = useCryptoStore((s) => s.coins);
  const removed = useCryptoStore((s) => s.removed);
  const restoreCoin = useCryptoStore((s) => s.restoreCoin);
  const snapshot = useCryptoStore((s) => s.snapshot);

  // 自动识别删除（Kill Switch 触发 C 级）
  const autoRemoved = useMemo(
    () => coins.filter((c) => c.grade === "C").sort((a, b) => a.finalScore - b.finalScore),
    [coins],
  );
  // 手动移除（可 Undo）
  const manualRemoved = useMemo(
    () => coins.filter((c) => removed[c.id]),
    [coins, removed],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Trash2 size={18} className="text-rose-400" />
        <h2 className="text-lg font-semibold text-terminal-bright">删除池 Remove</h2>
        {snapshot && (
          <span className="text-[11px] text-terminal-muted">更新 {fmtTime(snapshot.dataUpdatedAt)}</span>
        )}
      </div>

      <Panel
        title={`自动识别 · 建议删除（${autoRemoved.length}）`}
        right={<span className="text-[11px] text-terminal-muted">满足 4 项以上弱势 → C；6 项以上 → Strong C</span>}
      >
        {autoRemoved.length === 0 ? (
          <Empty />
        ) : (
          <div className="overflow-x-auto">
            <table className="quant-table w-full min-w-[760px] text-[12px]">
              <thead>
                <tr className="text-left text-terminal-muted">
                  <th className="px-2 py-2">币种</th>
                  <th className="px-2 py-2 text-right">Score</th>
                  <th className="px-2 py-2">评级</th>
                  <th className="px-2 py-2 text-right">YTD</th>
                  <th className="px-2 py-2 text-right">RS BTC</th>
                  <th className="px-2 py-2">删除原因</th>
                </tr>
              </thead>
              <tbody>
                {autoRemoved.map((c) => (
                  <tr key={c.id} className="border-t border-terminal-border/60 hover:bg-terminal-panel2">
                    <td className="px-2 py-1.5">
                      <Link to={`/coin/${c.symbol}`} className="font-semibold text-terminal-bright hover:text-emerald-400">{c.symbol}</Link>
                      <span className="ml-2 text-[10px] text-terminal-muted">{c.name}</span>
                      {c.isMeme && <Badge tone="amber" className="ml-2">Meme</Badge>}
                    </td>
                    <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-rose-400">{fmtScore(c.finalScore)}</td>
                    <td className="px-2 py-1.5"><GradeBadge grade={c.grade} strong={c.strongC} /></td>
                    <td className={`px-2 py-1.5 text-right tabular-nums ${colorBy(c.returnsPct.ytd)}`}>{fmtPct(c.returnsPct.ytd)}</td>
                    <td className={`px-2 py-1.5 text-right tabular-nums ${colorBy(c.rsBtc)}`}>{fmtPct(c.rsBtc, 0)}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex flex-wrap gap-1">
                        {c.removeReasons.slice(0, 5).map((r, i) => (
                          <span key={i} className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-400/90">{r}</span>
                        ))}
                        {c.killHits.length > 5 && (
                          <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-400/70">
                            +{c.killHits.length - 5}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title={`手动移除 · 可恢复（${manualRemoved.length}）`}>
        {manualRemoved.length === 0 ? (
          <Empty text="暂无手动移除的币种" />
        ) : (
          <div className="space-y-2">
            {manualRemoved.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-md border border-terminal-border px-3 py-2">
                <div className="flex items-center gap-3">
                  <RotateCcw size={14} className="text-terminal-muted" />
                  <div>
                    <span className="font-semibold text-terminal-bright">{c.symbol}</span>
                    <span className="ml-2 text-[10px] text-terminal-muted">{c.name}</span>
                  </div>
                  <GradeBadge grade={c.grade} strong={c.strongC} />
                </div>
                <button
                  onClick={() => restoreCoin(c.id)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[12px] text-emerald-400"
                >
                  <Undo2 size={13} /> 撤销删除
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* 删除原因图例 */}
      <Panel title="删除信号（Kill Switch）">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(KILL_REASON_LABELS) as (keyof typeof KILL_REASON_LABELS)[]).map((k) => (
            <Badge key={k} tone="slate">{KILL_REASON_LABELS[k]}</Badge>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-terminal-muted">
          满足 4 项以上 → C 级删除；6 项以上 → Strong C 强制删除。反转检测（Recovery）会豁免「近期转强」的币，避免误杀。
        </p>
      </Panel>
    </div>
  );
}

function Empty({ text = "当前没有需要删除的币" }: { text?: string }) {
  return <div className="py-8 text-center text-[12px] text-terminal-muted">{text}</div>;
}