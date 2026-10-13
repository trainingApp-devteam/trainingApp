import { defineConfig, devices } from '@playwright/test'

const gradle = process.platform === 'win32' ? 'gradlew.bat' : './gradlew'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `${gradle} bootRun --args=--spring.profiles.active=dev`,
      cwd: '../backend',
      url: 'http://localhost:8080/actuator/health',
      timeout: 240_000,
      reuseExistingServer: !process.env.CI,
      env: {
        TRAININGAPP_ADMIN_USERNAME: 'e2e-admin',
        TRAININGAPP_ADMIN_PASSWORD: 'e2e-password-123',
      },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
      url: 'http://localhost:5173',
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
})