const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests',
    timeout: 30000,
    retries: 0,
    reporter: 'list',
    use: {
        baseURL: 'http://localhost:3456',
        headless: true,
        launchOptions: {
            executablePath: '/root/.cache/ms-playwright/chromium-1194/chrome-linux/chrome',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--no-proxy-server']
        }
    }
});
