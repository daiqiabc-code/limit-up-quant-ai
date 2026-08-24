import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(n: number, digits?: number): string {
  if (n >= 10000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 100) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: digits ?? 3 });
  return n.toLocaleString("en-US", { maximumFractionDigits: digits ?? 5 });
}

export function formatUsd(n: number, digits = 0): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const v =
    abs >= 1e6
      ? (abs / 1e6).toFixed(1) + "M"
      : abs >= 1e3
        ? (abs / 1e3).toFixed(1) + "K"
        : abs.toFixed(digits);
  return sign + "$" + v;
}

export function formatPct(n: number, digits = 2): string {
  const sign = n > 0 ? "+" : "";
  return sign + n.toFixed(digits) + "%";
}

export function formatSignedPct(n: number, digits = 2): string {
  const sign = n > 0 ? "+" : "";
  return sign + n.toFixed(digits) + "%";
}

export function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return "now";
  if (sec < 60) return `${sec} sec ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  return `${hr} hr ago`;
}

export function tfAgo(ts: number): string {
  // 中文时间
  const diff = Math.max(0, Date.now() - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec} 秒前`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  return `${day} 天前`;
}