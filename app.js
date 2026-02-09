/**
 * Trendyol Pro Studio v19.0
 * SEO PRO+ Edition - Çalışan Versiyon
 */

// ========== DEMO MODE ==========
let isDemoMode = false;

// Vercel API proxy base
function getProxyBase() {
    return '/api';
}
const DEMO_PROXY_BASE = getProxyBase();

function toggleDemoMode() {
    isDemoMode = document.getElementById('demoModeToggle').checked;
    localStorage.setItem('demo_mode', isDemoMode ? 'true' : 'false');

    const geminiSection = document.getElementById('geminiKeySection');
    const falSection = document.getElementById('falKeySection');
    const demoStatus = document.getElementById('demoModeStatus');

    if (isDemoMode) {
        geminiSection.classList.add('opacity-50', 'pointer-events-none');
        falSection.classList.add('opacity-50', 'pointer-events-none');
        demoStatus.classList.remove('hidden');
    } else {
        geminiSection.classList.remove('opacity-50', 'pointer-events-none');
        falSection.classList.remove('opacity-50', 'pointer-events-none');
        demoStatus.classList.add('hidden');
    }

    updateApiStatus();
}

function loadDemoMode() {
    const saved = localStorage.getItem('demo_mode');
    isDemoMode = saved === 'true';
    document.getElementById('demoModeToggle').checked = isDemoMode;
    if (isDemoMode) {
        toggleDemoMode();
    }
}

// Demo proxy ile FAL API cagirisi
async function callFalAPIProxy(endpoint, params) {
    const response = await fetch(`${DEMO_PROXY_BASE}/fal-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint, ...params })
    });

    const responseText = await response.text();
    let data;
    try {
        data = JSON.parse(responseText);
    } catch (parseError) {
        console.error('FAL Proxy non-JSON response:', responseText.substring(0, 200));
        throw new Error(`API yaniti gecersiz: ${responseText.substring(0, 100)}...`);
    }

    if (!response.ok) {
        const errMsg = typeof data.error === 'string' ? data.error
            : typeof data.detail === 'string' ? data.detail
            : JSON.stringify(data.error || data.detail || data);
        throw new Error(errMsg || 'FAL API hatasi');
    }

    return data;
}

// Demo proxy ile Gemini API cagirisi
async function callGeminiAPIProxy(model, requestBody) {
    const response = await fetch(`${DEMO_PROXY_BASE}/gemini-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, requestBody })
    });

    const responseText = await response.text();
    let data;
    try {
        data = JSON.parse(responseText);
    } catch (parseError) {
        console.error('Gemini Proxy non-JSON response:', responseText.substring(0, 200));
        throw new Error(`API yaniti gecersiz: ${responseText.substring(0, 100)}...`);
    }

    if (!response.ok) {
        const errMsg = typeof data.error === 'string' ? data.error
            : JSON.stringify(data.error || data);
        throw new Error(errMsg || 'Gemini API hatasi');
    }

    return data;
}

// Unified FAL API wrapper
async function callFalAPI(endpoint, params, falKey) {
    if (isDemoMode) {
        return callFalAPIProxy(endpoint, params);
    }

    const response = await fetch(`https://fal.run/${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Key ${falKey}`
        },
        body: JSON.stringify(params)
    });

    const responseText = await response.text();
    let data;
    try {
        data = JSON.parse(responseText);
    } catch (parseError) {
        console.error('FAL API non-JSON response:', responseText.substring(0, 200));
        throw new Error(`FAL API yaniti gecersiz: ${responseText.substring(0, 100)}...`);
    }

    if (!response.ok) {
        const errMsg = typeof data.detail === 'string' ? data.detail
            : typeof data.error === 'string' ? data.error
            : JSON.stringify(data.detail || data.error || data);
        throw new Error(errMsg || 'FAL API hatasi');
    }

    return data;
}

// ========== GEMINI MODEL CONFIG ==========
const GEMINI_CONFIG = {
    textModel: 'gemini-3-flash-preview',
    fallbackTextModel: 'gemini-2.5-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    maxRetries: 3,
    retryDelayMs: 1000
};

// Retry mekanizmasi ile API cagrisi
async function callGeminiAPI(model, body, apiKey, retries = GEMINI_CONFIG.maxRetries) {
    if (isDemoMode) {
        return callGeminiAPIProxy(model, body);
    }

    const url = `${GEMINI_CONFIG.baseUrl}/${model}:generateContent?key=${apiKey}`;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (response.ok) {
                return await response.json();
            }

            if (response.status === 429 || response.status >= 500) {
                if (attempt < retries) {
                    const delay = GEMINI_CONFIG.retryDelayMs * Math.pow(2, attempt - 1);
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }
            }

            if (response.status === 404) {
                console.log(`${model} bulunamadi, ${GEMINI_CONFIG.fallbackTextModel} deneniyor...`);
                return callGeminiAPI(GEMINI_CONFIG.fallbackTextModel, body, apiKey, 1);
            }

            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `API hatasi: ${response.status}`);

        } catch (error) {
            if (attempt === retries) throw error;
            const delay = GEMINI_CONFIG.retryDelayMs * Math.pow(2, attempt - 1);
            await new Promise(r => setTimeout(r, delay));
        }
    }
}

// ========== STATE ==========
let state = {
    originalImage: null,
    originalBase64: null,
    originalProcessedImage: null,
    templateBase64: null,
    processedImage: null,
    gallery: [],
    workMode: 'mannequin',
    settings: {
        modelProfile: 'neck_model',
        style: 'studio',
        pose: 'front',
        jewelryCategory: 'general',
        necklaceLength: 'short',
        jewelrySize: 'medium',
        outfit: 'black_vneck',
        scene: 'studio_clean',
        autoOutfit: false
    },
    position: { x: 50, y: 50, scale: 60, rotation: 0 },
    extractedJewelry: null,
    detectedProperties: null,
    seo: {
        title: '',
        altTitles: [],
        category: '',
        attributes: {},
        description: '',
        storyDescription: '',
        triggerWords: [],
        keywords: [],
        longTail: [],
        hashtags: ''
    }
};

// ========== ACCORDION ==========
function toggleAccordion(header) {
    const content = header.nextElementSibling;
    header.classList.toggle('open');
    content.classList.toggle('open');
}

// ========== IMAGE ADJUSTMENTS ==========
function applyImageAdjustments() {
    if (!state.processedImage) return;
    const brightness = parseInt(document.getElementById('brightnessSlider').value);
    const contrast = parseInt(document.getElementById('contrastSlider').value);
    const saturation = parseInt(document.getElementById('saturationSlider').value);

    document.getElementById('brightnessValue').textContent = brightness;
    document.getElementById('contrastValue').textContent = contrast;
    document.getElementById('saturationValue').textContent = saturation;

    const previewImg = document.getElementById('previewImage');
    previewImg.style.filter = `brightness(${100 + brightness}%) contrast(${100 + contrast}%) saturate(${100 + saturation}%)`;
}

function resetAdjustments() {
    document.getElementById('brightnessSlider').value = 0;
    document.getElementById('contrastSlider').value = 0;
    document.getElementById('saturationSlider').value = 0;
    document.getElementById('brightnessValue').textContent = '0';
    document.getElementById('contrastValue').textContent = '0';
    document.getElementById('saturationValue').textContent = '0';
    document.getElementById('previewImage').style.filter = '';
    if (state.originalProcessedImage) {
        state.processedImage = state.originalProcessedImage;
        document.getElementById('previewImage').src = state.processedImage;
    }
}

function applyAndSaveAdjustments() {
    if (!state.processedImage) return;
    const brightness = parseInt(document.getElementById('brightnessSlider').value);
    const contrast = parseInt(document.getElementById('contrastSlider').value);
    const saturation = parseInt(document.getElementById('saturationSlider').value);

    const img = new Image();
    img.onload = function() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.filter = `brightness(${100 + brightness}%) contrast(${100 + contrast}%) saturate(${100 + saturation}%)`;
        ctx.drawImage(img, 0, 0);
        state.processedImage = canvas.toDataURL('image/png');
        state.originalProcessedImage = state.processedImage;
        document.getElementById('previewImage').src = state.processedImage;
        document.getElementById('previewImage').style.filter = '';
        document.getElementById('brightnessSlider').value = 0;
        document.getElementById('contrastSlider').value = 0;
        document.getElementById('saturationSlider').value = 0;
        document.getElementById('brightnessValue').textContent = '0';
        document.getElementById('contrastValue').textContent = '0';
        document.getElementById('saturationValue').textContent = '0';
        showToast('Rötuş uygulandı!', 'success');
    };
    img.src = state.processedImage;
}

// ========== SEO GENERATOR ==========
async function generateSEO() {
    const geminiKey = localStorage.getItem('gemini_api_key');
    if (!geminiKey && !isDemoMode) {
        showToast('Gemini API key gerekli', 'error');
        return;
    }

    showToast('SEO Pro oluşturuluyor...', 'success');

    const productFeatures = document.getElementById('seoProductFeatures').value.trim();
    const userInputSection = productFeatures
        ? `\n\n===== KULLANICININ GİRDİĞİ ÜRÜN ÖZELLİKLERİ =====\n${productFeatures}\n\nBu özellikleri SEO içeriğinde MUTLAKA kullan!`
        : '';

    try {
        let seoData = null;

        const useFallbackSEO = async () => {
            const features = productFeatures || 'Şık tasarım kolye';
            const randomNum = Math.floor(Math.random() * 900) + 100;
            return {
                visualAnalysis: { productType: 'Kolye', metalColor: 'Gümüş', stoneType: 'Zirkon', stoneColor: 'Şeffaf', designMotif: 'Minimal', style: 'Modern', chainType: 'İnce Zincir' },
                barcode: `8680${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`,
                modelCode: `KLY-GMS-${randomNum}`,
                title: `Kadın 925 Ayar Gümüş Kolye ${features.substring(0, 50)} Şık Tasarım`,
                altTitles: [`925 Gümüş Kolye Kadın ${features.substring(0, 40)} Minimal`, `Gümüş Kadın Kolye ${features.substring(0, 40)} Trend`, `Kadın Kolye Gümüş ${features.substring(0, 40)} Zarif`],
                category: 'Takı > Kolye > Gümüş Kolye',
                description: `• 925 Ayar Gümüş\n• ${features}\n• Özel tasarım\n• Hediye paketi seçeneği`,
                storyDescription: `Bu özel tasarım kolye, her kombinle uyum sağlayan zamansız bir parça. ${features}`,
                keywords: ['kolye', 'gümüş kolye', 'kadın kolye', '925 ayar', 'hediye', 'şık', 'trend', 'moda', 'takı', 'aksesuar'],
                longTail: ['kadın gümüş kolye modelleri', '925 ayar gümüş kolye fiyatları', 'hediye kolye modelleri', 'şık kadın kolye çeşitleri', 'trend kolye modelleri 2024'],
                hashtags: '#kolye #gümüş #925ayar #kadın #trend #moda #takı #hediye #şık #trendyol'
            };
        };

        try {
            const seoRequestBody = {
                contents: [{
                    parts: [
                        { text: `SEN BİR TRENDYOL SEO UZMANSIN.

===== TRENDYOL ÜRÜN YAPISI =====
1️⃣ BAŞLIK (99 karakter) → SADECE ARAMA KELİMELERİ
2️⃣ AÇIKLAMA → Detaylı bilgi ve hikaye

===== BAŞLIK FORMÜLÜ =====
[Cinsiyet] + [Malzeme] + [Ürün Tipi] + [Taş] + [Tasarım] + [Stil]

${userInputSection}

===== JSON ÇIKTISI =====
{
    "visualAnalysis": { "productType": "", "metalColor": "", "stoneType": "", "stoneColor": "", "designMotif": "", "style": "", "chainType": "" },
    "barcode": "8680XXXXXXXXX",
    "modelCode": "KLY-RG-001",
    "title": "99 karakterlik SEO başlık",
    "altTitles": ["3 alternatif başlık"],
    "category": "Takı > Kolye",
    "description": "Teknik açıklama",
    "storyDescription": "Duygusal açıklama",
    "keywords": ["15 anahtar kelime"],
    "longTail": ["5 uzun kuyruk arama"],
    "hashtags": "#trendyol #kolye"
}

MODEL KODU: KLY (Kolye), YZK (Yüzük), BLK (Bileklik), KPE (Küpe)
RENK: RG (Rose Gold), GMS (Gümüş), ALT (Altın)

SADECE JSON döndür!` },
                        ...(state.originalBase64 ? [{ inlineData: { mimeType: 'image/jpeg', data: state.originalBase64.split(',')[1] } }] : [])
                    ]
                }],
                generationConfig: { temperature: 0.3 }
            };

            const data = await callGeminiAPI(GEMINI_CONFIG.textModel, seoRequestBody, geminiKey);
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

            let jsonStr = text;
            const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();

            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                seoData = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('JSON bulunamadı');
            }
        } catch (apiError) {
            console.warn('Gemini API hatası, fallback SEO kullanılıyor:', apiError.message);
            seoData = await useFallbackSEO();
        }

        if (!seoData) seoData = await useFallbackSEO();

        state.seo = seoData;

        // UI güncelle
        const vaContainer = document.getElementById('visualAnalysisContent');
        if (vaContainer) {
            vaContainer.innerHTML = '';
            if (seoData.visualAnalysis) {
                const labels = { productType: '📦 Ürün Tipi', metalColor: '🎨 Metal', stoneType: '💎 Taş', stoneColor: '🔮 Taş Rengi', designMotif: '✨ Tasarım', style: '🏷️ Stil', chainType: '⛓️ Zincir' };
                Object.entries(seoData.visualAnalysis).forEach(([key, value]) => {
                    if (value && value !== 'Yok' && value !== '-') {
                        const div = document.createElement('div');
                        div.className = 'bg-purple-500/10 rounded px-2 py-1';
                        div.innerHTML = `<span class="text-purple-300">${labels[key] || key}:</span> <span class="text-white">${value}</span>`;
                        vaContainer.appendChild(div);
                    }
                });
            }
        }

        document.getElementById('seoBarcode').value = seoData.barcode || '';
        document.getElementById('seoModelCode').value = seoData.modelCode || '';
        document.getElementById('seoTitle').value = seoData.title || '';
        updateCharCount('title');

        const altTitlesContainer = document.getElementById('altTitles');
        if (altTitlesContainer) {
            altTitlesContainer.innerHTML = '';
            (seoData.altTitles || []).forEach((title, idx) => {
                const div = document.createElement('div');
                div.className = 'flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-2';
                div.innerHTML = `<span class="text-slate-500 text-xs">${idx + 1}.</span><span class="flex-1 text-xs">${title}</span><button onclick="copyText('${title.replace(/'/g, "\\'")}')" class="text-emerald-400 hover:text-emerald-300"><i class="fa-solid fa-copy text-xs"></i></button>`;
                altTitlesContainer.appendChild(div);
            });
        }

        document.getElementById('seoCategory').value = seoData.category || '';
        document.getElementById('seoDescription').value = seoData.description || '';
        updateCharCount('desc');
        document.getElementById('seoStoryDescription').textContent = seoData.storyDescription || '';

        const keywordsContainer = document.getElementById('seoKeywords');
        if (keywordsContainer) {
            keywordsContainer.innerHTML = '';
            (seoData.keywords || []).forEach(kw => {
                const tag = document.createElement('span');
                tag.className = 'px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full cursor-pointer hover:bg-emerald-500/30';
                tag.textContent = kw;
                tag.onclick = () => copyText(kw);
                keywordsContainer.appendChild(tag);
            });
        }

        const longTailContainer = document.getElementById('seoLongTail');
        if (longTailContainer) {
            longTailContainer.innerHTML = '';
            (seoData.longTail || []).forEach(lt => {
                const div = document.createElement('div');
                div.className = 'flex items-center gap-2 bg-blue-500/10 rounded-lg px-3 py-2';
                div.innerHTML = `<i class="fa-solid fa-magnifying-glass text-blue-400 text-[10px]"></i><span class="flex-1 text-xs text-blue-300">${lt}</span><button onclick="copyText('${lt.replace(/'/g, "\\'")}')" class="text-blue-400 hover:text-blue-300"><i class="fa-solid fa-copy text-xs"></i></button>`;
                longTailContainer.appendChild(div);
            });
        }

        document.getElementById('seoHashtags').textContent = seoData.hashtags || '';
        document.getElementById('seoPlaceholder').classList.add('hidden');
        document.getElementById('seoResults').classList.remove('hidden');

        showToast('SEO Pro oluşturuldu!', 'success');

    } catch (error) {
        console.error('SEO error:', error);
        showToast('SEO oluşturulamadı: ' + error.message, 'error');
    }
}

function updateCharCount(type) {
    if (type === 'title') {
        const title = document.getElementById('seoTitle').value;
        const counter = document.getElementById('titleCharCount');
        counter.textContent = `${title.length}/99`;
        counter.className = title.length > 99 ? 'text-red-400' : 'text-emerald-400';
    } else if (type === 'desc') {
        const desc = document.getElementById('seoDescription').value;
        const counter = document.getElementById('descCharCount');
        counter.textContent = `${desc.length}/500`;
        counter.className = desc.length > 500 ? 'text-red-400' : 'text-emerald-400';
    }
}

function copyText(text) {
    navigator.clipboard.writeText(text).then(() => showToast('Kopyalandı!', 'success'));
}

function copySEO(type) {
    let text = '';
    if (type === 'title') text = document.getElementById('seoTitle').value;
    else if (type === 'description') text = document.getElementById('seoDescription').value;
    else if (type === 'story') text = state.seo.storyDescription || '';
    else if (type === 'keywords') text = state.seo.keywords?.join(', ') || '';
    else if (type === 'category') text = document.getElementById('seoCategory').value;
    else if (type === 'hashtags') text = state.seo.hashtags || '';
    else if (type === 'barcode') text = document.getElementById('seoBarcode').value;
    else if (type === 'modelCode') text = document.getElementById('seoModelCode').value;
    navigator.clipboard.writeText(text).then(() => showToast('Kopyalandı!', 'success'));
}

function copyAllSEO() {
    const seo = state.seo;
    if (!seo || !seo.title) { showToast('Önce SEO oluşturun', 'error'); return; }
    const allText = `TRENDYOL SEO\n\nBARKOD: ${seo.barcode}\nMODEL KODU: ${seo.modelCode}\n\nBAŞLIK:\n${seo.title}\n\nALTERNATİF BAŞLIKLAR:\n${(seo.altTitles || []).join('\n')}\n\nKATEGORİ: ${seo.category}\n\nAÇIKLAMA:\n${seo.description}\n\nHİKAYE:\n${seo.storyDescription}\n\nANAHTAR KELİMELER:\n${(seo.keywords || []).join(', ')}\n\nHASHTAGS:\n${seo.hashtags}`;
    navigator.clipboard.writeText(allText).then(() => showToast('Tümü kopyalandı!', 'success'));
}

// ========== POSITION CONTROLS ==========
function updatePositionValue(type) {
    if (type === 'y') { state.position.y = parseInt(document.getElementById('yOffsetSlider').value); document.getElementById('yOffsetValue').textContent = state.position.y + '%'; }
    else if (type === 'x') { state.position.x = parseInt(document.getElementById('xOffsetSlider').value); document.getElementById('xOffsetValue').textContent = state.position.x + '%'; }
    else if (type === 'scale') { state.position.scale = parseInt(document.getElementById('scaleSlider').value); document.getElementById('scaleValue').textContent = state.position.scale + '%'; }
    else if (type === 'rotation') { state.position.rotation = parseInt(document.getElementById('rotationSlider').value); document.getElementById('rotationValue').textContent = state.position.rotation + '°'; }
    updateInteractivePreview();
}

let interactiveImages = { template: null, jewelry: null };

function moveJewelry(direction) {
    const step = 2;
    if (direction === 'up') state.position.y = Math.max(0, state.position.y - step);
    else if (direction === 'down') state.position.y = Math.min(100, state.position.y + step);
    else if (direction === 'left') state.position.x = Math.max(0, state.position.x - step);
    else if (direction === 'right') state.position.x = Math.min(100, state.position.x + step);
    syncSlidersWithState();
    updateInteractivePreview();
}

function rotateJewelry(degrees) {
    state.position.rotation += degrees;
    if (state.position.rotation > 180) state.position.rotation -= 360;
    if (state.position.rotation < -180) state.position.rotation += 360;
    syncSlidersWithState();
    updateInteractivePreview();
}

function scaleJewelry(delta) {
    state.position.scale = Math.max(10, Math.min(150, state.position.scale + delta));
    syncSlidersWithState();
    updateInteractivePreview();
}

function syncSlidersWithState() {
    document.getElementById('xOffsetSlider').value = state.position.x;
    document.getElementById('xOffsetValue').textContent = state.position.x + '%';
    document.getElementById('yOffsetSlider').value = state.position.y;
    document.getElementById('yOffsetValue').textContent = state.position.y + '%';
    document.getElementById('scaleSlider').value = state.position.scale;
    document.getElementById('scaleValue').textContent = state.position.scale + '%';
    document.getElementById('rotationSlider').value = state.position.rotation;
    document.getElementById('rotationValue').textContent = state.position.rotation + '°';
}

function updateInteractivePreview() {
    if (!state.templateBase64 || !state.extractedJewelry) return;
    const canvas = document.getElementById('interactiveCanvas');
    const ctx = canvas.getContext('2d');
    if (!interactiveImages.template || !interactiveImages.jewelry) { loadInteractiveImages(); return; }
    const templateImg = interactiveImages.template;
    const jewelryImg = interactiveImages.jewelry;
    canvas.width = templateImg.width;
    canvas.height = templateImg.height;
    ctx.drawImage(templateImg, 0, 0);
    const pos = state.position;
    const jewelryWidth = templateImg.width * (pos.scale / 100);
    const jewelryHeight = (jewelryImg.height / jewelryImg.width) * jewelryWidth;
    const x = (templateImg.width * (pos.x / 100)) - (jewelryWidth / 2);
    const y = (templateImg.height * (pos.y / 100)) - (jewelryHeight / 2);
    const rotation = (pos.rotation || 0) * Math.PI / 180;
    ctx.save();
    ctx.translate(x + jewelryWidth / 2, y + jewelryHeight / 2);
    ctx.rotate(rotation);
    ctx.drawImage(jewelryImg, -jewelryWidth / 2, -jewelryHeight / 2, jewelryWidth, jewelryHeight);
    ctx.restore();
}

function loadInteractiveImages() {
    if (!state.templateBase64 || !state.extractedJewelry) return;
    const templateImg = new Image();
    const jewelryImg = new Image();
    let loaded = 0;
    const onLoad = () => { loaded++; if (loaded === 2) { interactiveImages.template = templateImg; interactiveImages.jewelry = jewelryImg; updateInteractivePreview(); } };
    templateImg.onload = onLoad;
    jewelryImg.onload = onLoad;
    templateImg.src = state.templateBase64;
    jewelryImg.src = state.extractedJewelry;
}

function showInteractivePreview() {
    if (!state.templateBase64 || !state.extractedJewelry) return;
    document.getElementById('previewPlaceholder').classList.add('hidden');
    document.getElementById('previewImage').classList.add('hidden');
    document.getElementById('interactiveCanvas').classList.remove('hidden');
    document.getElementById('positionControls').classList.remove('hidden');
    loadInteractiveImages();
}

function hideInteractivePreview() {
    document.getElementById('interactiveCanvas').classList.add('hidden');
    document.getElementById('positionControls').classList.add('hidden');
}

function setupCanvasDrag() {
    const canvas = document.getElementById('interactiveCanvas');
    let isDragging = false;
    canvas.addEventListener('mousedown', () => { isDragging = true; canvas.style.cursor = 'grabbing'; });
    canvas.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const rect = canvas.getBoundingClientRect();
        state.position.x = Math.round((e.clientX - rect.left) / rect.width * 100);
        state.position.y = Math.round((e.clientY - rect.top) / rect.height * 100);
        state.position.x = Math.max(0, Math.min(100, state.position.x));
        state.position.y = Math.max(0, Math.min(100, state.position.y));
        syncSlidersWithState();
        updateInteractivePreview();
    });
    canvas.addEventListener('mouseup', () => { isDragging = false; canvas.style.cursor = 'move'; });
    canvas.addEventListener('mouseleave', () => { isDragging = false; canvas.style.cursor = 'move'; });
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); scaleJewelry(e.deltaY > 0 ? -3 : 3); });
}

function setupKeyboardControls() {
    document.addEventListener('keydown', (e) => {
        const canvas = document.getElementById('interactiveCanvas');
        if (canvas.classList.contains('hidden')) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        switch(e.key) {
            case 'ArrowUp': moveJewelry('up'); e.preventDefault(); break;
            case 'ArrowDown': moveJewelry('down'); e.preventDefault(); break;
            case 'ArrowLeft': moveJewelry('left'); e.preventDefault(); break;
            case 'ArrowRight': moveJewelry('right'); e.preventDefault(); break;
        }
    });
}

// ========== PREVIEW ==========
async function previewJewelryPlacement() {
    if (!state.originalBase64) { showToast('Önce ürün yükleyin', 'error'); return; }
    if (!state.templateBase64) { showToast('Önce model şablonu yükleyin', 'error'); return; }
    const falKey = localStorage.getItem('fal_api_key');
    if (!falKey && !isDemoMode) { showToast('Fal.ai API key gerekli', 'error'); openSettings(); return; }

    try {
        showLoader('Önizleme hazırlanıyor...', 'Takı çıkarılıyor');
        const birefnetData = await callFalAPI('fal-ai/birefnet', { image_url: state.originalBase64, model: "General Use (Light)", operating_resolution: "1024x1024", output_format: "png", refine_foreground: true }, falKey);
        const transparentJewelryUrl = birefnetData.image?.url;
        if (!transparentJewelryUrl) throw new Error('Takı çıkarılamadı');
        state.extractedJewelry = await fetchImageAsBase64(transparentJewelryUrl);
        interactiveImages = { template: null, jewelry: null };
        hideLoader();
        showInteractivePreview();
        showToast('Önizleme hazır!', 'success');
    } catch (error) {
        console.error('Preview error:', error);
        hideLoader();
        showToast('Önizleme hatası: ' + error.message, 'error');
    }
}

// ========== PRESETS ==========
const modelProfiles = {
    'neck_model': { desc: "Jewelry Photography: Headless cropped shot focusing on neck.", info: "Kolye Odaklı", category: "general" },
    'hand_model': { desc: "Hand jewelry photography: Elegant female hands.", info: "El Modeli", category: "general" },
    'set_model': { desc: "Jewelry set photography: Female model from shoulders up.", info: "Set Modeli", category: "general" },
    'boho_model': { desc: "Bohemian lifestyle jewelry photography.", info: "Bohem Modeli", category: "general" }
};

const stylePresets = {
    'studio': { prompt: "Commercial Studio Photography. Pure white background." },
    'boho': { prompt: "Bohemian Aesthetic. Warm earth tones." },
    'luxury': { prompt: "Luxury Dark Mode. Black background." }
};

const outfitPresets = {
    'black_vneck': { name: "Siyah V-Yaka", prompt: "Black V-neck top." },
    'white_off': { name: "Beyaz Straplez", prompt: "White off-shoulder top." },
    'cream_silk': { name: "Krem İpek", prompt: "Cream silk blouse." },
    'burgundy': { name: "Bordo", prompt: "Burgundy top." },
    'navy': { name: "Lacivert", prompt: "Navy blue top." },
    'nude': { name: "Ten Rengi", prompt: "Nude colored top." },
    'forest': { name: "Koyu Yeşil", prompt: "Forest green top." },
    'none': { name: "Yok", prompt: "Bare shoulders." }
};

const scenePresets = {
    'studio_clean': { name: "Stüdyo", prompt: "Professional studio." },
    'romantic': { name: "Romantik", prompt: "Romantic atmosphere." },
    'luxury_dark': { name: "Lüks Dark", prompt: "Luxurious dark setting." },
    'golden_hour': { name: "Golden Hour", prompt: "Golden hour sunlight." },
    'minimalist': { name: "Minimal", prompt: "Ultra-minimalist setting." },
    'editorial': { name: "Editorial", prompt: "High-fashion editorial." },
    'nature': { name: "Doğal", prompt: "Natural organic setting." },
    'festive': { name: "Şık Gece", prompt: "Festive evening." }
};

const posePresets = {
    'front': { name: "Önden", prompt: "Front view." },
    'right': { name: "Sağ Profil", prompt: "Right side profile." },
    'left': { name: "Sol Profil", prompt: "Left side profile." },
    'down': { name: "Aşağı Bakış", prompt: "Looking down." },
    'closeup': { name: "Yakın Çekim", prompt: "Close-up shot." },
    'surface': { name: "Düz Yüzey", prompt: "Flat lay on surface." }
};

// ========== INIT ==========
window.onload = () => {
    loadSettings();
    setupDragDrop();
    setupTemplateUpload();
    setupCanvasDrag();
    setupKeyboardControls();
};

function setupTemplateUpload() {
    const dropZone = document.getElementById('templateDropZone');
    const input = document.getElementById('templateInput');
    dropZone.onclick = () => input.click();
    input.onchange = (e) => { if (e.target.files[0]) handleTemplateFile(e.target.files[0]); };
    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('border-cyan-500'); };
    dropZone.ondragleave = () => { dropZone.classList.remove('border-cyan-500'); };
    dropZone.ondrop = (e) => { e.preventDefault(); dropZone.classList.remove('border-cyan-500'); if (e.dataTransfer.files[0]) handleTemplateFile(e.dataTransfer.files[0]); };
}

function handleTemplateFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        state.templateBase64 = e.target.result;
        document.getElementById('templatePlaceholder').classList.add('hidden');
        document.getElementById('templatePreview').classList.remove('hidden');
        document.getElementById('templateImage').src = e.target.result;
        document.getElementById('templateName').textContent = file.name;
        showToast('Model şablonu yüklendi!', 'success');
    };
    reader.readAsDataURL(file);
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.target.closest('.tab-btn').classList.add('active');
    document.getElementById('studioTab').classList.toggle('hidden', tab !== 'studio');
    document.getElementById('galleryTab').classList.toggle('hidden', tab !== 'gallery');
}

function loadSettings() {
    const geminiKey = localStorage.getItem('gemini_api_key');
    const falKey = localStorage.getItem('fal_api_key');
    if (geminiKey) document.getElementById('geminiKeyInput').value = geminiKey;
    if (falKey) document.getElementById('falKeyInput').value = falKey;
    loadDemoMode();
    updateApiStatus();
}

function updateApiStatus() {
    if (isDemoMode) {
        document.getElementById('apiDot').className = 'w-2 h-2 rounded-full bg-orange-500';
        document.getElementById('apiStatus').textContent = 'Demo Modu Aktif';
        return;
    }
    const hasGemini = localStorage.getItem('gemini_api_key');
    const hasFal = localStorage.getItem('fal_api_key');
    if (hasGemini && hasFal) {
        document.getElementById('apiDot').className = 'w-2 h-2 rounded-full bg-green-500';
        document.getElementById('apiStatus').textContent = 'Hibrit Mod Hazır';
    } else {
        document.getElementById('apiDot').className = 'w-2 h-2 rounded-full bg-red-500';
        document.getElementById('apiStatus').textContent = 'API Key Gerekli';
    }
}

function openSettings() { document.getElementById('settingsModal').classList.remove('hidden'); }
function closeSettings() { document.getElementById('settingsModal').classList.add('hidden'); }

function saveSettings() {
    const geminiKey = document.getElementById('geminiKeyInput').value.trim();
    const falKey = document.getElementById('falKeyInput').value.trim();
    if (geminiKey) localStorage.setItem('gemini_api_key', geminiKey);
    if (falKey) localStorage.setItem('fal_api_key', falKey);
    updateApiStatus();
    closeSettings();
    showToast('Ayarlar kaydedildi!', 'success');
}

function setupDragDrop() {
    const dropZone = document.getElementById('dropZone');
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e => { dropZone.addEventListener(e, (ev) => { ev.preventDefault(); ev.stopPropagation(); }, false); });
    ['dragenter', 'dragover'].forEach(e => { dropZone.addEventListener(e, () => dropZone.classList.add('border-orange-500', 'bg-orange-500/10'), false); });
    ['dragleave', 'drop'].forEach(e => { dropZone.addEventListener(e, () => dropZone.classList.remove('border-orange-500', 'bg-orange-500/10'), false); });
    dropZone.addEventListener('drop', (e) => { const file = e.dataTransfer.files[0]; if (file && file.type.startsWith('image/')) processFile(file); }, false);
}

function handleUpload(e) { const file = e.target.files[0]; if (file) processFile(file); }

function processFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        state.originalBase64 = e.target.result;
        const img = new Image();
        img.onload = () => {
            state.originalImage = img;
            state.originalWidth = img.width;
            state.originalHeight = img.height;
            state.isHighRes = img.width >= 1500 || img.height >= 1500;
            document.getElementById('uploadPrompt').classList.add('hidden');
            document.getElementById('uploadPreviewContainer').classList.remove('hidden');
            document.getElementById('uploadPreview').src = state.originalBase64;
            document.getElementById('fileName').textContent = `${file.name} (${img.width}x${img.height})`;
            showToast('Ürün yüklendi', 'success');
        };
        img.src = state.originalBase64;
    };
    reader.readAsDataURL(file);
}

function selectJewelryCategory(category) {
    state.settings.jewelryCategory = category;
    document.querySelectorAll('.jewelry-cat-btn').forEach(btn => { btn.classList.toggle('active', btn.dataset.cat === category); });
    document.querySelectorAll('.model-card').forEach(card => { card.classList.toggle('hidden', card.dataset.category !== category); });
}

function selectModelProfile(profile) {
    state.settings.modelProfile = profile;
    document.querySelectorAll('.model-card:not(.hidden)').forEach(c => c.classList.remove('selected'));
    document.querySelector(`[data-model="${profile}"]`)?.classList.add('selected');
    document.getElementById('modelProfileDesc').innerHTML = '<i class="fa-solid fa-info-circle mr-1"></i>' + modelProfiles[profile].info;
}

function selectStyle(style) {
    state.settings.style = style;
    document.querySelectorAll('.style-card').forEach(c => c.classList.remove('selected'));
    document.querySelector(`[data-style="${style}"]`)?.classList.add('selected');
}

function selectPose(pose) {
    state.settings.pose = pose;
    document.querySelectorAll('.pose-card').forEach(c => c.classList.remove('selected'));
    document.querySelector(`[data-pose="${pose}"]`)?.classList.add('selected');
}

function selectOutfit(outfit) {
    state.settings.outfit = outfit;
    document.querySelectorAll('.outfit-card').forEach(c => c.classList.remove('selected'));
    document.querySelector(`[data-outfit="${outfit}"]`)?.classList.add('selected');
}

function selectScene(scene) {
    state.settings.scene = scene;
    document.querySelectorAll('.scene-card').forEach(c => c.classList.remove('selected'));
    document.querySelector(`[data-scene="${scene}"]`)?.classList.add('selected');
}

function toggleAutoOutfit() {
    state.settings.autoOutfit = !state.settings.autoOutfit;
    const btn = document.getElementById('autoOutfitBtn');
    const dot = document.getElementById('autoOutfitDot');
    const manualSection = document.getElementById('manualOutfitSection');
    const autoResult = document.getElementById('autoOutfitResult');
    if (state.settings.autoOutfit) {
        btn.classList.remove('bg-slate-600'); btn.classList.add('bg-pink-600');
        dot.classList.remove('bg-slate-400', 'left-0.5'); dot.classList.add('bg-white', 'left-5');
        manualSection.classList.add('hidden'); autoResult.classList.remove('hidden');
    } else {
        btn.classList.add('bg-slate-600'); btn.classList.remove('bg-pink-600');
        dot.classList.add('bg-slate-400', 'left-0.5'); dot.classList.remove('bg-white', 'left-5');
        manualSection.classList.remove('hidden'); autoResult.classList.add('hidden');
    }
}

function addSmartPrompt(text) {
    const input = document.getElementById('smartPromptInput');
    input.value = input.value.trim() ? input.value.trim() + ', ' + text : text;
}

function getSmartPromptInstructions() {
    const smartPrompt = document.getElementById('smartPromptInput')?.value?.trim() || '';
    return smartPrompt ? `\n\nUSER INSTRUCTIONS: ${smartPrompt}` : '';
}

function getOutfitScenePrompt() {
    if (state.settings.autoOutfit) return 'AI will choose complementary outfit and scene.';
    const outfit = outfitPresets[state.settings.outfit];
    const scene = scenePresets[state.settings.scene];
    return `${outfit?.prompt || ''} ${scene?.prompt || ''}`;
}

// ========== MAIN GENERATION ==========
async function generateImage() {
    const falKey = localStorage.getItem('fal_api_key');
    if (!falKey && !isDemoMode) { openSettings(); showToast('Fal.ai API Key gerekli', 'error'); return; }
    if (!state.originalBase64) { showToast('Önce ürün yükleyin', 'error'); return; }

    showLoader('Profesyonel fotoğraf oluşturuluyor...', 'Product Photography API');

    try {
        const profile = modelProfiles[state.settings.modelProfile];
        const style = stylePresets[state.settings.style];
        const pose = posePresets[state.settings.pose];
        const outfitScene = getOutfitScenePrompt();
        const smartPrompt = getSmartPromptInstructions();

        const sceneDescription = `${profile?.desc || ''} ${style?.prompt || ''} ${pose?.prompt || ''} ${outfitScene} ${smartPrompt} Professional jewelry photography.`;

        const productPhotoData = await callFalAPI('fal-ai/image-apps-v2/product-photography', {
            product_image_url: state.originalBase64,
            scene_description: sceneDescription,
            optimize_description: true
        }, falKey);

        const imageUrl = productPhotoData.image?.url || productPhotoData.images?.[0]?.url;
        if (!imageUrl) throw new Error('Görsel oluşturulamadı');

        const resultBase64 = await fetchImageAsBase64(imageUrl);
        state.processedImage = resultBase64;
        state.originalProcessedImage = resultBase64;

        document.getElementById('previewPlaceholder').classList.add('hidden');
        document.getElementById('previewImage').classList.remove('hidden');
        document.getElementById('previewImage').src = state.processedImage;
        document.getElementById('downloadActions').classList.remove('hidden');
        document.getElementById('editPanel').classList.remove('hidden');

        hideLoader();
        showToast('Profesyonel fotoğraf oluşturuldu!', 'success');
        generateSEO();

    } catch (error) {
        console.error('Generation error:', error);
        hideLoader();
        showToast('Hata: ' + error.message, 'error');
    }
}

async function fetchImageAsBase64(url) {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
}

// ========== GALLERY ==========
function addToGallery() {
    if (!state.processedImage) return;
    const emptySlotIndex = state.gallery.findIndex(g => !g);
    if (emptySlotIndex === -1 && state.gallery.length >= 4) { showToast('Galeri dolu!', 'error'); return; }
    const slotIndex = emptySlotIndex !== -1 ? emptySlotIndex : state.gallery.length;
    state.gallery[slotIndex] = state.processedImage;
    updateMiniGallery();
    showToast(`Slot ${slotIndex + 1}'e eklendi`, 'success');
}

function updateMiniGallery() {
    const slots = document.querySelectorAll('.gallery-slot');
    slots.forEach((slot, index) => {
        if (state.gallery[index]) {
            slot.innerHTML = `<img src="${state.gallery[index]}" class="w-full h-full object-cover rounded-lg">`;
            slot.onclick = () => showGalleryImage(index);
        } else {
            slot.innerHTML = '<i class="fa-solid fa-plus text-slate-600"></i>';
            slot.onclick = null;
        }
    });
}

function showGalleryImage(index) {
    if (state.gallery[index]) {
        document.getElementById('previewImage').src = state.gallery[index];
        document.getElementById('previewImage').classList.remove('hidden');
        document.getElementById('previewPlaceholder').classList.add('hidden');
        state.processedImage = state.gallery[index];
        document.getElementById('downloadActions').classList.remove('hidden');
    }
}

function clearGallery() {
    state.gallery = [];
    updateMiniGallery();
    showToast('Galeri temizlendi', 'success');
}

// ========== DOWNLOAD ==========
function downloadImage(format) {
    if (!state.processedImage) return;
    const link = document.createElement('a');
    link.download = `trendyol_pro_${Date.now()}.${format}`;
    if (format === 'png') {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height;
            canvas.getContext('2d').drawImage(img, 0, 0);
            link.href = canvas.toDataURL('image/png');
            link.click();
        };
        img.src = state.processedImage;
    } else {
        link.href = state.processedImage;
        link.click();
    }
    showToast(`${format.toUpperCase()} indirildi`, 'success');
}

// ========== LOADER & TOAST ==========
function showLoader(text, subtext) {
    document.getElementById('previewLoader').classList.remove('hidden');
    document.getElementById('loaderText').textContent = text;
    document.getElementById('loaderSubtext').textContent = subtext || 'Lütfen bekleyin';
}

function hideLoader() { document.getElementById('previewLoader').classList.add('hidden'); }

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const icon = document.getElementById('toastIcon');
    document.getElementById('toastMessage').textContent = message;
    icon.className = type === 'success' ? 'fa-solid fa-check-circle text-green-400 text-xl' : 'fa-solid fa-exclamation-circle text-red-400 text-xl';
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}
