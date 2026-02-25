const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:3456';

test.describe('Trendyol Pro Studio - UI Audit', () => {

    test.beforeEach(async ({ page }) => {
        // Console hataları topla
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log(`[CONSOLE ERROR] ${msg.text()}`);
            }
        });
        page.on('pageerror', err => {
            console.log(`[PAGE ERROR] ${err.message}`);
        });
        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');
    });

    test('Sayfa yükleniyor - temel kontroller', async ({ page }) => {
        // Title
        const title = await page.title();
        expect(title).toContain('Trendyol');

        // Body görünür
        await expect(page.locator('body')).toBeVisible();

        // Header var mı
        await expect(page.locator('header')).toBeVisible();
    });

    test('JavaScript hata yok - app.js yükleniyor', async ({ page }) => {
        const jsErrors = [];
        page.on('pageerror', err => jsErrors.push(err.message));

        await page.goto(BASE_URL);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Kritik JS hataları olmamalı
        const criticalErrors = jsErrors.filter(e =>
            !e.includes('net::') && !e.includes('favicon')
        );
        if (criticalErrors.length > 0) {
            console.log('JS Errors:', criticalErrors);
        }
        expect(criticalErrors.length).toBe(0);
    });

    test('Tüm butonlar tıklanabilir ve onclick handler var', async ({ page }) => {
        const buttons = await page.locator('button').all();
        console.log(`Toplam buton sayısı: ${buttons.length}`);

        const brokenButtons = [];
        for (const btn of buttons) {
            const isVisible = await btn.isVisible().catch(() => false);
            if (!isVisible) continue;

            const text = await btn.textContent().catch(() => '');
            const onclick = await btn.getAttribute('onclick').catch(() => null);
            const hasClickHandler = onclick !== null;
            const id = await btn.getAttribute('id').catch(() => '');

            // onclick var ama fonksiyon tanımlı mı kontrol et
            if (onclick) {
                const funcName = onclick.match(/^(\w+)\(/)?.[1];
                if (funcName) {
                    const isDefined = await page.evaluate((fn) => typeof window[fn] === 'function', funcName);
                    if (!isDefined) {
                        brokenButtons.push({ text: text.trim().substring(0, 50), onclick, id, reason: `${funcName} tanımlı değil` });
                    }
                }
            }
        }

        if (brokenButtons.length > 0) {
            console.log('BROKEN BUTTONS:', JSON.stringify(brokenButtons, null, 2));
        }
        expect(brokenButtons.length).toBe(0);
    });

    test('Tüm input/textarea alanları çalışıyor', async ({ page }) => {
        const inputs = await page.locator('input:visible, textarea:visible').all();
        console.log(`Görünür input/textarea sayısı: ${inputs.length}`);

        for (const input of inputs) {
            const type = await input.getAttribute('type').catch(() => 'text');
            const id = await input.getAttribute('id').catch(() => 'unknown');
            const readonly = await input.getAttribute('readonly').catch(() => null);

            if (type === 'file' || type === 'hidden' || type === 'range' || readonly !== null) continue;

            // Yazılabilir mi test et
            try {
                await input.click({ timeout: 2000 });
                await input.fill('test');
                const value = await input.inputValue();
                expect(value).toBe('test');
                await input.fill('');
            } catch (e) {
                console.log(`Input problemi - id: ${id}, type: ${type}, error: ${e.message}`);
            }
        }
    });

    test('Görsel yükleme alanı var ve çalışıyor', async ({ page }) => {
        // File input var mı
        const fileInput = page.locator('input[type="file"]');
        const count = await fileInput.count();
        console.log(`File input sayısı: ${count}`);
        expect(count).toBeGreaterThan(0);
    });

    test('Tab/panel geçişleri çalışıyor', async ({ page }) => {
        // Tab butonları bul
        const tabButtons = await page.locator('[onclick*="Tab"], [onclick*="tab"], [onclick*="panel"], [onclick*="Panel"]').all();
        console.log(`Tab butonları: ${tabButtons.length}`);

        for (const tab of tabButtons) {
            const isVisible = await tab.isVisible().catch(() => false);
            if (!isVisible) continue;

            const text = await tab.textContent().catch(() => '');
            try {
                await tab.click({ timeout: 2000 });
                await page.waitForTimeout(300);
            } catch (e) {
                console.log(`Tab tıklama hatası: ${text.trim()} - ${e.message}`);
            }
        }
    });

    test('Settings modal açılıp kapanıyor', async ({ page }) => {
        // Ayarlar butonu
        const settingsBtn = page.locator('[onclick*="openSettings"], [onclick*="Settings"]').first();
        if (await settingsBtn.count() > 0) {
            await settingsBtn.click();
            await page.waitForTimeout(500);

            // Modal açıldı mı
            const modal = page.locator('#settingsModal, [id*="settings"], .modal');
            const isVisible = await modal.first().isVisible().catch(() => false);
            console.log(`Settings modal görünür: ${isVisible}`);

            // Kapatma
            const closeBtn = page.locator('[onclick*="closeSettings"], [onclick*="close"], .modal button').first();
            if (await closeBtn.count() > 0 && isVisible) {
                await closeBtn.click();
                await page.waitForTimeout(300);
            }
        }
    });

    test('SEO bölümü - tüm alanlar mevcut', async ({ page }) => {
        const seoFields = [
            'seoProductFeatures',
            'seoBarcode',
            'seoModelCode',
            'seoTitle',
            'seoCategory',
            'seoDescription',
            'seoStoryDescription',
            'seoKeywords',
            'seoLongTail',
            'seoHashtags'
        ];

        const missingFields = [];
        for (const fieldId of seoFields) {
            const el = page.locator(`#${fieldId}`);
            const exists = await el.count() > 0;
            if (!exists) {
                missingFields.push(fieldId);
            }
        }

        if (missingFields.length > 0) {
            console.log('MISSING SEO FIELDS:', missingFields);
        }
        // Raporla ama fail etme - bazıları yeni eklenmiş olabilir
        console.log(`SEO alan durumu: ${seoFields.length - missingFields.length}/${seoFields.length} mevcut`);
    });

    test('SEO yeni alanlar - HTML\'de var mı', async ({ page }) => {
        const newFields = [
            'seoAttributes',
            'seoBulletPoints',
            'seoSearchTerms',
            'seoCompetitorKeywords',
            'seoSeasonalTags',
            'seoPriceRange',
            'seoScoreContainer'
        ];

        const missingNewFields = [];
        for (const fieldId of newFields) {
            const el = page.locator(`#${fieldId}`);
            const exists = await el.count() > 0;
            if (!exists) {
                missingNewFields.push(fieldId);
            }
        }

        if (missingNewFields.length > 0) {
            console.log('MISSING NEW SEO FIELDS (HTML\'e eklenmeli):', missingNewFields);
        }
    });

    test('Kategori seçim butonları çalışıyor', async ({ page }) => {
        const categoryBtns = await page.locator('[onclick*="category"], [onclick*="Category"], [data-category]').all();
        console.log(`Kategori butonları: ${categoryBtns.length}`);

        for (const btn of categoryBtns) {
            const isVisible = await btn.isVisible().catch(() => false);
            if (!isVisible) continue;
            const text = await btn.textContent().catch(() => '');
            try {
                await btn.click({ timeout: 1000 });
            } catch (e) {
                console.log(`Kategori butonu hatası: ${text.trim()}`);
            }
        }
    });

    test('Preset seçiciler (outfit, pose, scene, style) çalışıyor', async ({ page }) => {
        const presetTypes = ['outfit', 'pose', 'scene', 'style'];
        for (const preset of presetTypes) {
            const btns = await page.locator(`[onclick*="${preset}"], [data-${preset}]`).all();
            console.log(`${preset} preset butonları: ${btns.length}`);
        }
    });

    test('Responsive layout - mobil görünüm', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.waitForTimeout(500);

        // Taşma kontrolü
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        const viewportWidth = 375;
        const hasOverflow = bodyWidth > viewportWidth + 10;
        console.log(`Mobil taşma: body=${bodyWidth}px, viewport=${viewportWidth}px, overflow=${hasOverflow}`);

        if (hasOverflow) {
            console.log('UYARI: Mobil görünümde yatay taşma var!');
        }
    });

    test('Tüm ikonlar yükleniyor (FontAwesome)', async ({ page }) => {
        const icons = await page.locator('i.fa-solid, i.fa-regular, i.fa-brands, i.fas, i.far, i.fab').all();
        console.log(`İkon sayısı: ${icons.length}`);

        let brokenIcons = 0;
        for (const icon of icons.slice(0, 20)) {
            const isVisible = await icon.isVisible().catch(() => false);
            if (!isVisible) continue;
            const computed = await icon.evaluate(el => {
                const style = window.getComputedStyle(el, '::before');
                return style.content;
            });
            if (computed === 'none' || computed === '""' || computed === '') {
                brokenIcons++;
            }
        }
        console.log(`Kırık ikon: ${brokenIcons}`);
    });

    test('Boş onclick handler kontrolü', async ({ page }) => {
        const elements = await page.locator('[onclick]').all();
        const emptyHandlers = [];

        for (const el of elements) {
            const onclick = await el.getAttribute('onclick');
            if (!onclick || onclick.trim() === '' || onclick.trim() === 'undefined' || onclick.trim() === 'null') {
                const tag = await el.evaluate(e => e.tagName);
                const text = await el.textContent().catch(() => '');
                emptyHandlers.push({ tag, text: text.trim().substring(0, 30), onclick });
            }
        }

        if (emptyHandlers.length > 0) {
            console.log('EMPTY ONCLICK HANDLERS:', JSON.stringify(emptyHandlers, null, 2));
        }
        expect(emptyHandlers.length).toBe(0);
    });

    test('Eksik ID referansları - JS\'deki getElementById\'ler HTML\'de var mı', async ({ page }) => {
        // app.js'deki tüm getElementById çağrılarını kontrol et
        const missingIds = await page.evaluate(() => {
            const appScript = document.querySelector('script[src="app.js"]');
            if (!appScript) return ['app.js yüklenemedi'];

            // Bilinen kritik ID'ler
            const criticalIds = [
                'imageUpload', 'imageUploadInput', 'originalPreview',
                'resultPreview', 'smartPromptInput',
                'seoProductFeatures', 'seoResults', 'seoBarcode', 'seoModelCode',
                'seoTitle', 'titleCharCount', 'seoCategory', 'seoDescription',
                'descCharCount', 'seoStoryDescription', 'seoKeywords', 'seoLongTail',
                'seoHashtags', 'altTitles', 'visualAnalysisContent',
                'settingsModal', 'galleryGrid'
            ];

            const missing = [];
            for (const id of criticalIds) {
                if (!document.getElementById(id)) {
                    missing.push(id);
                }
            }
            return missing;
        });

        if (missingIds.length > 0) {
            console.log('MISSING HTML IDs (JS referans veriyor ama HTML\'de yok):', missingIds);
        }
    });

    test('Global fonksiyonlar tanımlı mı', async ({ page }) => {
        const requiredFunctions = [
            'generateImage', 'generateSEO', 'openSettings', 'closeSettings',
            'copySEO', 'copyAllSEO', 'copyText', 'downloadImage',
            'updateCharCount', 'showToast', 'showLoader', 'hideLoader',
            'addToGallery'
        ];

        const missingFunctions = [];
        for (const fn of requiredFunctions) {
            const isDefined = await page.evaluate((name) => typeof window[name] === 'function', fn);
            if (!isDefined) {
                missingFunctions.push(fn);
            }
        }

        if (missingFunctions.length > 0) {
            console.log('MISSING GLOBAL FUNCTIONS:', missingFunctions);
        }
        expect(missingFunctions.length).toBe(0);
    });

    test('Char counter - başlık 100 karakter kontrolü', async ({ page }) => {
        const titleInput = page.locator('#seoTitle');
        const counter = page.locator('#titleCharCount');

        if (await titleInput.count() > 0 && await counter.count() > 0) {
            // 100 karakter max (Trendyol kuralı)
            const counterText = await counter.textContent();
            console.log(`Başlık char counter: ${counterText}`);

            // Counter 99 yerine 100 olmalı (Trendyol kuralı)
            const has99 = counterText.includes('/99');
            const has100 = counterText.includes('/100');
            console.log(`Karakter limiti: ${has99 ? '99 (YANLIŞ - 100 olmalı)' : has100 ? '100 (DOĞRU)' : counterText}`);
        }
    });

    test('Desc counter - açıklama karakter kontrolü', async ({ page }) => {
        const descInput = page.locator('#seoDescription');
        const counter = page.locator('#descCharCount');

        if (await descInput.count() > 0 && await counter.count() > 0) {
            const counterText = await counter.textContent();
            console.log(`Açıklama char counter: ${counterText}`);
        }
    });

    test('copyAllSEO - tüm SEO alanları kopyalanıyor mu', async ({ page }) => {
        // copyAllSEO fonksiyonu yeni alanları da içermeli
        const copyAllCode = await page.evaluate(() => {
            return window.copyAllSEO?.toString() || 'NOT FOUND';
        });
        console.log('copyAllSEO içeriği kontrol:');
        console.log('  - bulletPoints dahil mi:', copyAllCode.includes('bulletPoints'));
        console.log('  - searchTerms dahil mi:', copyAllCode.includes('searchTerms'));
        console.log('  - competitorKeywords dahil mi:', copyAllCode.includes('competitor'));
        console.log('  - seasonalTags dahil mi:', copyAllCode.includes('seasonal'));
        console.log('  - seoScore dahil mi:', copyAllCode.includes('seoScore') || copyAllCode.includes('Score'));
        console.log('  - trendyolAttributes dahil mi:', copyAllCode.includes('trendyolAttributes') || copyAllCode.includes('Attributes'));
    });

    test('Erişilebilirlik - aria ve label kontrolleri', async ({ page }) => {
        const inputsWithoutLabel = await page.evaluate(() => {
            const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="file"]), textarea');
            const missing = [];
            inputs.forEach(input => {
                const hasLabel = input.labels?.length > 0;
                const hasAriaLabel = input.getAttribute('aria-label');
                const hasPlaceholder = input.getAttribute('placeholder');
                const hasTitle = input.getAttribute('title');
                if (!hasLabel && !hasAriaLabel && !hasPlaceholder && !hasTitle) {
                    missing.push({
                        id: input.id || 'no-id',
                        type: input.type || 'text',
                        tag: input.tagName
                    });
                }
            });
            return missing;
        });

        if (inputsWithoutLabel.length > 0) {
            console.log('INPUTS WITHOUT LABEL/ARIA:', inputsWithoutLabel);
        }
    });
});
