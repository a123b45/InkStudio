import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'work.inkstudio.app',
  appName: '墨坊 InkStudio',
  webDir: 'dist',
  server: {
    // 开发调试时可取消注释，让 App 加载本机 Vite（手机与电脑同一 WiFi）
    // url: 'http://192.168.x.x:5173',
    // cleartext: true,
    androidScheme: 'https',
  },
  android: {
    // IP + HTTP API 阶段需允许明文；切 HTTPS 域名后可改回 false
    allowMixedContent: true,
  },
};

export default config;
