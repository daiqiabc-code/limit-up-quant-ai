/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  // 纯静态导出：可在 GitHub Pages / 任意静态托管上运行（行情改为浏览器直连 Binance）
  output: "export",
  // GitHub Pages 以仓库子路径托管，需保持路由与静态资源前缀一致
  basePath: "/limit-up-quant-ai",
  assetPrefix: "/limit-up-quant-ai/",
};

export default nextConfig;