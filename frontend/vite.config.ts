import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 相对路径 —— 保证部署到任意子路径 / 静态托管都能正确加载资源与快照
  base: './',
  server: {
    port: 4007,
    strictPort: true, // 端口已锁定给本项目，被占用时直接报错而不是静默换端口
    proxy: {
      '/api': 'http://localhost:8008',
    },
  },
  build: {
    outDir: 'dist',
    // 由构建脚本负责清理，避免 Windows 安全删除钩子拦截 vite 的 emptyDir
    emptyOutDir: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          charts: ['echarts', 'echarts-for-react'],
        },
      },
    },
  },
});
