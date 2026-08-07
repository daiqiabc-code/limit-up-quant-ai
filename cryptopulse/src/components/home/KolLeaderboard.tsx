"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Trophy, ArrowUpRight, Medal, Crown } from "lucide-react";
import { kols } from "@/lib/data";
import type { KOL } from "@/lib/types";
import { SectionHeader, Panel } from "@/components/ui/Section";
import { Sparkline } from "@/components/ui/Sparkline";
import { ScoreRing } from "@/components/ui/Gauge";
import { DirectionBadge } from "@/components/ui/Badges";
import { cn, fmtCompact } from "@/lib/utils";

export function KolLeaderboard() {
  const sorted = [...kols].sort((a, b) => b.trustScore - a.trustScore);

  return (
    <section id="kols" className="scroll-mt-24">
      <SectionHeader
        index="04"
        icon={<Trophy className="h-4 w-4" />}
        title="热门 KOL 排行榜"
        subtitle="基于 Trust / Influence / Accuracy 三维评分 · 长期画像与命中率追踪"
        action={
          <Link href="/kols" className="btn-ghost h-8 text-xs">
            KOL 数据库 <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        }
      />

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sorted.slice(0, 9).map((k, i) => (
          <KolCard key={k.id} kol={k} rank={i + 1} />
        ))}
      </div>
    </section>
  );
}

function rankBadge(rank: number) {
  if (rank === 1) return { icon: Crown, cls: "text-warn border-warn/40 bg-warn/10" };
  if (rank === 2) return { icon: Medal, cls: "text-ink-mid border-line-strong bg-bg-elevated" };
  if (rank === 3) return { icon: Medal, cls: "text-warn/70 border-warn/30 bg-warn/5" };
  return { icon: null, cls: "text-ink-low border-line bg-bg-elevated" };
}

function KolCard({ kol, rank }: { kol: KOL; rank: number }) {
  const rb = rankBadge(rank);
  const RankIcon = rb.icon;
  const trustColor = kol.trustScore >= 85 ? "#2EE6A6" : kol.trustScore >= 75 ? "#16E6C8" : "#FFB020";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, delay: rank * 0.03 }}
    >
      <Link href={`/kols/${kol.id}`}>
        <Panel hover className="group flex h-full flex-col p-4">
          <div className="flex items-start gap-3">
            <div className="relative">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-gradient-to-br from-bg-elevated to-bg-base font-display text-sm font-bold text-signal">
                {kol.avatar}
              </div>
              {RankIcon ? (
                <span className={cn("absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border", rb.cls)}>
                  <RankIcon className="h-2.5 w-2.5" />
                </span>
              ) : (
                <span className={cn("absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border font-mono text-2xs font-bold", rb.cls)}>
                  {rank}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="truncate font-semibold text-ink-high group-hover:text-signal">{kol.name}</h3>
              </div>
              <div className="truncate font-mono text-2xs text-ink-low">{kol.handle}</div>
              <div className="mt-0.5 flex items-center gap-2 text-2xs text-ink-faint">
                <span>{fmtCompact(kol.followers)} 粉丝</span>
                <span>·</span>
                <span>{kol.posts} 文</span>
              </div>
            </div>

            <ScoreRing value={kol.trustScore} size={44} stroke={4} color={trustColor} label="Trust" />
          </div>

          {/* score row */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <ScoreCell label="Trust" value={kol.trustScore} color="#2EE6A6" />
            <ScoreCell label="Influence" value={kol.influenceScore} color="#5B9DFF" />
            <ScoreCell label="Accuracy" value={kol.accuracyScore} color="#A78BFA" />
          </div>

          {/* bull/bear + hitrate */}
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1">
              <div className="mb-1 flex justify-between text-2xs text-ink-low">
                <span>看多 {kol.bullRatio}%</span>
                <span>看空 {kol.bearRatio}%</span>
              </div>
              <div className="flex h-1.5 overflow-hidden rounded-full bg-bear/20">
                <div className="h-full bg-bull" style={{ width: `${kol.bullRatio}%` }} />
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xs text-ink-low">命中率</div>
              <div className="font-mono text-sm font-bold text-signal tnum">{kol.hitRate}%</div>
            </div>
          </div>

          {/* recent view */}
          <div className="mt-3 rounded-lg border border-line bg-bg-base/50 p-2.5">
            <div className="mb-1 flex items-center gap-1 text-2xs text-ink-faint">
              <span className="text-signal">▍</span> 最近观点
            </div>
            <p className="line-clamp-2 text-2xs leading-relaxed text-ink-mid">{kol.recentView}</p>
          </div>

          {kol.topCall && (
            <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
              <span className="text-2xs text-ink-low">
                代表作 <span className="chip-signal text-[10px]">{kol.topCall.asset}</span>
              </span>
              <DirectionBadge direction={kol.topCall.direction} size="xs" />
              <span className={cn("font-mono text-2xs font-semibold tnum", kol.topCall.return >= 0 ? "text-bull" : "text-bear")}>
                {kol.topCall.return >= 0 ? "+" : ""}{kol.topCall.return}%
              </span>
            </div>
          )}
        </Panel>
      </Link>
    </motion.div>
  );
}

function ScoreCell({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-line bg-bg-base/40 px-2 py-1.5 text-center">
      <div className="text-2xs text-ink-low">{label}</div>
      <div className="font-mono text-base font-bold tnum" style={{ color }}>{value}</div>
    </div>
  );
}
