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

## Notlar

- Uygulama tamamen client-side çalışır
- Google AI API key tarayıcıda localStorage'da saklanır
- Hiçbir sunucu tarafı kod gerekmez
- Tüm işlemler kullanıcının tarayıcısında gerçekleşir
