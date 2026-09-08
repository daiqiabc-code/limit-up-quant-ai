// =============================================================
// 真实 LLM 客户端（OpenAI 兼容 chat/completions 接口）
// 兼容 OpenAI / DeepSeek / Qwen / Moonshot / Ollama 等端点。
// 未配置 VITE_AI_API_URL 时 isAiConfigured() = false，调用方回退规则引擎。
// =============================================================

const API_URL = (import.meta.env.VITE_AI_API_URL as string | undefined) ?? "";
const API_KEY = import.meta.env.VITE_AI_API_KEY as string | undefined;
const MODEL = (import.meta.env.VITE_AI_MODEL as string | undefined) || "gpt-4o-mini";
const TIMEOUT_MS = 30_000;

export function isAiConfigured(): boolean {
  return API_URL.trim().length > 0;
}

/** 归一化端点：兼容 base（自动补 /chat/completions）或完整地址 */
function endpoint(): string {
  const u = API_URL.trim();
  if (/\/chat\/completions\/?$/i.test(u)) return u;
  return u.replace(/\/+$/, "") + "/chat/completions";
}

export interface ChatOptions {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}

/** 发起一次 chat/completions 请求，返回助手文本内容 */
export async function chatCompletion(o: ChatOptions): Promise<string> {
  if (!isAiConfigured()) {
    throw new Error("未配置 VITE_AI_API_URL");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(endpoint(), {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: o.system },
          { role: "user", content: o.user },
        ],
        temperature: o.temperature ?? 0.3,
        max_tokens: o.maxTokens ?? 800,
        stream: false,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`AI 接口返回 ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: unknown } }[];
    };
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("AI 接口未返回内容");
    }
    return content;
  } finally {
    clearTimeout(timer);
  }
}

/** 从模型输出中稳健提取 JSON（兼容 markdown 围栏 / 前后杂文） */
export function extractJson<T>(text: string): T {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    /* continue */
  }
  const obj = cleaned.match(/\{[\s\S]*\}/);
  if (obj) {
    try {
      return JSON.parse(obj[0]) as T;
    } catch {
      /* continue */
    }
  }
  const arr = cleaned.match(/\[[\s\S]*\]/);
  if (arr) {
    try {
      return JSON.parse(arr[0]) as T;
    } catch {
      /* continue */
    }
  }
  throw new Error("无法解析 AI 返回的 JSON");
}

/** 请求并解析为 JSON 对象 */
export async function chatJson<T>(o: ChatOptions): Promise<T> {
  return extractJson<T>(await chatCompletion(o));
}