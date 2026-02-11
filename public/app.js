/**
 * Trendyol Pro Studio v19.2
 * Professional Jewelry Photography & AI Enhancement Platform
 * + Çoklu Varyasyon & Popüler Şablonlar & Marka Modeli & Video
 */

// ============================================
// 1. API CAGRI FONKSIYONLARI
// ============================================

// Fal.ai API cagrisi (direkt)
async function callFalAPI(endpoint, payload, apiKey) {
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

            const result = await response.json();

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
    isGenerating: false,
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
    interactiveMode: false,
    brandModel: {
        enabled: false,
        name: '',
        photos: [],
        maxPhotos: 5
    },
    video: {
        isGenerating: false,
        result: null,
        duration: 5,
        aspectRatio: '9:16'
    }
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
        document.getElementById('falKeyInput').value = state.settings.falApiKey || '';
        document.getElementById('geminiKeyInput').value = state.settings.geminiApiKey || '';
    }
}

function closeSettings() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function saveSettings() {
    const falKey = document.getElementById('falKeyInput')?.value?.trim() || '';
    const geminiKey = document.getElementById('geminiKeyInput')?.value?.trim() || '';

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

    // API durumunu guncelle
    updateApiStatus();
}

function updateApiStatus() {
    const apiStatusEl = document.getElementById('apiStatus');

    if (apiStatusEl) {
        const hasFal = !!state.settings.falApiKey;
        const hasGemini = !!state.settings.geminiApiKey;

        if (hasFal && hasGemini) {
            apiStatusEl.innerHTML = '<span style="color:#10b981">●</span> API Bağlı';
            apiStatusEl.style.color = '#10b981';
        } else if (hasFal || hasGemini) {
            apiStatusEl.innerHTML = '<span style="color:#f59e0b">●</span> Kısmi Bağlantı';
            apiStatusEl.style.color = '#f59e0b';
        } else {
            apiStatusEl.innerHTML = '<span style="color:#ef4444">●</span> API Bağlantısı Yok';
            apiStatusEl.style.color = '#ef4444';
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

function showResultPreview(imageBase64) {
    const resultPreview = document.getElementById('resultPreview');
    const placeholder = document.getElementById('previewPlaceholder');
    const downloadActions = document.getElementById('downloadActions');
    const previewVideo = document.getElementById('previewVideo');

    if (resultPreview) {
        resultPreview.src = imageBase64;
        resultPreview.classList.remove('hidden');
        resultPreview.style.display = 'block';
    }
    if (placeholder) placeholder.style.display = 'none';
    if (downloadActions) downloadActions.classList.remove('hidden');
    if (previewVideo) previewVideo.classList.add('hidden');
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
        const input = document.getElementById('fileInput');
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

        // Upload alanında önizleme göster (alan kapanmaz!)
        const uploadPreview = document.getElementById('uploadPreview');
        const uploadPreviewContainer = document.getElementById('uploadPreviewContainer');
        const uploadPrompt = document.getElementById('uploadPrompt');
        const fileName = document.getElementById('fileName');

        if (uploadPreview) {
            uploadPreview.src = e.target.result;
        }
        if (uploadPreviewContainer) {
            uploadPreviewContainer.classList.remove('hidden');
        }
        if (uploadPrompt) {
            uploadPrompt.classList.add('hidden');
        }
        if (fileName) {
            fileName.textContent = file.name;
        }

        showToast('Ürün görseli yüklendi!', 'success');

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
        showToast('Lutfen bir gorsel dosyasi yukleyin', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        state.templateImage = e.target.result;
        state.templateBase64 = e.target.result;

        const previewContainer = document.getElementById('templatePreview');
        const previewImg = document.getElementById('templateImage');
        const placeholder = document.getElementById('templatePlaceholder');

        if (previewImg) previewImg.src = e.target.result;
        if (previewContainer) previewContainer.classList.remove('hidden');
        if (placeholder) placeholder.classList.add('hidden');

        showToast('Model sablonu yuklendi!', 'success');
        updateInteractivePreview();
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

    // Hem .style-btn hem .style-card class'larini destekle
    document.querySelectorAll('.style-btn, .style-card').forEach(btn => {
        btn.classList.remove('active', 'selected');
        if (btn.dataset.style === styleId) {
            btn.classList.add('active', 'selected');
        }
    });

    const style = stylePresets[styleId];
    if (style) {
        showToast(`Stil: ${style.name}`, 'info');
    }
}

function selectPose(poseId) {
    state.selectedPose = poseId;

    // Hem .pose-btn hem .pose-card class'larini destekle
    document.querySelectorAll('.pose-btn, .pose-card').forEach(btn => {
        btn.classList.remove('active', 'selected');
        if (btn.dataset.pose === poseId) {
            btn.classList.add('active', 'selected');
        }
    });

    const pose = posePresets[poseId];
    if (pose) {
        showToast(`Çekim Açısı: ${pose.name}`, 'info');
    }
}

function selectOutfit(outfitId) {
    state.selectedOutfit = outfitId;

    // Hem .outfit-btn hem .outfit-card class'larini destekle
    document.querySelectorAll('.outfit-btn, .outfit-card').forEach(btn => {
        btn.classList.remove('active', 'selected');
        if (btn.dataset.outfit === outfitId) {
            btn.classList.add('active', 'selected');
        }
    });

    const outfit = outfitPresets[outfitId];
    if (outfit) {
        showToast(`Kıyafet: ${outfit.name}`, 'info');
    }
}

function selectScene(sceneId) {
    state.selectedScene = sceneId;

    // Hem .scene-btn hem .scene-card class'larini destekle
    document.querySelectorAll('.scene-btn, .scene-card').forEach(btn => {
        btn.classList.remove('active', 'selected');
        if (btn.dataset.scene === sceneId) {
            btn.classList.add('active', 'selected');
        }
    });

    const scene = scenePresets[sceneId];
    if (scene) {
        showToast(`Sahne: ${scene.name}`, 'info');
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
    if (state.isGenerating) {
        showToast('Zaten bir islem devam ediyor, lutfen bekleyin...', 'warning');
        return;
    }

    if (!state.originalBase64) {
        showToast('Lutfen once bir urun gorseli yukleyin!', 'error');
        return;
    }

    // API key kontrolu
    const falKey = state.settings.falApiKey;
    if (!falKey) {
        showToast('Fal.ai API key gerekli - Ayarlardan girin', 'error');
        openSettings();
        return;
    }

    state.isGenerating = true;

    try {
        const selectedOutfit = outfitPresets[state.selectedOutfit] || outfitPresets.black_vneck;
        const selectedPose = posePresets[state.selectedPose] || posePresets.front;
        const selectedScene = scenePresets[state.selectedScene] || scenePresets.studio_clean;
        const selectedStyle = stylePresets[state.selectedStyle] || stylePresets.studio;
        const sceneDescription = buildSceneDescription(selectedOutfit, selectedPose, selectedScene, selectedStyle);

        let resultBase64;

        // ===== TEMPLATE MODEL + KONTEXT MODU =====
        if (state.templateImage) {
            showLoader('Taki analiz ediliyor...');

            // Gemini ile taki gorselini analiz et (detayli aciklama icin)
            const jewelryDesc = await analyzeJewelryImage(state.originalBase64);

            showLoader('FLUX Kontext ile taki modele yerlestiriliyor...');

            // Kontext: model fotosunu baz al, taki ekle
            const kontextPrompt = `Add ${jewelryDesc} on the model in this photo. The jewelry should look natural and realistic on the model. ${sceneDescription}. Keep the model's face, body, pose and background exactly the same. Only add the jewelry. Professional product photography quality, sharp details on the jewelry.`;

            console.log('Kontext prompt:', kontextPrompt);

            const kontextResult = await callFalAPI('fal-ai/flux-pro/kontext', {
                image_url: state.templateImage,
                prompt: kontextPrompt,
                guidance_scale: 4.0,
                num_inference_steps: 28,
                output_format: 'jpeg'
            }, falKey);

            if (kontextResult?.images?.[0]?.url) {
                resultBase64 = await fetchImageAsBase64(kontextResult.images[0].url);
            } else {
                throw new Error('FLUX Kontext sonuc dondurmedi');
            }

        // ===== STANDART PRODUCT PHOTOGRAPHY MODU =====
        } else {
            showLoader('Profesyonel urun fotografi olusturuluyor...');

            const productPhotoData = await callFalAPI('fal-ai/image-apps-v2/product-photography', {
                product_image_url: state.originalBase64,
                prompt: sceneDescription
            }, falKey);

            if (productPhotoData?.images?.[0]?.url) {
                resultBase64 = await fetchImageAsBase64(productPhotoData.images[0].url);
            } else {
                throw new Error('Product Photography API sonuc dondurmedi');
            }
        }

        // Urun gorselini kaydet
        state.processedImage = resultBase64;

        // Brand model face-swap (Kontext ciktisinda model yuzu VAR)
        if (state.brandModel.enabled && state.brandModel.photos.length > 0) {
            showLoader('Marka modeli yuzu uygulanıyor...');
            resultBase64 = await applyBrandModelFace(resultBase64);
            state.processedImage = resultBase64;
        }

        // Sonuc preview
        showResultPreview(resultBase64);

        // Galeriye ekle
        const label = `${selectedPose.name} - ${selectedOutfit.name}`;
        addToGallery(resultBase64, label);

        hideLoader();
        showToast('Profesyonel urun gorseli olusturuldu!', 'success');

    } catch (error) {
        console.error('Generation error:', error);
        hideLoader();
        showToast('Gorsel olusturma hatasi: ' + error.message, 'error');
    } finally {
        state.isGenerating = false;
    }
}

// Gemini ile taki gorselini analiz et - Kontext promptu icin detayli aciklama
async function analyzeJewelryImage(imageBase64) {
    const geminiKey = state.settings.geminiApiKey;

    // Gemini key yoksa genel aciklama don
    if (!geminiKey) {
        const category = state.selectedCategory || 'necklace';
        const categoryNames = {
            necklace: 'a delicate necklace', bracelet: 'an elegant bracelet',
            earring: 'beautiful earrings', ring: 'a stylish ring', set: 'a jewelry set'
        };
        return categoryNames[category] || 'elegant jewelry';
    }

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: 'Describe this jewelry item in ONE detailed English sentence for an AI image editor. Include: type (necklace/bracelet/ring/earring), metal color (gold/silver/rose gold), stone types, design style. Example: "a delicate rose gold chain necklace with a small diamond pendant". Be specific and concise. ONLY return the description, nothing else.' },
                        { inlineData: { mimeType: 'image/jpeg', data: imageBase64.split(',')[1] || imageBase64 } }
                    ]
                }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 100 }
            })
        });

        if (response.ok) {
            const data = await response.json();
            const desc = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (desc) {
                console.log('Jewelry description:', desc);
                return desc;
            }
        }
    } catch (e) {
        console.warn('Gemini analysis failed, using default:', e.message);
    }

    return 'elegant jewelry piece';
}

// Tek varyasyon uret - template varsa Kontext, yoksa product-photography
async function generateSingleVariation(sceneDescription, falKey, jewelryDesc) {
    if (state.templateImage && jewelryDesc) {
        const kontextPrompt = `Add ${jewelryDesc} on the model in this photo. ${sceneDescription}. Keep the model exactly the same. Only add the jewelry. Professional quality, sharp jewelry details.`;
        const result = await callFalAPI('fal-ai/flux-pro/kontext', {
            image_url: state.templateImage,
            prompt: kontextPrompt,
            guidance_scale: 4.0,
            num_inference_steps: 28,
            output_format: 'jpeg'
        }, falKey);
        if (result?.images?.[0]?.url) {
            return await fetchImageAsBase64(result.images[0].url);
        }
    } else {
        const result = await callFalAPI('fal-ai/image-apps-v2/product-photography', {
            product_image_url: state.originalBase64,
            prompt: sceneDescription
        }, falKey);
        if (result?.images?.[0]?.url) {
            return await fetchImageAsBase64(result.images[0].url);
        }
    }
    return null;
}

// Sahne aciklamasi olustur
function buildSceneDescription(outfit, pose, scene, style) {
    const parts = [];

    // Kiyafet/Model
    if (outfit && outfit.prompt && outfit.id !== 'none') {
        parts.push(outfit.prompt);
    }

    // Cekim acisi
    if (pose && pose.prompt) {
        parts.push(pose.prompt);
    }

    // Sahne/Arka plan
    if (scene) {
        parts.push(`${scene.background}, ${scene.lighting}`);
        if (scene.props && scene.props !== 'None') {
            parts.push(`with ${scene.props}`);
        }
    }

    // Stil
    if (style) {
        parts.push(`${style.lighting} lighting, ${style.mood} atmosphere`);
    }

    // Genel kalite parametreleri
    parts.push('professional jewelry photography, high-end commercial quality, sharp focus on jewelry details, beautiful lighting');

    // Custom prompt varsa ekle
    const customPrompt = document.getElementById('customPrompt')?.value?.trim();
    if (customPrompt) {
        parts.push(customPrompt);
    }

    return parts.join(', ');
}

async function previewJewelryPlacement() {
    if (!state.originalBase64) {
        showToast('Please upload an image first!', 'error');
        return;
    }

    const falKey = state.settings.falApiKey;
    if (!falKey) {
        showToast('Fal.ai API key gerekli - Ayarlardan girin', 'error');
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

            showResultPreview(withWhiteBackground);

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
        showToast('Önce bir görsel yükleyin!', 'error');
        return;
    }

    const geminiKey = state.settings.geminiApiKey;
    if (!geminiKey) {
        showToast('Gemini API key gerekli - Ayarlardan girin', 'error');
        openSettings();
        return;
    }

    showLoader('SEO Pro+ oluşturuluyor... AI görsel analizi yapılıyor');

    try {
        // Kullanıcının girdiği ek özellikler
        const productFeatures = document.getElementById('seoProductFeatures')?.value?.trim() || '';
        const userInputSection = productFeatures
            ? `\n\n===== KULLANICININ GİRDİĞİ ÜRÜN ÖZELLİKLERİ =====\n${productFeatures}\n\nBu özellikleri SEO içeriğinde MUTLAKA kullan ve vurgula!`
            : '';

        const seoPrompt = `SEN BİR TRENDYOL SEO UZMANSIN.

===== TRENDYOL ÜRÜN YAPISI =====
1️⃣ BAŞLIK (99 karakter) → SADECE ARAMA KELİMELERİ
2️⃣ AÇIKLAMA → Detaylı bilgi ve hikaye
3️⃣ BARKOD → 8680 ile başlayan 13 haneli kod
4️⃣ MODEL KODU → KLY-RG-001 formatında

===== BAŞLIK FORMÜLÜ =====
[Cinsiyet] + [Malzeme] + [Ürün Tipi] + [Taş] + [Tasarım] + [Stil kelimeleri]

===== GÖRSEL ANALİZ REHBERİ =====
🎨 RENK: Metal rengi, taş renkleri, genel ton
💎 TASARIM: Şekil/Motif, doku, stil
📏 YAPI: Zincir tipi, pendant, boyut
🔍 MALZEME TAHMİNİ: Görünüme göre

${userInputSection}

===== JSON ÇIKTISI =====
{
    "visualAnalysis": {
        "productType": "Kolye/Yüzük/Bileklik/Küpe/Set",
        "metalColor": "Altın/Gümüş/Rose Gold/Antik",
        "stoneType": "Zirkon/İnci/Doğal Taş/Yok",
        "stoneColor": "Şeffaf/Mavi/Yeşil/Siyah vb.",
        "designMotif": "Çiçek/Kalp/Yaprak/Geometrik vb.",
        "style": "Minimal/Bohem/Vintage/Statement",
        "chainType": "İnce zincir/Boncuklu/Örgü vb."
    },
    "barcode": "8680XXXXXXXXX",
    "modelCode": "KLY-RG-001",
    "title": "99 karakterlik SEO başlık",
    "altTitles": ["3 alternatif başlık"],
    "category": "Takı > Alt Kategori",
    "description": "Teknik açıklama",
    "storyDescription": "Duygusal hikaye açıklaması",
    "keywords": ["15 anahtar kelime"],
    "longTail": ["5 uzun kuyruk arama"],
    "hashtags": "#trendyol #kolye #takı"
}

MODEL KODU: KLY (Kolye), YZK (Yüzük), BLK (Bileklik), KPE (Küpe), SET, HLH (Halhal)
RENK: RG (Rose Gold), GMS (Gümüş), ALT (Altın), ANT (Antik)

SADECE JSON döndür!`;

        let seoData;
        const imageBase64 = state.processedImage || state.originalImage;

        // Görsel analiz için Gemini Vision API kullan
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;

        const requestBody = {
            contents: [{
                parts: [
                    { text: seoPrompt },
                    ...(imageBase64 ? [{
                        inlineData: {
                            mimeType: 'image/jpeg',
                            data: imageBase64.split(',')[1]
                        }
                    }] : [])
                ]
            }],
            generationConfig: { temperature: 0.3 }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) throw new Error('SEO oluşturulamadı');

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        seoData = parseSEOJson(text);

        if (!seoData) {
            throw new Error('SEO verisi parse edilemedi');
        }

        // State'e kaydet
        state.seo = seoData;

        // === UI GÜNCELLE ===
        updateSEOUI(seoData);

        // SEO sonuçlarını göster
        const seoResults = document.getElementById('seoResults');
        if (seoResults) seoResults.classList.remove('hidden');

        hideLoader();
        showToast('SEO Pro+ başarıyla oluşturuldu!', 'success');

    } catch (error) {
        console.error('SEO generation error:', error);
        hideLoader();
        showToast('SEO hatası: ' + error.message, 'error');
    }
}

// JSON parse helper
function parseSEOJson(text) {
    try {
        let jsonStr = text;
        // Markdown code block varsa çıkar
        const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
            jsonStr = codeBlockMatch[1].trim();
        }
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
    } catch (e) {
        console.error('JSON parse error:', e);
    }
    return null;
}

// SEO UI güncelleme
function updateSEOUI(seoData) {
    // 1. Görsel Analiz Sonuçları
    const vaContainer = document.getElementById('visualAnalysisContent');
    if (vaContainer && seoData.visualAnalysis) {
        vaContainer.innerHTML = '';
        const va = seoData.visualAnalysis;
        const analysisLabels = {
            productType: '📦 Ürün Tipi',
            metalColor: '🎨 Metal Rengi',
            stoneType: '💎 Taş Tipi',
            stoneColor: '🔮 Taş Rengi',
            designMotif: '✨ Tasarım',
            style: '🏷️ Stil',
            chainType: '⛓️ Zincir'
        };
        Object.entries(va).forEach(([key, value]) => {
            if (value && value !== 'Yok' && value !== '-') {
                const div = document.createElement('div');
                div.className = 'bg-purple-500/10 rounded px-2 py-1';
                div.innerHTML = `<span class="text-purple-300">${analysisLabels[key] || key}:</span> <span class="text-white">${value}</span>`;
                vaContainer.appendChild(div);
            }
        });
    }

    // 2. Barkod ve Model Kodu
    const barcodeEl = document.getElementById('seoBarcode');
    const modelCodeEl = document.getElementById('seoModelCode');
    if (barcodeEl) barcodeEl.value = seoData.barcode || '';
    if (modelCodeEl) modelCodeEl.value = seoData.modelCode || '';

    // 3. Ana Başlık
    const titleEl = document.getElementById('seoTitle');
    if (titleEl) {
        titleEl.value = seoData.title || '';
        updateCharCount('title');
    }

    // 4. Alternatif Başlıklar
    const altTitlesContainer = document.getElementById('altTitles');
    if (altTitlesContainer && seoData.altTitles) {
        altTitlesContainer.innerHTML = '';
        seoData.altTitles.forEach((title, idx) => {
            const div = document.createElement('div');
            div.className = 'flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-2';
            div.innerHTML = `
                <span class="text-slate-500 text-xs">${idx + 1}.</span>
                <span class="flex-1 text-xs">${title}</span>
                <button onclick="copyText('${title.replace(/'/g, "\\'")}')" class="text-emerald-400 hover:text-emerald-300">
                    <i class="fa-solid fa-copy text-xs"></i>
                </button>
            `;
            altTitlesContainer.appendChild(div);
        });
    }

    // 5. Kategori
    const categoryEl = document.getElementById('seoCategory');
    if (categoryEl) categoryEl.value = seoData.category || '';

    // 6. Teknik Açıklama
    const descEl = document.getElementById('seoDescription');
    if (descEl) {
        descEl.value = seoData.description || '';
        updateCharCount('desc');
    }

    // 7. Hikayeleştirilmiş Açıklama
    const storyEl = document.getElementById('seoStoryDescription');
    if (storyEl) storyEl.textContent = seoData.storyDescription || '';

    // 8. Anahtar Kelimeler (tag olarak)
    const keywordsContainer = document.getElementById('seoKeywords');
    if (keywordsContainer && seoData.keywords) {
        keywordsContainer.innerHTML = '';
        const keywords = Array.isArray(seoData.keywords) ? seoData.keywords : seoData.keywords.split(',');
        keywords.forEach(keyword => {
            const span = document.createElement('span');
            span.className = 'px-2 py-1 bg-emerald-600/20 text-emerald-400 rounded text-xs cursor-pointer hover:bg-emerald-600/40';
            span.textContent = keyword.trim();
            span.onclick = () => copyText(keyword.trim());
            keywordsContainer.appendChild(span);
        });
    }

    // 9. Long-tail Keywords
    const longTailContainer = document.getElementById('seoLongTail');
    if (longTailContainer && seoData.longTail) {
        longTailContainer.innerHTML = '';
        seoData.longTail.forEach(term => {
            const span = document.createElement('span');
            span.className = 'px-2 py-1 bg-blue-600/20 text-blue-400 rounded text-xs cursor-pointer hover:bg-blue-600/40';
            span.textContent = term;
            span.onclick = () => copyText(term);
            longTailContainer.appendChild(span);
        });
    }

    // 10. Hashtags
    const hashtagsEl = document.getElementById('seoHashtags');
    if (hashtagsEl) {
        hashtagsEl.textContent = seoData.hashtags || '';
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

    showResultPreview(item.image);

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

function downloadImage(format) {
    const imageToDownload = state.processedImage || state.originalImage;

    if (!imageToDownload) {
        showToast('Indirilecek gorsel yok!', 'error');
        return;
    }

    const ext = format || state.settings.outputFormat || 'png';
    const link = document.createElement('a');
    link.download = `trendyol-pro-${Date.now()}.${ext}`;
    link.href = imageToDownload;
    link.click();

    showToast('Gorsel indirildi!', 'success');
}

// ============================================
// 13. SEO FONKSIYONLARI
// ============================================

function updateCharCount(type) {
    if (type === 'title') {
        const input = document.getElementById('seoTitle');
        const counter = document.getElementById('titleCharCount');
        if (input && counter) {
            const length = input.value.length;
            counter.textContent = `${length}/99`;
            counter.style.color = length > 99 ? '#ff4444' : length > 90 ? '#ffaa00' : '#10b981';
        }
    } else if (type === 'desc') {
        const input = document.getElementById('seoDescription');
        const counter = document.getElementById('descCharCount');
        if (input && counter) {
            const length = input.value.length;
            counter.textContent = `${length}/500`;
            counter.style.color = length > 500 ? '#ff4444' : length > 450 ? '#ffaa00' : '#10b981';
        }
    }
}

function copyText(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Kopyalandı!', 'success');
    }).catch(err => {
        console.error('Copy failed:', err);
        showToast('Kopyalama başarısız', 'error');
    });
}

function copySEO(field) {
    let text = '';

    switch (field) {
        case 'barcode':
            text = document.getElementById('seoBarcode')?.value || '';
            break;
        case 'modelCode':
            text = document.getElementById('seoModelCode')?.value || '';
            break;
        case 'title':
            text = document.getElementById('seoTitle')?.value || '';
            break;
        case 'category':
            text = document.getElementById('seoCategory')?.value || '';
            break;
        case 'description':
            text = document.getElementById('seoDescription')?.value || '';
            break;
        case 'story':
            text = document.getElementById('seoStoryDescription')?.textContent || '';
            break;
        case 'hashtags':
            text = document.getElementById('seoHashtags')?.textContent || '';
            break;
        default:
            text = state.seo[field] || '';
    }

    if (text) {
        copyText(text);
    } else {
        showToast('Kopyalanacak içerik yok', 'warning');
    }
}

function copyAllSEO() {
    const seo = state.seo || {};
    const barcode = document.getElementById('seoBarcode')?.value || seo.barcode || '';
    const modelCode = document.getElementById('seoModelCode')?.value || seo.modelCode || '';
    const title = document.getElementById('seoTitle')?.value || seo.title || '';
    const category = document.getElementById('seoCategory')?.value || seo.category || '';
    const description = document.getElementById('seoDescription')?.value || seo.description || '';
    const story = document.getElementById('seoStoryDescription')?.textContent || seo.storyDescription || '';
    const keywords = Array.isArray(seo.keywords) ? seo.keywords.join(', ') : (seo.keywords || '');
    const hashtags = document.getElementById('seoHashtags')?.textContent || seo.hashtags || '';

    const allSEO = `📦 BARKOD: ${barcode}
🏷️ MODEL KODU: ${modelCode}

📝 BAŞLIK:
${title}

📁 KATEGORİ:
${category}

📋 TEKNİK AÇIKLAMA:
${description}

💝 HİKAYE AÇIKLAMA:
${story}

🔑 ANAHTAR KELİMELER:
${keywords}

#️⃣ HASHTAGS:
${hashtags}`;

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
        name: 'Siyah V-Yaka',
        color: '#000000',
        style: 'V-neck top',
        description: 'Classic black V-neck for elegant contrast',
        prompt: 'model wearing elegant black V-neck top, deep neckline showing decollete, perfect for necklace display'
    },
    white_off: {
        id: 'white_off',
        name: 'Beyaz Omuz Açık',
        color: '#FFFFFF',
        style: 'Off-shoulder',
        description: 'White off-shoulder for delicate pieces',
        prompt: 'model wearing white off-shoulder blouse, bare shoulders, elegant and romantic style'
    },
    cream_silk: {
        id: 'cream_silk',
        name: 'Krem İpek',
        color: '#FFF8DC',
        style: 'Silk blouse',
        description: 'Luxurious cream silk for premium look',
        prompt: 'model wearing luxurious cream silk blouse, soft satin texture, premium elegant appearance'
    },
    burgundy: {
        id: 'burgundy',
        name: 'Bordo',
        color: '#800020',
        style: 'V-neck',
        description: 'Rich burgundy for gold jewelry',
        prompt: 'model wearing rich burgundy wine-colored top, deep V-neck, perfect contrast for gold jewelry'
    },
    navy: {
        id: 'navy',
        name: 'Lacivert',
        color: '#000080',
        style: 'Classic top',
        description: 'Navy blue for silver/pearl jewelry',
        prompt: 'model wearing navy blue classic top, sophisticated dark blue, ideal for silver and pearl jewelry'
    },
    nude: {
        id: 'nude',
        name: 'Ten Rengi',
        color: '#E8D4C4',
        style: 'Simple top',
        description: 'Neutral nude for versatile styling',
        prompt: 'model wearing nude beige simple top, neutral skin-tone color, minimal distraction from jewelry'
    },
    forest: {
        id: 'forest',
        name: 'Orman Yeşili',
        color: '#228B22',
        style: 'Elegant top',
        description: 'Forest green for gold contrast',
        prompt: 'model wearing forest green elegant top, rich emerald green, beautiful contrast for gold jewelry'
    },
    black_turtleneck: {
        id: 'black_turtleneck',
        name: 'Siyah Balıkçı',
        color: '#000000',
        style: 'Turtleneck',
        description: 'Black turtleneck for statement pieces',
        prompt: 'model wearing black turtleneck sweater, high neck, perfect backdrop for statement earrings'
    },
    strapless: {
        id: 'strapless',
        name: 'Straplez',
        color: '#000000',
        style: 'Strapless',
        description: 'Strapless for maximum jewelry visibility',
        prompt: 'model wearing black strapless top, bare shoulders and neck, maximum visibility for necklace'
    },
    none: {
        id: 'none',
        name: 'Kıyafetsiz',
        color: 'transparent',
        style: 'Skin only',
        description: 'Direct skin/model presentation',
        prompt: 'bare skin, no clothing visible, focus entirely on jewelry piece, clean minimal presentation'
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
        name: 'Önden Görünüm',
        angle: 0,
        description: 'Direct front facing',
        prompt: 'front view, straight on camera angle, model facing camera directly, symmetrical composition'
    },
    right: {
        id: 'right',
        name: 'Sağ Profil',
        angle: 90,
        description: 'Right side profile',
        prompt: 'right side profile view, 90 degree angle from right, showing earring or side of necklace clearly'
    },
    left: {
        id: 'left',
        name: 'Sol Profil',
        angle: -90,
        description: 'Left side profile',
        prompt: 'left side profile view, 90 degree angle from left, elegant profile shot'
    },
    three_quarter: {
        id: 'three_quarter',
        name: '3/4 Açı',
        angle: 45,
        description: '45 degree angle view',
        prompt: 'three quarter view, 45 degree angle, slight turn showing depth and dimension of jewelry'
    },
    down: {
        id: 'down',
        name: 'Üstten Açı',
        angle: 0,
        description: 'Camera looking down',
        prompt: 'high angle shot, camera looking down at 30 degrees, elegant downward perspective'
    },
    up: {
        id: 'up',
        name: 'Alttan Açı',
        angle: 0,
        description: 'Camera looking up',
        prompt: 'low angle shot, camera looking up slightly, dramatic upward perspective, powerful composition'
    },
    closeup: {
        id: 'closeup',
        name: 'Yakın Çekim',
        angle: 0,
        description: 'Tight macro shot',
        prompt: 'extreme close-up, macro shot, tight crop focusing on jewelry details, showing texture and craftsmanship'
    },
    detail: {
        id: 'detail',
        name: 'Detay Çekim',
        angle: 0,
        description: 'Detail focus shot',
        prompt: 'detail shot, focus on jewelry clasp or unique feature, shallow depth of field, artistic detail focus'
    },
    surface: {
        id: 'surface',
        name: 'Düz Yüzey',
        angle: 0,
        description: 'Flat lay on surface',
        prompt: 'flat lay photography, jewelry placed on elegant surface, top-down view, styled product shot'
    },
    lifestyle: {
        id: 'lifestyle',
        name: 'Yaşam Tarzı',
        angle: 0,
        description: 'Lifestyle candid shot',
        prompt: 'lifestyle photography, natural candid moment, model wearing jewelry in real-life setting'
    }
};

// ============================================
// 17. POPÜLER POZ ŞABLONLARI
// ============================================

const popularTemplates = {
    necklace: {
        name: 'Kolye Şablonları',
        icon: 'fa-gem',
        variations: [
            { pose: 'front', outfit: 'black_vneck', scene: 'studio_clean', label: 'Klasik Önden' },
            { pose: 'three_quarter', outfit: 'strapless', scene: 'studio_clean', label: '3/4 Açık Omuz' },
            { pose: 'closeup', outfit: 'black_vneck', scene: 'luxury_dark', label: 'Detay Lüks' },
            { pose: 'down', outfit: 'cream_silk', scene: 'romantic', label: 'Romantik Üstten' }
        ]
    },
    bracelet: {
        name: 'Bileklik Şablonları',
        icon: 'fa-ring',
        variations: [
            { pose: 'front', outfit: 'none', scene: 'studio_clean', label: 'El Üstü Klasik' },
            { pose: 'three_quarter', outfit: 'none', scene: 'minimalist', label: 'Açılı El' },
            { pose: 'detail', outfit: 'none', scene: 'luxury_dark', label: 'Detay Çekim' },
            { pose: 'lifestyle', outfit: 'cream_silk', scene: 'golden_hour', label: 'Yaşam Tarzı' }
        ]
    },
    earring: {
        name: 'Küpe Şablonları',
        icon: 'fa-star',
        variations: [
            { pose: 'right', outfit: 'black_turtleneck', scene: 'studio_clean', label: 'Sağ Profil' },
            { pose: 'left', outfit: 'black_turtleneck', scene: 'studio_clean', label: 'Sol Profil' },
            { pose: 'closeup', outfit: 'black_vneck', scene: 'luxury_dark', label: 'Yakın Detay' },
            { pose: 'three_quarter', outfit: 'white_off', scene: 'romantic', label: 'Romantik Açı' }
        ]
    },
    ring: {
        name: 'Yüzük Şablonları',
        icon: 'fa-circle',
        variations: [
            { pose: 'front', outfit: 'none', scene: 'studio_clean', label: 'Parmak Üstü' },
            { pose: 'closeup', outfit: 'none', scene: 'luxury_dark', label: 'Makro Detay' },
            { pose: 'surface', outfit: 'none', scene: 'minimalist', label: 'Flat Lay' },
            { pose: 'lifestyle', outfit: 'nude', scene: 'golden_hour', label: 'Doğal Görünüm' }
        ]
    },
    set: {
        name: 'Set Şablonları',
        icon: 'fa-layer-group',
        variations: [
            { pose: 'front', outfit: 'black_vneck', scene: 'studio_clean', label: 'Tam Set Görünüm' },
            { pose: 'surface', outfit: 'none', scene: 'luxury_dark', label: 'Flat Lay Set' },
            { pose: 'three_quarter', outfit: 'strapless', scene: 'editorial', label: 'Editorial Set' },
            { pose: 'lifestyle', outfit: 'cream_silk', scene: 'romantic', label: 'Yaşam Tarzı Set' }
        ]
    }
};

// Popüler şablon uygula
function applyPopularTemplate(category, variationIndex) {
    const template = popularTemplates[category];
    if (!template || !template.variations[variationIndex]) {
        showToast('Şablon bulunamadı', 'error');
        return;
    }

    const variation = template.variations[variationIndex];

    // Ayarları uygula
    selectPose(variation.pose);
    selectOutfit(variation.outfit);
    selectScene(variation.scene);

    showToast(`Şablon uygulandı: ${variation.label}`, 'success');
}

// ============================================
// 17.5 ÇOKLU VARYASYON ÜRETİMİ
// ============================================

// Çoklu varyasyon state
state.multiVariation = {
    isGenerating: false,
    results: [],
    queue: []
};

// Çoklu varyasyon üret
async function generateMultipleVariations(category = null) {
    if (state.isGenerating || state.multiVariation.isGenerating) {
        showToast('Zaten bir islem devam ediyor, lutfen bekleyin...', 'warning');
        return;
    }

    if (!state.originalBase64) {
        showToast('Önce bir görsel yükleyin!', 'error');
        return;
    }

    const falKey = state.settings.falApiKey;
    if (!falKey) {
        showToast('Fal.ai API key gerekli - Ayarlardan girin', 'error');
        openSettings();
        return;
    }

    // Kategori belirlenmemişse mevcut kategoriyi kullan
    const selectedCategory = category || state.selectedCategory || 'necklace';
    const template = popularTemplates[selectedCategory];

    if (!template) {
        showToast('Geçersiz kategori', 'error');
        return;
    }

    state.multiVariation.isGenerating = true;
    state.multiVariation.results = [];
    state.multiVariation.queue = [...template.variations];

    // Progress göster
    showMultiVariationProgress(0, template.variations.length);

    try {
        // Template varsa taki analizini onceden yap (her varyasyonda tekrar analiz etme)
        let jewelryDesc = null;
        if (state.templateImage) {
            showLoader('Taki analiz ediliyor...');
            jewelryDesc = await analyzeJewelryImage(state.originalBase64);
        }

        for (let i = 0; i < template.variations.length; i++) {
            const variation = template.variations[i];

            // Progress güncelle
            updateMultiVariationProgress(i + 1, template.variations.length, variation.label);

            // Ayarları uygula
            state.selectedPose = variation.pose;
            state.selectedOutfit = variation.outfit;
            state.selectedScene = variation.scene;

            // Sahne açıklaması oluştur
            const selectedOutfit = outfitPresets[variation.outfit] || outfitPresets.black_vneck;
            const selectedPose = posePresets[variation.pose] || posePresets.front;
            const selectedScene = scenePresets[variation.scene] || scenePresets.studio_clean;
            const selectedStyle = stylePresets[state.selectedStyle] || stylePresets.studio;

            const sceneDescription = buildSceneDescription(selectedOutfit, selectedPose, selectedScene, selectedStyle);

            // API cagrisi
            let resultBase64 = await generateSingleVariation(sceneDescription, falKey, jewelryDesc);

            if (resultBase64) {
                state.multiVariation.results.push({
                    image: resultBase64,
                    label: variation.label,
                    pose: variation.pose,
                    outfit: variation.outfit,
                    scene: variation.scene
                });
                addToGallery(resultBase64, variation.label);
            }

            if (i < template.variations.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        // Sonuçları göster
        hideMultiVariationProgress();
        showMultiVariationResults();
        showToast(`${state.multiVariation.results.length} varyasyon başarıyla oluşturuldu!`, 'success');

    } catch (error) {
        console.error('Multi-variation error:', error);
        hideMultiVariationProgress();
        showToast('Varyasyon üretim hatası: ' + error.message, 'error');
    } finally {
        state.multiVariation.isGenerating = false;
    }
}

// Özel varyasyonlar seç ve üret
async function generateCustomVariations(variations) {
    if (!state.originalBase64) {
        showToast('Önce bir görsel yükleyin!', 'error');
        return;
    }

    const falKey = state.settings.falApiKey;
    if (!falKey) {
        showToast('Fal.ai API key gerekli - Ayarlardan girin', 'error');
        openSettings();
        return;
    }

    if (!variations || variations.length === 0) {
        showToast('En az bir varyasyon seçin', 'error');
        return;
    }

    state.multiVariation.isGenerating = true;
    state.multiVariation.results = [];

    showMultiVariationProgress(0, variations.length);

    try {
        let jewelryDesc = null;
        if (state.templateImage) {
            jewelryDesc = await analyzeJewelryImage(state.originalBase64);
        }

        for (let i = 0; i < variations.length; i++) {
            const variation = variations[i];

            updateMultiVariationProgress(i + 1, variations.length, variation.label || `Varyasyon ${i + 1}`);

            const selectedOutfit = outfitPresets[variation.outfit] || outfitPresets.black_vneck;
            const selectedPose = posePresets[variation.pose] || posePresets.front;
            const selectedScene = scenePresets[variation.scene] || scenePresets.studio_clean;
            const selectedStyle = stylePresets[state.selectedStyle] || stylePresets.studio;

            const sceneDescription = buildSceneDescription(selectedOutfit, selectedPose, selectedScene, selectedStyle);

            let resultBase64 = await generateSingleVariation(sceneDescription, falKey, jewelryDesc);

            if (resultBase64) {
                state.multiVariation.results.push({
                    image: resultBase64,
                    label: variation.label || `Varyasyon ${i + 1}`,
                    pose: variation.pose,
                    outfit: variation.outfit,
                    scene: variation.scene
                });
                addToGallery(resultBase64, variation.label || `Var. ${i + 1}`);
            }

            if (i < variations.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        hideMultiVariationProgress();
        showMultiVariationResults();
        showToast(`${state.multiVariation.results.length} varyasyon oluşturuldu!`, 'success');

    } catch (error) {
        console.error('Custom variation error:', error);
        hideMultiVariationProgress();
        showToast('Varyasyon hatası: ' + error.message, 'error');
    } finally {
        state.multiVariation.isGenerating = false;
    }
}

// Progress UI
function showMultiVariationProgress(current, total) {
    let progressEl = document.getElementById('multiVariationProgress');

    if (!progressEl) {
        progressEl = document.createElement('div');
        progressEl.id = 'multiVariationProgress';
        progressEl.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50';
        progressEl.innerHTML = `
            <div class="bg-slate-800 rounded-2xl p-6 max-w-md w-full mx-4 text-center">
                <div class="mb-4">
                    <i class="fa-solid fa-wand-magic-sparkles text-4xl text-purple-400 animate-pulse"></i>
                </div>
                <h3 class="text-lg font-bold mb-2">Çoklu Varyasyon Üretiliyor</h3>
                <p id="mvProgressLabel" class="text-slate-400 text-sm mb-4">Hazırlanıyor...</p>
                <div class="w-full bg-slate-700 rounded-full h-3 mb-2">
                    <div id="mvProgressBar" class="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all duration-300" style="width: 0%"></div>
                </div>
                <p id="mvProgressCount" class="text-xs text-slate-500">${current}/${total}</p>
            </div>
        `;
        document.body.appendChild(progressEl);
    }

    progressEl.style.display = 'flex';
}

function updateMultiVariationProgress(current, total, label) {
    const progressBar = document.getElementById('mvProgressBar');
    const progressLabel = document.getElementById('mvProgressLabel');
    const progressCount = document.getElementById('mvProgressCount');

    if (progressBar) {
        progressBar.style.width = `${(current / total) * 100}%`;
    }
    if (progressLabel) {
        progressLabel.textContent = `Üretiliyor: ${label}`;
    }
    if (progressCount) {
        progressCount.textContent = `${current}/${total}`;
    }
}

function hideMultiVariationProgress() {
    const progressEl = document.getElementById('multiVariationProgress');
    if (progressEl) {
        progressEl.style.display = 'none';
    }
}

// Sonuçları göster
function showMultiVariationResults() {
    const results = state.multiVariation.results;
    if (results.length === 0) return;

    // Son üretilen görseli ana preview'e koy
    if (results.length > 0) {
        state.processedImage = results[results.length - 1].image;
        showResultPreview(state.processedImage);
    }

    // Modal ile tüm sonuçları göster
    let resultsModal = document.getElementById('multiVariationResultsModal');

    if (!resultsModal) {
        resultsModal = document.createElement('div');
        resultsModal.id = 'multiVariationResultsModal';
        resultsModal.className = 'fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4';
        document.body.appendChild(resultsModal);
    }

    resultsModal.innerHTML = `
        <div class="bg-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div class="p-4 border-b border-slate-700 flex justify-between items-center">
                <h3 class="text-lg font-bold">
                    <i class="fa-solid fa-images mr-2 text-purple-400"></i>
                    Üretilen Varyasyonlar (${results.length})
                </h3>
                <button onclick="closeMultiVariationResults()" class="text-slate-400 hover:text-white">
                    <i class="fa-solid fa-times text-xl"></i>
                </button>
            </div>
            <div class="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    ${results.map((result, idx) => `
                        <div class="relative group">
                            <img src="${result.image}" alt="${result.label}" class="w-full aspect-square object-cover rounded-lg">
                            <div class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex flex-col items-center justify-center gap-2">
                                <p class="text-xs font-medium">${result.label}</p>
                                <div class="flex gap-2">
                                    <button onclick="downloadVariation(${idx})" class="p-2 bg-emerald-600 rounded-lg hover:bg-emerald-500">
                                        <i class="fa-solid fa-download text-xs"></i>
                                    </button>
                                    <button onclick="selectVariation(${idx})" class="p-2 bg-purple-600 rounded-lg hover:bg-purple-500">
                                        <i class="fa-solid fa-check text-xs"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="p-4 border-t border-slate-700 flex justify-between">
                <button onclick="downloadAllVariations()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium">
                    <i class="fa-solid fa-download mr-2"></i>Tümünü İndir
                </button>
                <button onclick="closeMultiVariationResults()" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm">
                    Kapat
                </button>
            </div>
        </div>
    `;

    resultsModal.style.display = 'flex';
}

function closeMultiVariationResults() {
    const modal = document.getElementById('multiVariationResultsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function selectVariation(index) {
    const result = state.multiVariation.results[index];
    if (result) {
        state.processedImage = result.image;
        showResultPreview(result.image);
        closeMultiVariationResults();
        showToast(`Seçildi: ${result.label}`, 'success');
    }
}

function downloadVariation(index) {
    const result = state.multiVariation.results[index];
    if (result) {
        const link = document.createElement('a');
        link.download = `trendyol-${result.label.replace(/\s+/g, '-')}-${Date.now()}.png`;
        link.href = result.image;
        link.click();
        showToast('İndiriliyor...', 'success');
    }
}

function downloadAllVariations() {
    state.multiVariation.results.forEach((result, idx) => {
        setTimeout(() => {
            const link = document.createElement('a');
            link.download = `trendyol-${result.label.replace(/\s+/g, '-')}-${Date.now()}.png`;
            link.href = result.image;
            link.click();
        }, idx * 500);
    });
    showToast(`${state.multiVariation.results.length} görsel indiriliyor...`, 'success');
}

// Quick generate - mevcut kategoriye göre 4 varyasyon
function quickGenerateVariations() {
    const category = state.selectedCategory || 'necklace';
    generateMultipleVariations(category);
}

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
    const canvas = document.getElementById('interactiveCanvas');
    const placeholder = document.getElementById('previewPlaceholder');
    const positionControls = document.getElementById('positionControls');

    if (canvas) {
        canvas.classList.remove('hidden');
        canvas.style.display = 'block';
        canvas.width = 600;
        canvas.height = 800;
        state.interactiveMode = true;
        updateInteractivePreview();
        setupCanvasDrag();
        setupKeyboardControls();
    }
    if (placeholder) placeholder.style.display = 'none';
    if (positionControls) positionControls.classList.remove('hidden');
}

function hideInteractivePreview() {
    const canvas = document.getElementById('interactiveCanvas');
    const positionControls = document.getElementById('positionControls');

    if (canvas) {
        canvas.classList.add('hidden');
        canvas.style.display = 'none';
        state.interactiveMode = false;
    }
    if (positionControls) positionControls.classList.add('hidden');
}

function getCanvasComposite() {
    const canvas = document.getElementById('interactiveCanvas');
    if (canvas && state.templateImage) {
        return canvas.toDataURL('image/png');
    }
    return null;
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
// 19. MARKA MODELİ
// ============================================

function toggleBrandModel() {
    state.brandModel.enabled = !state.brandModel.enabled;
    const btn = document.getElementById('brandModelToggleBtn');
    const dot = document.getElementById('brandModelToggleDot');

    if (state.brandModel.enabled) {
        if (btn) { btn.classList.remove('bg-slate-600'); btn.classList.add('bg-amber-500'); }
        if (dot) { dot.classList.remove('bg-slate-400'); dot.classList.add('bg-white'); dot.style.left = '18px'; }
    } else {
        if (btn) { btn.classList.remove('bg-amber-500'); btn.classList.add('bg-slate-600'); }
        if (dot) { dot.classList.remove('bg-white'); dot.classList.add('bg-slate-400'); dot.style.left = '2px'; }
    }

    saveBrandModelToStorage();
    showToast(state.brandModel.enabled ? 'Marka modeli aktif' : 'Marka modeli pasif', 'info');
}

function handleBrandModelUpload(event) {
    const files = Array.from(event.target.files);
    const remainingSlots = state.brandModel.maxPhotos - state.brandModel.photos.length;

    if (files.length > remainingSlots) {
        showToast(`En fazla ${state.brandModel.maxPhotos} fotoğraf yükleyebilirsiniz`, 'warning');
    }

    const filesToProcess = files.slice(0, Math.max(0, remainingSlots));

    filesToProcess.forEach(file => {
        if (!file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            state.brandModel.photos.push(e.target.result);
            updateBrandModelGallery();
            saveBrandModelToStorage();
            showToast(`Referans fotoğrafı eklendi (${state.brandModel.photos.length}/${state.brandModel.maxPhotos})`, 'success');
        };
        reader.readAsDataURL(file);
    });

    event.target.value = '';
}

function updateBrandModelGallery() {
    const gallery = document.getElementById('brandModelGallery');
    if (!gallery) return;

    if (state.brandModel.photos.length === 0) {
        gallery.classList.add('hidden');
        return;
    }

    gallery.classList.remove('hidden');
    gallery.innerHTML = state.brandModel.photos.map((photo, idx) => `
        <div class="relative group">
            <img src="${photo}" class="w-full aspect-square object-cover rounded-lg border border-slate-600">
            <button onclick="removeBrandModelPhoto(${idx})"
                class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `).join('');
}

function removeBrandModelPhoto(index) {
    state.brandModel.photos.splice(index, 1);
    updateBrandModelGallery();
    saveBrandModelToStorage();
    showToast('Fotoğraf kaldırıldı', 'info');
}

function saveBrandModelName() {
    const nameInput = document.getElementById('brandModelName');
    if (nameInput) {
        state.brandModel.name = nameInput.value;
        saveBrandModelToStorage();
    }
}

function saveBrandModelToStorage() {
    try {
        localStorage.setItem('brandModel', JSON.stringify({
            enabled: state.brandModel.enabled,
            name: state.brandModel.name,
            photos: state.brandModel.photos
        }));
    } catch (e) {
        console.warn('Brand model storage error:', e);
    }
}

function loadBrandModel() {
    try {
        const saved = localStorage.getItem('brandModel');
        if (saved) {
            const data = JSON.parse(saved);
            state.brandModel.enabled = data.enabled || false;
            state.brandModel.name = data.name || '';
            state.brandModel.photos = data.photos || [];

            if (state.brandModel.enabled) {
                const btn = document.getElementById('brandModelToggleBtn');
                const dot = document.getElementById('brandModelToggleDot');
                if (btn) { btn.classList.remove('bg-slate-600'); btn.classList.add('bg-amber-500'); }
                if (dot) { dot.classList.remove('bg-slate-400'); dot.classList.add('bg-white'); dot.style.left = '18px'; }
            }

            const nameInput = document.getElementById('brandModelName');
            if (nameInput) nameInput.value = state.brandModel.name;

            updateBrandModelGallery();
        }
    } catch (e) {
        console.warn('Brand model load error:', e);
    }
}

// Brand model yüz uygula (face swap)
// FLUX Edit ciktisinda model yuzu varsa, marka modelinin yuzuyle degistir
async function applyBrandModelFace(imageBase64) {
    if (!state.brandModel.enabled || state.brandModel.photos.length === 0) {
        return imageBase64;
    }

    const falKey = state.settings.falApiKey;
    try {
        console.log('[Brand Model] Applying face swap...');
        const referencePhoto = state.brandModel.photos[0];

        const faceSwapData = await callFalAPI('fal-ai/face-swap', {
            base_image_url: imageBase64,     // FLUX Edit ciktisi (model yuzu VAR)
            swap_image_url: referencePhoto    // Marka modeli yuzu
        }, falKey);

        if (faceSwapData?.image?.url) {
            const resultBase64 = await fetchImageAsBase64(faceSwapData.image.url);
            console.log('[Brand Model] Face swap successful');
            return resultBase64;
        }
    } catch (error) {
        console.warn('[Brand Model] Face swap failed:', error.message);
        if (error.message.includes('face')) {
            showToast('Yuz bulunamadi - model sablonunda yuz gorunur olmali', 'warning');
        } else {
            showToast('Face swap hatasi: ' + error.message, 'warning');
        }
    }

    return imageBase64;
}

function updateVideoSettings() {
    const durationEl = document.getElementById('videoDuration');
    const ratioEl = document.getElementById('videoAspectRatio');
    if (durationEl) state.video.duration = parseInt(durationEl.value);
    if (ratioEl) state.video.aspectRatio = ratioEl.value;
}

// ============================================
// 20. VIDEO OLUŞTURMA
// ============================================

async function generateVideo() {
    if (!state.originalBase64 && !state.processedImage) {
        showToast('Önce bir ürün görseli yükleyin!', 'error');
        return;
    }

    const falKey = state.settings.falApiKey;
    if (!falKey) {
        showToast('Fal.ai API key gerekli - Ayarlardan girin', 'error');
        openSettings();
        return;
    }

    if (state.video.isGenerating) {
        showToast('Video zaten oluşturuluyor...', 'warning');
        return;
    }

    state.video.isGenerating = true;

    try {
        // Step 1: Kaynak gorsel belirle
        let sourceImage = null;

        showLoader('Ürün görseli hazırlanıyor...');

        if (state.processedImage) {
            // Daha once olusturulmus gorsel var
            sourceImage = state.processedImage;
        } else {
            // Gorsel henuz uretilmemis, Kontext veya product-photography ile uret
            const selectedOutfit = outfitPresets[state.selectedOutfit] || outfitPresets.black_vneck;
            const selectedPose = posePresets[state.selectedPose] || posePresets.front;
            const selectedScene = scenePresets[state.selectedScene] || scenePresets.studio_clean;
            const selectedStyle = stylePresets[state.selectedStyle] || stylePresets.studio;
            const sceneDescription = buildSceneDescription(selectedOutfit, selectedPose, selectedScene, selectedStyle);

            let jewelryDesc = null;
            if (state.templateImage) {
                jewelryDesc = await analyzeJewelryImage(state.originalBase64);
            }

            sourceImage = await generateSingleVariation(sceneDescription, falKey, jewelryDesc);
            if (sourceImage) {
                state.processedImage = sourceImage;
            } else {
                sourceImage = state.originalBase64;
            }
        }

        // Step 2: Brand model face swap (eğer aktifse)
        if (state.brandModel.enabled && state.brandModel.photos.length > 0) {
            showLoader('Marka modeli yüzü uygulanıyor...');
            sourceImage = await applyBrandModelFace(sourceImage);
        }

        // Step 3: Video oluştur (MiniMax Hailuo)
        showLoader('Video oluşturuluyor... Bu işlem 1-2 dakika sürebilir');

        const videoPrompt = 'Elegant jewelry product showcase, gentle slow motion, soft studio lighting, professional commercial video, [Static shot]';

        const videoData = await callFalAPI('fal-ai/minimax/video-01/image-to-video', {
            image_url: sourceImage,
            prompt: videoPrompt,
            prompt_optimizer: true
        }, falKey);

        if (videoData?.video?.url) {
            state.video.result = videoData.video.url;

            // Video player'ı göster
            const videoEl = document.getElementById('previewVideo');
            const resultPreview = document.getElementById('resultPreview');
            const placeholder = document.getElementById('previewPlaceholder');
            const canvas = document.getElementById('interactiveCanvas');

            if (videoEl) {
                videoEl.src = videoData.video.url;
                videoEl.classList.remove('hidden');
                videoEl.style.display = 'block';
                videoEl.load();
            }
            if (resultPreview) { resultPreview.classList.add('hidden'); resultPreview.style.display = 'none'; }
            if (placeholder) placeholder.style.display = 'none';
            if (canvas) canvas.classList.add('hidden');

            // Download butonlarını göster
            const downloadActions = document.getElementById('downloadActions');
            if (downloadActions) downloadActions.classList.remove('hidden');

            const videoDownloadBtn = document.getElementById('videoDownloadBtn');
            if (videoDownloadBtn) videoDownloadBtn.classList.remove('hidden');

            hideLoader();
            showToast('Video başarıyla oluşturuldu!', 'success');
        } else {
            throw new Error('Video API sonuç döndürmedi');
        }

    } catch (error) {
        console.error('Video generation error:', error);
        hideLoader();
        showToast('Video hatası: ' + error.message, 'error');
    } finally {
        state.video.isGenerating = false;
    }
}

function downloadVideo() {
    if (!state.video.result) {
        showToast('İndirilecek video yok!', 'error');
        return;
    }

    const link = document.createElement('a');
    link.download = `trendyol-video-${Date.now()}.mp4`;
    link.href = state.video.result;
    link.target = '_blank';
    link.click();

    showToast('Video indiriliyor...', 'success');
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

    // Marka modelini yukle
    loadBrandModel();

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
// Çoklu varyasyon ve şablon fonksiyonları
window.applyPopularTemplate = applyPopularTemplate;
window.generateMultipleVariations = generateMultipleVariations;
window.generateCustomVariations = generateCustomVariations;
window.quickGenerateVariations = quickGenerateVariations;
window.closeMultiVariationResults = closeMultiVariationResults;
window.selectVariation = selectVariation;
window.downloadVariation = downloadVariation;
window.downloadAllVariations = downloadAllVariations;
// Brand model & video
window.toggleBrandModel = toggleBrandModel;
window.handleBrandModelUpload = handleBrandModelUpload;
window.removeBrandModelPhoto = removeBrandModelPhoto;
window.saveBrandModelName = saveBrandModelName;
window.updateVideoSettings = updateVideoSettings;
window.generateVideo = generateVideo;
window.downloadVideo = downloadVideo;
// Deploy trigger 1770671322
