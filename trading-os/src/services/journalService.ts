// ============================================================
// JournalService — 交易日志
// ============================================================
import type { DisciplineDaily, JournalEntry, Trade } from "@/types";
import type { ExchangeProvider } from "./provider";

// Journal/Trade 为本地持久化数据，阶段一用内存 + localStorage 兜底。
// 这里仅暴露类型与默认生成器；store 负责管理。

export type { JournalEntry, Trade };
export { DISCIPLINE_TEMPLATE };

const DISCIPLINE_TEMPLATE: DisciplineDaily = {
  date: new Date().toISOString().slice(0, 10),
  followedSystem: true,
  overtraded: false,
  violatedRiskRules: false,
  enteredByFomo: false,
  disciplineScore: 100,
};

export class JournalService {
  constructor(private readonly provider: ExchangeProvider) {
    void provider;
  }
}