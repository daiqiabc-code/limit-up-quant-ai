# Crypto Watchlist Cleaner · 加密货币自选清洗器

> **注意力过滤器**：从 1000+ 个加密货币中，自动判断哪些值得继续关注（S/A/B），哪些应该删除（C），最终把注意力压缩到真正值得每天看的币。

核心思想不是「寻找所有能买的币」，而是「快速删除不值得浪费时间的币」。

```
1000+ Coins → Data Cleaning → Weakness Filter → Multi-Factor Score → 200
  → Relative Strength → 100 → Narrative + Money Flow → 50 → S/A/B/C → 20 → 10 → Top 3
```

---

## ✨ 功能特性

- **多因子评分**：Price Strength(20) + Volume(15) + Holder(15) + Smart Money(15) + Narrative(15) + Attention(10) + Catalyst(10)，总分 100。
- **C 级 Kill Switch**：10 项弱势条件，命中 ≥4 → C（删除），≥6 → Strong C（强制删除），并给出「为什么删除」。
- **Recovery 反转检测**：避免「YTD 为负就删除」的误杀，识别「长期弱、近期强」的反转币。
- **S 级硬条件选币**：趋势 + RS vs BTC + 量价 + Holder + 资金 + 叙事 + 催化，多条件同时满足才进 S。
- **Meme 专用模型 + Robinhood Chain Scanner**：独立评分，链上风险（开发者抛售、捆绑钱包、集中度、LP）纳入惩罚。
- **主表格**：Bloomberg / TradingView 风格，排序、多条件过滤、搜索、收藏、删除、标签、CSV 导出。
- **AI / 规则引擎摘要**：每个币生成「为什么强 / 为什么弱 / 当前阶段 / 资金 / 风险 / 建议」，所有判断引用实际指标。
- **Watchlist + Alert**：Core / Swing / Meme / New Narrative / Robinhood 五类自选；数据与价格预警。
- **专业量化终端 UI**：深色主题、高信息密度、表格优先、响应式设计。

---

## 🚀 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器（默认 http://localhost:4010）
npm run dev

# 3. 生产构建
npm run build

# 4. 预览构建产物
npm run preview
```

**无需任何 API Key 即可运行**：默认使用内置 Mock / Demo 数据（1050 个币），页面顶部会明确标记「Demo 数据 / 模拟」。

---

## 🔑 环境变量

复制 `.env.example` 为 `.env.local` 并按需填写：

| 变量 | 说明 | 默认 |
| --- | --- | --- |
| `VITE_DATA_SOURCE` | 数据源：`mock` / `coingecko` / `binance` / `okx` / `dexscreener` | `mock` |
| `VITE_COINGECKO_API_KEY` | CoinGecko API Key | 空 |
| `VITE_CMC_API_KEY` | CoinMarketCap API Key | 空 |
| `VITE_BINANCE_API_URL` | Binance API 地址 | `https://data-api.binance.vision` |
| `VITE_DEXSCREENER_API_URL` | DexScreener API 地址 | `https://api.dexscreener.com` |
| `VITE_AI_API_URL` / `VITE_AI_API_KEY` | AI 分析接口（缺省用本地规则引擎） | 空 |
| `VITE_REFRESH_INTERVAL_SECONDS` | 刷新间隔（秒） | `300` |

> 未配置真实数据源或调用失败（限频 / 空数据 / 网络错误）时，应用会**自动回退到 Mock 数据并显式标记 Demo**，绝不把模拟数据伪装成实时数据。

---

## 🏗️ 架构

数据层、评分层、UI 层严格分离，层间通过 `TokenRaw` / `ScoredCoin` / `MarketSnapshot` 等类型契约通信。

```
src/
├── lib/
│   ├── types.ts           # 跨层类型定义
│   ├── config/            # 权重 / 阈值 / 过滤器 / 叙事标签（全部可配置）
│   ├── data/              # 数据层：Mock 生成器 + 各数据源 Provider + 统一回退
│   ├── scoring/           # 评分层：七因子 + 相对强度 + 惩罚 + Kill Switch + 分级 + Meme + AI
│   └── utils/             # 格式化工具
├── store/                 # 全局状态（zustand，用户态持久化）
├── components/            # UI 原语 + 主表格 + 分级徽章
└── pages/                 # Dashboard / Top20 / Market / Grades / Remove / Watchlist / Alerts / CoinDetail
```

### 数据层（`lib/data/`）

统一 `TokenProvider` 接口，`providers/index.ts` 的 `loadRawTokens()` 负责数据源选择与回退。接入新数据源只需新增一个 `implements TokenProvider` 的类。

### 评分层（`lib/scoring/`）

每个评分公式独立成模块，权重集中在 `config/weights.ts`，阈值集中在 `config/thresholds.ts`。修改评分规则无需改动 UI 层。

---

## 🧮 评分与分级逻辑

**最终分 = 七因子得分 + 惩罚（负值）**

- **惩罚**：长期弱 / RS 弱 / 量缩 / Holder 降 / 资金流出 / 无叙事 / 无催化，额外扣分（上限 25 分）。
- **分级**：S ≥ 80、A ≥ 68、B ≥ 52；Kill Switch 命中 ≥4 → C，≥6 → Strong C。
- **S 级候选**：价格 > MA20、RS vs BTC > 0、成交量 24H/30D > 1.5、Holder 24H > 0、Smart Money 净流入、Narrative > 70、Catalyst > 50，满足 ≥6 项。
- **Recovery 反转**：YTD < 0 但 7D / 30D / 量 / Holder / 资金 / 叙事近期明显转强（≥4 项）→ 不删除，进入反转观察区。

---

## 📄 目录与数据更新时间

- 所有实时数据在页面顶栏与首页底部显示 **数据源 + 是否 Demo + 更新时间**。
- CSV 导出带 BOM，Excel 打开中文不乱码。

---

## ⚠️ 免责声明

本项目仅用于研究与学习，不构成任何投资建议。所有评分与「建议」均由公开数据或模拟数据经规则引擎计算得出，不代表对未来走势的预测。加密货币投资风险极高，请独立决策。

---

## 🛠️ 技术栈

- **前端**：React 19 + TypeScript + Vite + Tailwind CSS + Recharts
- **状态**：Zustand（persist 持久化用户自选/收藏/删除）
- **路由**：React Router 7
- **数据源**（可插拔）：CoinGecko / Binance / OKX / DexScreener / Birdeye / GMGN