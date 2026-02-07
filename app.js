/**
 * Trendyol Pro Studio v19.0
 * Professional Jewelry Photography & AI Enhancement Platform
 */

// ============================================
// 1. DEMO MODE SISTEMI
// ============================================

let isDemoMode = false;

function toggleDemoMode() {
    isDemoMode = !isDemoMode;
    const demoBtn = document.getElementById('demoModeBtn');
    const demoStatus = document.getElementById('demoStatus');

    if (demoBtn) {
        demoBtn.classList.toggle('active', isDemoMode);
        demoBtn.textContent = isDemoMode ? 'Demo Mode: ON' : 'Demo Mode: OFF';
    }

    if (demoStatus) {
        demoStatus.textContent = isDemoMode ? 'Demo Mode Active' : '';
        demoStatus.style.display = isDemoMode ? 'block' : 'none';
    }

    localStorage.setItem('demoMode', isDemoMode);
    showToast(isDemoMode ? 'Demo Mode activated - Using Vercel API Proxy' : 'Demo Mode deactivated - Using direct API calls', 'info');
}

function loadDemoMode() {
    const savedDemoMode = localStorage.getItem('demoMode');
    if (savedDemoMode === 'true') {
        isDemoMode = true;
        const demoBtn = document.getElementById('demoModeBtn');
        if (demoBtn) {
            demoBtn.classList.add('active');
            demoBtn.textContent = 'Demo Mode: ON';
        }
    }
}

// ============================================
// 2. API CAGRI FONKSIYONLARI
// ============================================

// Demo modunda Fal.ai proxy cagrisi
async function callFalAPIProxy(endpoint, payload) {
    const response = await fetch('/api/fal-proxy', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            endpoint: endpoint,
            payload: payload
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Fal API Proxy error: ${response.status}`);
    }

    return await response.json();
}

// Demo modunda Gemini proxy cagrisi
async function callGeminiAPIProxy(payload) {
    const response = await fetch('/api/gemini-proxy', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Gemini API Proxy error: ${response.status}`);
    }

    return await response.json();
}

// Unified Fal API wrapper
async function callFalAPI(endpoint, payload, apiKey) {
    // Demo modunda proxy kullan
    if (isDemoMode) {
        return await callFalAPIProxy(endpoint, payload);
    }

    // Normal modda direkt API cagrisi
    const response = await fetch(`https://fal.run/${endpoint}`, {
        method: 'POST',
        headers: {
            'Authorization': `Key ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.message || `Fal API error: ${response.status}`);
    }

    return await response.json();
}

// Unified Gemini API wrapper (retry mekanizmali)
async function callGeminiAPI(prompt, apiKey, options = {}) {
    const maxRetries = options.maxRetries || geminiConfig.maxRetries;
    const retryDelayMs = options.retryDelayMs || geminiConfig.retryDelayMs;
    let currentModel = options.model || geminiConfig.textModel;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            let result;

            if (isDemoMode) {
                // Demo modunda proxy kullan
                result = await callGeminiAPIProxy({
                    prompt: prompt,
                    model: currentModel
                });
            } else {
                // Normal modda direkt API cagrisi
                const url = `${geminiConfig.baseUrl}/${currentModel}:generateContent?key=${apiKey}`;

                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: prompt
                            }]
                        }],
                        generationConfig: {
                            temperature: options.temperature || 0.7,
                            maxOutputTokens: options.maxTokens || 2048
                        }
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error?.message || `Gemini API error: ${response.status}`);
                }

                result = await response.json();
            }

            // Basarili sonuc
            if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
                return result.candidates[0].content.parts[0].text;
            }

            throw new Error('Invalid response format from Gemini API');

        } catch (error) {
            lastError = error;
            console.warn(`Gemini API attempt ${attempt} failed:`, error.message);

            // Son deneme degilse ve fallback model varsa
            if (attempt < maxRetries) {
                // Fallback modele gec
                if (currentModel === geminiConfig.textModel && geminiConfig.fallbackTextModel) {
                    console.log(`Switching to fallback model: ${geminiConfig.fallbackTextModel}`);
                    currentModel = geminiConfig.fallbackTextModel;
                }

                // Bekle ve tekrar dene
                await new Promise(resolve => setTimeout(resolve, retryDelayMs * attempt));
            }
        }
    }

    throw lastError || new Error('Gemini API failed after all retries');
}

// ============================================
// 3. GEMINI CONFIG
// ============================================

const geminiConfig = {
    textModel: 'gemini-2.0-flash',
    fallbackTextModel: 'gemini-1.5-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    maxRetries: 3,
    retryDelayMs: 1000
};

// ============================================
// 4. STATE YONETIMI
// ============================================

const state = {
    originalImage: null,
    originalBase64: null,
    processedImage: null,
    templateImage: null,
    templateBase64: null,
    gallery: [],
    settings: {
        falApiKey: '',
        geminiApiKey: '',
        autoEnhance: true,
        watermark: false,
        outputQuality: 'high',
        outputFormat: 'png'
    },
    position: {
        x: 50,
        y: 50,
        scale: 100,
        rotation: 0
    },
    seo: {
        title: '',
        description: '',
        keywords: '',
        tags: ''
    },
    selectedCategory: 'necklace',
    selectedModel: 'neck_model',
    selectedStyle: 'studio',
    selectedPose: 'front',
    selectedOutfit: 'black_vneck',
    selectedScene: 'studio_clean',
    autoOutfit: true,
    currentPrompt: '',
    isProcessing: false,
    interactiveMode: false
};

// ============================================
// 5. UI FONKSIYONLARI
// ============================================

function toggleAccordion(header) {
    const accordion = header.parentElement;
    const content = accordion.querySelector('.accordion-content');
    const icon = header.querySelector('.accordion-icon');

    accordion.classList.toggle('active');

    if (accordion.classList.contains('active')) {
        content.style.maxHeight = content.scrollHeight + 'px';
        if (icon) icon.style.transform = 'rotate(180deg)';
    } else {
        content.style.maxHeight = '0';
        if (icon) icon.style.transform = 'rotate(0deg)';
    }
}

function switchTab(tabId, group = 'main') {
    // Sekme butonlarini guncelle
    const tabBtns = document.querySelectorAll(`.tab-btn[data-group="${group}"]`);
    tabBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabId) {
            btn.classList.add('active');
        }
    });

    // Tab iceriklerini guncelle
    const tabContents = document.querySelectorAll(`.tab-content[data-group="${group}"]`);
    tabContents.forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
        if (content.id === tabId) {
            content.classList.add('active');
            content.style.display = 'block';
        }
    });
}

function openSettings() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.style.display = 'flex';
        // API anahtarlarini inputlara yukle
        document.getElementById('falApiKeyInput').value = state.settings.falApiKey || '';
        document.getElementById('geminiApiKeyInput').value = state.settings.geminiApiKey || '';
    }
}

function closeSettings() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function saveSettings() {
    const falKey = document.getElementById('falApiKeyInput')?.value?.trim() || '';
    const geminiKey = document.getElementById('geminiApiKeyInput')?.value?.trim() || '';

    state.settings.falApiKey = falKey;
    state.settings.geminiApiKey = geminiKey;

    // LocalStorage'a kaydet
    localStorage.setItem('falApiKey', falKey);
    localStorage.setItem('geminiApiKey', geminiKey);

    updateApiStatus();
    closeSettings();
    showToast('Settings saved successfully!', 'success');
}

function loadSettings() {
    // LocalStorage'dan yukle
    state.settings.falApiKey = localStorage.getItem('falApiKey') || '';
    state.settings.geminiApiKey = localStorage.getItem('geminiApiKey') || '';
    state.settings.autoEnhance = localStorage.getItem('autoEnhance') !== 'false';
    state.settings.watermark = localStorage.getItem('watermark') === 'true';
    state.settings.outputQuality = localStorage.getItem('outputQuality') || 'high';
    state.settings.outputFormat = localStorage.getItem('outputFormat') || 'png';

    // Demo mode'u yukle
    loadDemoMode();

    // API durumunu guncelle
    updateApiStatus();
}

function updateApiStatus() {
    const falStatus = document.getElementById('falApiStatus');
    const geminiStatus = document.getElementById('geminiApiStatus');

    if (falStatus) {
        if (isDemoMode) {
            falStatus.innerHTML = '<span class="status-dot demo"></span> Demo Mode';
            falStatus.className = 'api-status demo';
        } else if (state.settings.falApiKey) {
            falStatus.innerHTML = '<span class="status-dot connected"></span> Connected';
            falStatus.className = 'api-status connected';
        } else {
            falStatus.innerHTML = '<span class="status-dot disconnected"></span> Not Connected';
            falStatus.className = 'api-status disconnected';
        }
    }

    if (geminiStatus) {
        if (isDemoMode) {
            geminiStatus.innerHTML = '<span class="status-dot demo"></span> Demo Mode';
            geminiStatus.className = 'api-status demo';
        } else if (state.settings.geminiApiKey) {
            geminiStatus.innerHTML = '<span class="status-dot connected"></span> Connected';
            geminiStatus.className = 'api-status connected';
        } else {
            geminiStatus.innerHTML = '<span class="status-dot disconnected"></span> Not Connected';
            geminiStatus.className = 'api-status disconnected';
        }
    }
}

function showLoader(message = 'Processing...') {
    let loader = document.getElementById('globalLoader');

    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'globalLoader';
        loader.className = 'global-loader';
        loader.innerHTML = `
            <div class="loader-content">
                <div class="loader-spinner"></div>
                <p class="loader-message">${message}</p>
            </div>
        `;
        document.body.appendChild(loader);
    } else {
        loader.querySelector('.loader-message').textContent = message;
    }

    loader.style.display = 'flex';
    state.isProcessing = true;
}

function hideLoader() {
    const loader = document.getElementById('globalLoader');
    if (loader) {
        loader.style.display = 'none';
    }
    state.isProcessing = false;
}

function showToast(message, type = 'info') {
    // Mevcut toast'lari temizle
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '⚠' : 'ℹ'}</span>
            <span class="toast-message">${message}</span>
        </div>
    `;

    document.body.appendChild(toast);

    // Animasyon icin timeout
    setTimeout(() => toast.classList.add('show'), 10);

    // 3 saniye sonra kaldir
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ============================================
// 6. UPLOAD & TEMPLATE
// ============================================

function setupDragDrop() {
    const dropZone = document.getElementById('dropZone');
    if (!dropZone) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('drag-over');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('drag-over');
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleUpload({ target: { files: files } });
        }
    }, false);

    // Click to upload
    dropZone.addEventListener('click', () => {
        const input = document.getElementById('imageInput');
        if (input) input.click();
    });
}

function handleUpload(event) {
    const file = event.target.files[0];
    if (file) {
        processFile(file);
    }
}

function processFile(file) {
    if (!file.type.startsWith('image/')) {
        showToast('Please upload an image file', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        state.originalImage = e.target.result;
        state.originalBase64 = e.target.result;

        // Preview'i guncelle
        const preview = document.getElementById('originalPreview');
        if (preview) {
            preview.src = e.target.result;
            preview.style.display = 'block';
        }

        // Drop zone'u gizle
        const dropZone = document.getElementById('dropZone');
        const previewContainer = document.getElementById('previewContainer');
        if (dropZone) dropZone.style.display = 'none';
        if (previewContainer) previewContainer.style.display = 'block';

        showToast('Image uploaded successfully!', 'success');

        // Interactive preview'i guncelle
        updateInteractivePreview();
    };
    reader.readAsDataURL(file);
}

function setupTemplateUpload() {
    const templateDropZone = document.getElementById('templateDropZone');
    if (!templateDropZone) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        templateDropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        templateDropZone.addEventListener(eventName, () => {
            templateDropZone.classList.add('drag-over');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        templateDropZone.addEventListener(eventName, () => {
            templateDropZone.classList.remove('drag-over');
        }, false);
    });

    templateDropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleTemplateFile(files[0]);
        }
    }, false);

    templateDropZone.addEventListener('click', () => {
        const input = document.getElementById('templateInput');
        if (input) input.click();
    });
}

function handleTemplateFile(file) {
    if (!file.type.startsWith('image/')) {
        showToast('Please upload an image file for template', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        state.templateImage = e.target.result;
        state.templateBase64 = e.target.result;

        const preview = document.getElementById('templatePreview');
        if (preview) {
            preview.src = e.target.result;
            preview.style.display = 'block';
        }

        showToast('Template image uploaded!', 'success');
    };
    reader.readAsDataURL(file);
}

// ============================================
// 7. SECIM FONKSIYONLARI
// ============================================

function selectJewelryCategory(category) {
    state.selectedCategory = category;

    // UI'yi guncelle
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.category === category) {
            btn.classList.add('active');
        }
    });

    // Kategoriye gore uygun model sec
    const categoryModelMap = {
        'necklace': 'neck_model',
        'bracelet': 'hand_model',
        'ring': 'hand_model',
        'earring': 'statement_ear',
        'set': 'set_model'
    };

    if (categoryModelMap[category]) {
        selectModelProfile(categoryModelMap[category]);
    }

    showToast(`Category: ${category}`, 'info');
}

function selectModelProfile(profileId) {
    state.selectedModel = profileId;

    document.querySelectorAll('.model-card').forEach(card => {
        card.classList.remove('active');
        if (card.dataset.model === profileId) {
            card.classList.add('active');
        }
    });

    const profile = modelProfiles[profileId];
    if (profile) {
        showToast(`Model: ${profile.name}`, 'info');
    }
}

function selectStyle(styleId) {
    state.selectedStyle = styleId;

    document.querySelectorAll('.style-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.style === styleId) {
            btn.classList.add('active');
        }
    });

    const style = stylePresets[styleId];
    if (style) {
        showToast(`Style: ${style.name}`, 'info');
    }
}

function selectPose(poseId) {
    state.selectedPose = poseId;

    document.querySelectorAll('.pose-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.pose === poseId) {
            btn.classList.add('active');
        }
    });

    const pose = posePresets[poseId];
    if (pose) {
        showToast(`Pose: ${pose.name}`, 'info');
    }
}

function selectOutfit(outfitId) {
    state.selectedOutfit = outfitId;

    document.querySelectorAll('.outfit-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.outfit === outfitId) {
            btn.classList.add('active');
        }
    });

    const outfit = outfitPresets[outfitId];
    if (outfit) {
        showToast(`Outfit: ${outfit.name}`, 'info');
    }
}

function selectScene(sceneId) {
    state.selectedScene = sceneId;

    document.querySelectorAll('.scene-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.scene === sceneId) {
            btn.classList.add('active');
        }
    });

    const scene = scenePresets[sceneId];
    if (scene) {
        showToast(`Scene: ${scene.name}`, 'info');
    }
}

function toggleAutoOutfit() {
    state.autoOutfit = !state.autoOutfit;

    const toggle = document.getElementById('autoOutfitToggle');
    if (toggle) {
        toggle.classList.toggle('active', state.autoOutfit);
    }

    showToast(`Auto Outfit: ${state.autoOutfit ? 'ON' : 'OFF'}`, 'info');
}

function addSmartPrompt(promptText) {
    const promptInput = document.getElementById('customPrompt');
    if (promptInput) {
        const currentValue = promptInput.value.trim();
        if (currentValue) {
            promptInput.value = currentValue + ', ' + promptText;
        } else {
            promptInput.value = promptText;
        }
        state.currentPrompt = promptInput.value;
    }
    showToast('Smart prompt added!', 'info');
}

// ============================================
// 8. POZISYON KONTROLLERI
// ============================================

function updatePositionValue(type, value) {
    state.position[type] = parseFloat(value);

    const valueDisplay = document.getElementById(`${type}Value`);
    if (valueDisplay) {
        valueDisplay.textContent = value + (type === 'rotation' ? '°' : type === 'scale' ? '%' : 'px');
    }

    updateInteractivePreview();
}

function moveJewelry(direction) {
    const step = 5;

    switch (direction) {
        case 'up':
            state.position.y = Math.max(0, state.position.y - step);
            break;
        case 'down':
            state.position.y = Math.min(100, state.position.y + step);
            break;
        case 'left':
            state.position.x = Math.max(0, state.position.x - step);
            break;
        case 'right':
            state.position.x = Math.min(100, state.position.x + step);
            break;
    }

    syncSlidersWithState();
    updateInteractivePreview();
}

function rotateJewelry(degrees) {
    state.position.rotation = (state.position.rotation + degrees) % 360;
    if (state.position.rotation < 0) state.position.rotation += 360;

    syncSlidersWithState();
    updateInteractivePreview();
}

function scaleJewelry(factor) {
    state.position.scale = Math.max(10, Math.min(300, state.position.scale * factor));

    syncSlidersWithState();
    updateInteractivePreview();
}

function syncSlidersWithState() {
    const xSlider = document.getElementById('positionX');
    const ySlider = document.getElementById('positionY');
    const scaleSlider = document.getElementById('scale');
    const rotationSlider = document.getElementById('rotation');

    if (xSlider) xSlider.value = state.position.x;
    if (ySlider) ySlider.value = state.position.y;
    if (scaleSlider) scaleSlider.value = state.position.scale;
    if (rotationSlider) rotationSlider.value = state.position.rotation;

    // Deger gosterimlerini guncelle
    updatePositionValue('x', state.position.x);
    updatePositionValue('y', state.position.y);
    updatePositionValue('scale', state.position.scale);
    updatePositionValue('rotation', state.position.rotation);
}

// ============================================
// 9. ANA ISLEM FONKSIYONLARI
// ============================================

async function generateImage() {
    if (!state.originalBase64) {
        showToast('Please upload an image first!', 'error');
        return;
    }

    // API key kontrolu
    const falKey = state.settings.falApiKey;
    if (!falKey && !isDemoMode) {
        showToast('Please configure your Fal.ai API key or enable Demo Mode', 'error');
        openSettings();
        return;
    }

    showLoader('Generating professional product photo...');

    try {
        // Product Photography API kullan - EN ONEMLI OZELLIK!
        const productPhotoData = await callFalAPI('fal-ai/image-apps-v2/product-photography', {
            product_image_url: state.originalBase64
        }, falKey);

        if (productPhotoData && productPhotoData.images && productPhotoData.images.length > 0) {
            const resultImageUrl = productPhotoData.images[0].url;

            // Sonucu base64'e cevir
            const resultBase64 = await fetchImageAsBase64(resultImageUrl);

            state.processedImage = resultBase64;

            // Sonuc preview'ini guncelle
            const resultPreview = document.getElementById('resultPreview');
            if (resultPreview) {
                resultPreview.src = resultBase64;
                resultPreview.style.display = 'block';
            }

            // Galeriye ekle
            addToGallery(resultBase64, 'Product Photography');

            hideLoader();
            showToast('Professional product photo generated successfully!', 'success');
        } else {
            throw new Error('No image returned from Product Photography API');
        }

    } catch (error) {
        console.error('Product Photography error:', error);
        hideLoader();
        showToast('Error generating product photo: ' + error.message, 'error');
    }
}

async function previewJewelryPlacement() {
    if (!state.originalBase64) {
        showToast('Please upload an image first!', 'error');
        return;
    }

    const falKey = state.settings.falApiKey;
    if (!falKey && !isDemoMode) {
        showToast('Please configure your Fal.ai API key or enable Demo Mode', 'error');
        openSettings();
        return;
    }

    showLoader('Removing background with BiRefNet...');

    try {
        // BiRefNet ile arka plan kaldirma
        const birefnetData = await callFalAPI('fal-ai/birefnet', {
            image_url: state.originalBase64,
            model: 'General',
            operating_resolution: '1024x1024',
            output_format: 'png'
        }, falKey);

        if (birefnetData && birefnetData.image && birefnetData.image.url) {
            const transparentImage = await fetchImageAsBase64(birefnetData.image.url);

            // Beyaz arka plan ekle
            const withWhiteBackground = await addWhiteBackgroundToTransparent(transparentImage);

            state.processedImage = withWhiteBackground;

            const resultPreview = document.getElementById('resultPreview');
            if (resultPreview) {
                resultPreview.src = withWhiteBackground;
                resultPreview.style.display = 'block';
            }

            // Interactive preview'i goster
            showInteractivePreview();

            hideLoader();
            showToast('Background removed! Use interactive canvas to adjust position.', 'success');
        } else {
            throw new Error('BiRefNet returned no image');
        }

    } catch (error) {
        console.error('BiRefNet error:', error);
        hideLoader();
        showToast('Error removing background: ' + error.message, 'error');
    }
}

async function generateSEO() {
    if (!state.processedImage && !state.originalImage) {
        showToast('Please generate or upload an image first!', 'error');
        return;
    }

    const geminiKey = state.settings.geminiApiKey;
    if (!geminiKey && !isDemoMode) {
        showToast('Please configure your Gemini API key or enable Demo Mode', 'error');
        openSettings();
        return;
    }

    showLoader('Generating SEO content with AI...');

    try {
        const category = state.selectedCategory || 'jewelry';
        const style = stylePresets[state.selectedStyle]?.name || 'Studio';

        const prompt = `You are an expert e-commerce SEO specialist for jewelry products on Trendyol marketplace.

Generate SEO-optimized content for a ${category} product in ${style} style.

Provide the following in Turkish:
1. TITLE: A compelling product title (max 100 chars) with key search terms
2. DESCRIPTION: A detailed product description (150-300 words) highlighting features, materials, and benefits
3. KEYWORDS: 10 relevant keywords separated by commas
4. TAGS: 5 hashtags for social media

Format your response as:
TITLE: [title here]
DESCRIPTION: [description here]
KEYWORDS: [keywords here]
TAGS: [tags here]`;

        const response = await callGeminiAPI(prompt, geminiKey);

        // Yaniti parse et
        const titleMatch = response.match(/TITLE:\s*(.+?)(?=DESCRIPTION:|$)/s);
        const descMatch = response.match(/DESCRIPTION:\s*(.+?)(?=KEYWORDS:|$)/s);
        const keywordsMatch = response.match(/KEYWORDS:\s*(.+?)(?=TAGS:|$)/s);
        const tagsMatch = response.match(/TAGS:\s*(.+?)$/s);

        state.seo.title = titleMatch ? titleMatch[1].trim() : '';
        state.seo.description = descMatch ? descMatch[1].trim() : '';
        state.seo.keywords = keywordsMatch ? keywordsMatch[1].trim() : '';
        state.seo.tags = tagsMatch ? tagsMatch[1].trim() : '';

        // UI'yi guncelle
        document.getElementById('seoTitle').textContent = state.seo.title;
        document.getElementById('seoDescription').textContent = state.seo.description;
        document.getElementById('seoKeywords').textContent = state.seo.keywords;
        document.getElementById('seoTags').textContent = state.seo.tags;

        // SEO panelini goster
        const seoPanel = document.getElementById('seoPanel');
        if (seoPanel) seoPanel.style.display = 'block';

        hideLoader();
        showToast('SEO content generated successfully!', 'success');

    } catch (error) {
        console.error('SEO generation error:', error);
        hideLoader();
        showToast('Error generating SEO content: ' + error.message, 'error');
    }
}

// ============================================
// 10. YARDIMCI FONKSIYONLAR
// ============================================

async function fetchImageAsBase64(url) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('Error fetching image:', error);
        throw error;
    }
}

async function ensureWhiteBackground(imageData) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');

            // Beyaz arka plan
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Gorseli ciz
            ctx.drawImage(img, 0, 0);

            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(imageData);
        img.src = imageData;
    });
}

async function addWhiteBackgroundToTransparent(transparentBase64) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');

            // Beyaz arka plan
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Transparan gorseli ustune ciz
            ctx.drawImage(img, 0, 0);

            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(transparentBase64);
        img.src = transparentBase64;
    });
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

// ============================================
// 11. GALERI FONKSIYONLARI
// ============================================

function addToGallery(imageData, label = '') {
    const galleryItem = {
        id: Date.now(),
        image: imageData,
        label: label,
        timestamp: new Date().toISOString()
    };

    state.gallery.unshift(galleryItem);

    // Galeri boyutunu sinirla (max 20)
    if (state.gallery.length > 20) {
        state.gallery = state.gallery.slice(0, 20);
    }

    updateMiniGallery();
}

function updateMiniGallery() {
    const gallery = document.getElementById('miniGallery');
    if (!gallery) return;

    gallery.innerHTML = state.gallery.map((item, index) => `
        <div class="gallery-item" onclick="showGalleryImage(${index})">
            <img src="${item.image}" alt="${item.label}">
            <span class="gallery-label">${item.label}</span>
        </div>
    `).join('');
}

function showGalleryImage(index) {
    const item = state.gallery[index];
    if (!item) return;

    const resultPreview = document.getElementById('resultPreview');
    if (resultPreview) {
        resultPreview.src = item.image;
        resultPreview.style.display = 'block';
    }

    state.processedImage = item.image;
    showToast(`Showing: ${item.label}`, 'info');
}

function clearGallery() {
    if (confirm('Are you sure you want to clear the gallery?')) {
        state.gallery = [];
        updateMiniGallery();
        showToast('Gallery cleared', 'info');
    }
}

// ============================================
// 12. INDIRME
// ============================================

function downloadImage() {
    const imageToDownload = state.processedImage || state.originalImage;

    if (!imageToDownload) {
        showToast('No image to download!', 'error');
        return;
    }

    const link = document.createElement('a');
    link.download = `trendyol-pro-${Date.now()}.${state.settings.outputFormat}`;
    link.href = imageToDownload;
    link.click();

    showToast('Image downloaded!', 'success');
}

// ============================================
// 13. SEO FONKSIYONLARI
// ============================================

function updateCharCount(inputId, counterId, maxChars) {
    const input = document.getElementById(inputId);
    const counter = document.getElementById(counterId);

    if (input && counter) {
        const length = input.value.length;
        counter.textContent = `${length}/${maxChars}`;
        counter.style.color = length > maxChars ? '#ff4444' : '#888';
    }
}

function copyText(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Copy failed:', err);
        showToast('Failed to copy', 'error');
    });
}

function copySEO(field) {
    const text = state.seo[field] || '';
    copyText(text);
}

function copyAllSEO() {
    const allSEO = `Title: ${state.seo.title}\n\nDescription: ${state.seo.description}\n\nKeywords: ${state.seo.keywords}\n\nTags: ${state.seo.tags}`;
    copyText(allSEO);
}

// ============================================
// 14. MANUEL DUZENLEME
// ============================================

function applyImageAdjustments() {
    const brightness = document.getElementById('brightnessSlider')?.value || 100;
    const contrast = document.getElementById('contrastSlider')?.value || 100;
    const saturation = document.getElementById('saturationSlider')?.value || 100;
    const sharpness = document.getElementById('sharpnessSlider')?.value || 0;

    const preview = document.getElementById('resultPreview');
    if (preview) {
        preview.style.filter = `
            brightness(${brightness}%)
            contrast(${contrast}%)
            saturate(${saturation}%)
        `;
    }
}

function resetAdjustments() {
    // Sliderlari sifirla
    const sliders = ['brightness', 'contrast', 'saturation', 'sharpness'];
    sliders.forEach(name => {
        const slider = document.getElementById(`${name}Slider`);
        if (slider) {
            slider.value = name === 'sharpness' ? 0 : 100;
        }
    });

    const preview = document.getElementById('resultPreview');
    if (preview) {
        preview.style.filter = 'none';
    }

    showToast('Adjustments reset', 'info');
}

function applyAndSaveAdjustments() {
    if (!state.processedImage) {
        showToast('No processed image to save!', 'error');
        return;
    }

    const brightness = document.getElementById('brightnessSlider')?.value || 100;
    const contrast = document.getElementById('contrastSlider')?.value || 100;
    const saturation = document.getElementById('saturationSlider')?.value || 100;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');

        // Filtreleri uygula
        ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
        ctx.drawImage(img, 0, 0);

        const adjustedImage = canvas.toDataURL('image/png');
        state.processedImage = adjustedImage;

        const preview = document.getElementById('resultPreview');
        if (preview) {
            preview.src = adjustedImage;
            preview.style.filter = 'none';
        }

        addToGallery(adjustedImage, 'Adjusted');
        resetAdjustments();

        showToast('Adjustments applied and saved!', 'success');
    };
    img.src = state.processedImage;
}

// ============================================
// 15. MODEL PROFILLERI
// ============================================

const modelProfiles = {
    neck_model: {
        id: 'neck_model',
        name: 'Neck Model',
        category: 'necklace',
        description: 'Professional neck/decollete model for necklaces and pendants',
        placement: { x: 50, y: 30, scale: 100 }
    },
    hand_model: {
        id: 'hand_model',
        name: 'Hand Model',
        category: 'bracelet',
        description: 'Elegant hand model for bracelets and rings',
        placement: { x: 50, y: 50, scale: 100 }
    },
    set_model: {
        id: 'set_model',
        name: 'Set Model',
        category: 'set',
        description: 'Full model for complete jewelry sets',
        placement: { x: 50, y: 40, scale: 80 }
    },
    boho_model: {
        id: 'boho_model',
        name: 'Boho Model',
        category: 'mixed',
        description: 'Bohemian style model for artistic jewelry',
        placement: { x: 50, y: 35, scale: 90 }
    },
    minimal_neck: {
        id: 'minimal_neck',
        name: 'Minimal Neck',
        category: 'necklace',
        description: 'Minimalist neck presentation',
        placement: { x: 50, y: 25, scale: 110 }
    },
    minimal_hand: {
        id: 'minimal_hand',
        name: 'Minimal Hand',
        category: 'bracelet',
        description: 'Clean minimal hand model',
        placement: { x: 50, y: 50, scale: 100 }
    },
    statement_neck: {
        id: 'statement_neck',
        name: 'Statement Neck',
        category: 'necklace',
        description: 'Bold statement necklace model',
        placement: { x: 50, y: 35, scale: 85 }
    },
    statement_ear: {
        id: 'statement_ear',
        name: 'Statement Ear',
        category: 'earring',
        description: 'Profile view for statement earrings',
        placement: { x: 60, y: 30, scale: 120 }
    },
    pearl_neck: {
        id: 'pearl_neck',
        name: 'Pearl Neck',
        category: 'necklace',
        description: 'Classic pearl necklace presentation',
        placement: { x: 50, y: 30, scale: 95 }
    },
    pearl_ear: {
        id: 'pearl_ear',
        name: 'Pearl Ear',
        category: 'earring',
        description: 'Elegant pearl earring model',
        placement: { x: 55, y: 25, scale: 130 }
    }
};

// ============================================
// 16. PRESET OBJELERI
// ============================================

const stylePresets = {
    studio: {
        id: 'studio',
        name: 'Studio Professional',
        lighting: 'soft diffused',
        background: 'clean white',
        mood: 'professional, commercial'
    },
    boho: {
        id: 'boho',
        name: 'Bohemian',
        lighting: 'natural warm',
        background: 'organic textures',
        mood: 'artistic, free-spirited'
    },
    luxury: {
        id: 'luxury',
        name: 'Luxury',
        lighting: 'dramatic shadows',
        background: 'dark elegant',
        mood: 'premium, exclusive'
    }
};

const outfitPresets = {
    black_vneck: {
        id: 'black_vneck',
        name: 'Black V-Neck',
        color: '#000000',
        style: 'V-neck top',
        description: 'Classic black V-neck for elegant contrast'
    },
    white_off: {
        id: 'white_off',
        name: 'White Off-Shoulder',
        color: '#FFFFFF',
        style: 'Off-shoulder',
        description: 'White off-shoulder for delicate pieces'
    },
    cream_silk: {
        id: 'cream_silk',
        name: 'Cream Silk',
        color: '#FFF8DC',
        style: 'Silk blouse',
        description: 'Luxurious cream silk for premium look'
    },
    burgundy: {
        id: 'burgundy',
        name: 'Burgundy',
        color: '#800020',
        style: 'V-neck',
        description: 'Rich burgundy for gold jewelry'
    },
    navy: {
        id: 'navy',
        name: 'Navy Blue',
        color: '#000080',
        style: 'Classic top',
        description: 'Navy blue for silver/pearl jewelry'
    },
    nude: {
        id: 'nude',
        name: 'Nude/Beige',
        color: '#E8D4C4',
        style: 'Simple top',
        description: 'Neutral nude for versatile styling'
    },
    forest: {
        id: 'forest',
        name: 'Forest Green',
        color: '#228B22',
        style: 'Elegant top',
        description: 'Forest green for gold contrast'
    },
    none: {
        id: 'none',
        name: 'No Outfit',
        color: 'transparent',
        style: 'Skin only',
        description: 'Direct skin/model presentation'
    }
};

const scenePresets = {
    studio_clean: {
        id: 'studio_clean',
        name: 'Clean Studio',
        background: 'Pure white seamless',
        lighting: 'Even soft lighting',
        props: 'None'
    },
    romantic: {
        id: 'romantic',
        name: 'Romantic',
        background: 'Soft pink/blush tones',
        lighting: 'Warm diffused',
        props: 'Rose petals, soft fabrics'
    },
    luxury_dark: {
        id: 'luxury_dark',
        name: 'Luxury Dark',
        background: 'Black velvet',
        lighting: 'Dramatic spot lighting',
        props: 'Gold accents'
    },
    golden_hour: {
        id: 'golden_hour',
        name: 'Golden Hour',
        background: 'Warm outdoor',
        lighting: 'Natural golden light',
        props: 'Natural elements'
    },
    minimalist: {
        id: 'minimalist',
        name: 'Minimalist',
        background: 'Grey gradient',
        lighting: 'Soft even',
        props: 'Geometric shapes'
    },
    editorial: {
        id: 'editorial',
        name: 'Editorial',
        background: 'Fashion magazine style',
        lighting: 'High contrast',
        props: 'Fashion elements'
    },
    nature: {
        id: 'nature',
        name: 'Nature',
        background: 'Organic textures',
        lighting: 'Natural daylight',
        props: 'Plants, stones, wood'
    },
    festive: {
        id: 'festive',
        name: 'Festive',
        background: 'Sparkling bokeh',
        lighting: 'Warm celebratory',
        props: 'Glitter, lights'
    }
};

const posePresets = {
    front: {
        id: 'front',
        name: 'Front View',
        angle: 0,
        description: 'Direct front facing'
    },
    right: {
        id: 'right',
        name: 'Right Profile',
        angle: 90,
        description: 'Right side profile'
    },
    left: {
        id: 'left',
        name: 'Left Profile',
        angle: -90,
        description: 'Left side profile'
    },
    down: {
        id: 'down',
        name: 'Looking Down',
        angle: 0,
        description: 'Head tilted down'
    },
    closeup: {
        id: 'closeup',
        name: 'Close-Up',
        angle: 0,
        description: 'Tight crop on jewelry'
    },
    surface: {
        id: 'surface',
        name: 'Flat Surface',
        angle: 0,
        description: 'Jewelry on flat surface'
    }
};

// ============================================
// 18. INTERACTIVE CANVAS SISTEMI
// ============================================

function updateInteractivePreview() {
    const canvas = document.getElementById('interactiveCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Canvas'i temizle
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Arka plan (beyaz)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Template varsa ciz
    if (state.templateImage) {
        const templateImg = new Image();
        templateImg.onload = () => {
            ctx.drawImage(templateImg, 0, 0, canvas.width, canvas.height);
            drawJewelryOnCanvas(ctx, canvas);
        };
        templateImg.src = state.templateImage;
    } else {
        drawJewelryOnCanvas(ctx, canvas);
    }
}

function drawJewelryOnCanvas(ctx, canvas) {
    if (!state.processedImage && !state.originalImage) return;

    const imageToUse = state.processedImage || state.originalImage;
    const img = new Image();

    img.onload = () => {
        const x = (canvas.width * state.position.x) / 100;
        const y = (canvas.height * state.position.y) / 100;
        const scale = state.position.scale / 100;
        const rotation = (state.position.rotation * Math.PI) / 180;

        const width = img.width * scale * 0.3;
        const height = img.height * scale * 0.3;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.drawImage(img, -width / 2, -height / 2, width, height);
        ctx.restore();
    };

    img.src = imageToUse;
}

async function loadInteractiveImages() {
    showLoader('Loading interactive preview...');

    try {
        updateInteractivePreview();
        hideLoader();
    } catch (error) {
        console.error('Error loading interactive images:', error);
        hideLoader();
        showToast('Error loading preview', 'error');
    }
}

function showInteractivePreview() {
    const container = document.getElementById('interactivePreviewContainer');
    if (container) {
        container.style.display = 'block';
        state.interactiveMode = true;
        updateInteractivePreview();
        setupCanvasDrag();
        setupKeyboardControls();
    }
}

function hideInteractivePreview() {
    const container = document.getElementById('interactivePreviewContainer');
    if (container) {
        container.style.display = 'none';
        state.interactiveMode = false;
    }
}

function setupCanvasDrag() {
    const canvas = document.getElementById('interactiveCanvas');
    if (!canvas) return;

    let isDragging = false;
    let startX, startY;

    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        canvas.style.cursor = 'grabbing';
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        // Pozisyonu guncelle (canvas boyutuna gore normalize et)
        state.position.x = Math.max(0, Math.min(100, state.position.x + (dx / canvas.width) * 100));
        state.position.y = Math.max(0, Math.min(100, state.position.y + (dy / canvas.height) * 100));

        startX = e.clientX;
        startY = e.clientY;

        syncSlidersWithState();
        updateInteractivePreview();
    });

    canvas.addEventListener('mouseup', () => {
        isDragging = false;
        canvas.style.cursor = 'grab';
    });

    canvas.addEventListener('mouseleave', () => {
        isDragging = false;
        canvas.style.cursor = 'grab';
    });

    // Mouse wheel ile zoom
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.95 : 1.05;
        scaleJewelry(delta);
    });

    canvas.style.cursor = 'grab';
}

function setupKeyboardControls() {
    document.addEventListener('keydown', (e) => {
        if (!state.interactiveMode) return;

        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                moveJewelry('up');
                break;
            case 'ArrowDown':
                e.preventDefault();
                moveJewelry('down');
                break;
            case 'ArrowLeft':
                e.preventDefault();
                moveJewelry('left');
                break;
            case 'ArrowRight':
                e.preventDefault();
                moveJewelry('right');
                break;
            case 'r':
            case 'R':
                rotateJewelry(e.shiftKey ? -15 : 15);
                break;
            case '+':
            case '=':
                scaleJewelry(1.1);
                break;
            case '-':
            case '_':
                scaleJewelry(0.9);
                break;
            case 'Escape':
                hideInteractivePreview();
                break;
        }
    });
}

// ============================================
// WINDOW ONLOAD
// ============================================

window.onload = function() {
    console.log('Trendyol Pro Studio v19.0 loaded');

    // Ayarlari yukle
    loadSettings();

    // Drag & drop'u baslat
    setupDragDrop();

    // Template upload'u baslat
    setupTemplateUpload();

    // Ilk accordion'u ac
    const firstAccordion = document.querySelector('.accordion-header');
    if (firstAccordion) {
        toggleAccordion(firstAccordion);
    }

    showToast('Trendyol Pro Studio v19.0 ready!', 'success');
};

// ============================================
// GLOBAL FONKSIYONLARI DISA AKTAR
// ============================================

// Event handlers icin global scope'a aktar
window.toggleDemoMode = toggleDemoMode;
window.toggleAccordion = toggleAccordion;
window.switchTab = switchTab;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.saveSettings = saveSettings;
window.handleUpload = handleUpload;
window.handleTemplateFile = handleTemplateFile;
window.selectJewelryCategory = selectJewelryCategory;
window.selectModelProfile = selectModelProfile;
window.selectStyle = selectStyle;
window.selectPose = selectPose;
window.selectOutfit = selectOutfit;
window.selectScene = selectScene;
window.toggleAutoOutfit = toggleAutoOutfit;
window.addSmartPrompt = addSmartPrompt;
window.updatePositionValue = updatePositionValue;
window.moveJewelry = moveJewelry;
window.rotateJewelry = rotateJewelry;
window.scaleJewelry = scaleJewelry;
window.generateImage = generateImage;
window.previewJewelryPlacement = previewJewelryPlacement;
window.generateSEO = generateSEO;
window.addToGallery = addToGallery;
window.showGalleryImage = showGalleryImage;
window.clearGallery = clearGallery;
window.downloadImage = downloadImage;
window.updateCharCount = updateCharCount;
window.copyText = copyText;
window.copySEO = copySEO;
window.copyAllSEO = copyAllSEO;
window.applyImageAdjustments = applyImageAdjustments;
window.resetAdjustments = resetAdjustments;
window.applyAndSaveAdjustments = applyAndSaveAdjustments;
window.showInteractivePreview = showInteractivePreview;
window.hideInteractivePreview = hideInteractivePreview;
