import { defineConfig, devices } from '@playwright/test'

const gradle = process.platform === 'win32' ? 'gradlew.bat' : './gradlew'
// 開発サーバーが 8080/5173 で動いている場合は、別ポートで独立して実行できる
const backendPort = process.env.E2E_BACKEND_PORT || '8080'
const frontendPort = process.env.E2E_FRONTEND_PORT || '5173'
const isolated = backendPort !== '8080' || frontendPort !== '5173'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${frontendPort}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `${gradle} bootRun --args="--spring.profiles.active=dev --server.port=${backendPort}"`,
      cwd: '../backend',
      url: `http://localhost:${backendPort}/actuator/health`,
      timeout: 240_000,
      reuseExistingServer: !process.env.CI && !isolated,
      env: {
        TRAININGAPP_ADMIN_USERNAME: 'e2e-admin',
        TRAININGAPP_ADMIN_PASSWORD: 'e2e-password-123',
      },
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${frontendPort} --strictPort`,
      url: `http://localhost:${frontendPort}`,
      timeout: 60_000,
      reuseExistingServer: !process.env.CI && !isolated,
      env: { VITE_BACKEND_TARGET: `http://localhost:${backendPort}` },
    },
  ],
})