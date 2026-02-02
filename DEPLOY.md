# Trendyol Satış Asistanı - Ücretsiz Deploy Rehberi

## En Kolay Yöntem: Netlify Drop (30 saniye!)

1. **https://app.netlify.com/drop** adresine gidin
2. `public` klasörünü sürükleyip bırakın
3. **Tamamlandı!** Ücretsiz URL'niz hazır

---

## Alternatif 1: GitHub Pages (Kalıcı)

```bash
# 1. GitHub'da yeni repo oluşturun
# 2. Kodu push edin:
git remote add github https://github.com/KULLANICI_ADI/trendyol-asistan.git
git push -u github main

# 3. Settings > Pages > Source: main branch, /public folder
```

**URL:** `https://KULLANICI_ADI.github.io/trendyol-asistan`

---

## Alternatif 2: Vercel (Hızlı)

```bash
# Vercel CLI kurulumu
npm i -g vercel

# Deploy
cd public
vercel --prod
```

---

## Alternatif 3: Surge.sh

```bash
# Kurulum
npm i -g surge

# Deploy (email/şifre gerektirir)
cd public
surge . trendyol-asistan.surge.sh
```

---

## Alternatif 4: Cloudflare Pages

1. https://pages.cloudflare.com adresine gidin
2. GitHub/GitLab repo bağlayın veya direkt upload edin
3. Build ayarı: Yok (statik HTML)
4. Root: `/public`

---

## Lokal Test

```bash
# Basit HTTP sunucu
cd public
npx serve .

# veya Python ile
python3 -m http.server 8000
```

Tarayıcıda açın: http://localhost:3000 veya http://localhost:8000

---

## Demo Modu (Tek API Key ile Test)

Dışarıdan gelen kullanıcıların API key girmeden test edebilmesi için Demo Modu kullanabilirsiniz.

### Netlify'da Demo Modu Kurulumu

1. **Netlify Dashboard > Site Settings > Environment Variables** bölümüne gidin

2. **Şu değişkenleri ekleyin:**
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   FAL_API_KEY=your_fal_api_key_here
   ```

3. **Deploy edin** - Artık kullanıcılar "Demo Modu" toggle'ını açarak API key girmeden test edebilir!

### Vercel'de Demo Modu Kurulumu

1. **Vercel Dashboard > Project Settings > Environment Variables**

2. **Production ortamı için ekleyin:**
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   FAL_API_KEY=your_fal_api_key_here
   ```

3. **Redeploy edin**

### Nasıl Çalışır?

- Demo modunda API çağrıları Netlify/Vercel Functions üzerinden yapılır
- API key'leriniz environment variables'da güvenli şekilde saklanır
- Kullanıcılar key'leri göremez, sadece sistemi test edebilir

---

## Notlar

- Uygulama tamamen client-side çalışır (Demo modu hariç)
- Normal modda API key'ler tarayıcıda localStorage'da saklanır
- Demo modunda API key'ler sunucu tarafında güvenli saklanır
- Tüm görsel işlemler kullanıcının tarayıcısında gerçekleşir
