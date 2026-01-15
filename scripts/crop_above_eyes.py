#!/usr/bin/env python3
"""
Göz Üstü Kırpma Scripti
=======================
Takı fotoğraflarında kimlik gizleme için göz seviyesinden yukarısını kırpar.

Kullanım:
    python crop_above_eyes.py --input ./input_folder --output ./output_folder

Gereksinimler:
    pip install mediapipe opencv-python pillow

Özellikler:
    - Göz landmark tespiti (MediaPipe)
    - Göz hizasından yukarısını kırpma
    - Çene, dudak, burun korunur
    - Orijinal dosyalara dokunmaz
    - Batch işlem desteği
"""

import cv2
import mediapipe as mp
import numpy as np
from pathlib import Path
import argparse
from PIL import Image
import sys

# MediaPipe Face Mesh
mp_face_mesh = mp.solutions.face_mesh

# Göz landmark indeksleri (MediaPipe Face Mesh)
# Sol göz üst sınırı ve sağ göz üst sınırı
LEFT_EYE_TOP = [159, 145, 153, 144, 163, 7]  # Sol göz üst kenarı
RIGHT_EYE_TOP = [386, 374, 380, 373, 390, 249]  # Sağ göz üst kenarı
LEFT_EYE_CENTER = [33, 133]  # Sol göz merkezi
RIGHT_EYE_CENTER = [362, 263]  # Sağ göz merkezi

# Kaş landmark indeksleri (göz üstü için)
LEFT_EYEBROW = [70, 63, 105, 66, 107]
RIGHT_EYEBROW = [300, 293, 334, 296, 336]


def find_eye_level(image_path: str) -> tuple:
    """
    Görüntüde göz seviyesini tespit eder.

    Returns:
        tuple: (eye_y_position, image_height, image_width) veya None
    """
    image = cv2.imread(str(image_path))
    if image is None:
        print(f"  ❌ Görüntü okunamadı: {image_path}")
        return None

    height, width = image.shape[:2]
    rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    with mp_face_mesh.FaceMesh(
        static_image_mode=True,
        max_num_faces=1,
        refine_landmarks=True,
        min_detection_confidence=0.5
    ) as face_mesh:

        results = face_mesh.process(rgb_image)

        if not results.multi_face_landmarks:
            print(f"  ⚠️ Yüz bulunamadı: {image_path}")
            return None

        face_landmarks = results.multi_face_landmarks[0]

        # Göz üst kenarlarının Y koordinatlarını topla
        eye_top_y_coords = []

        # Sol göz üst kenarı
        for idx in LEFT_EYE_TOP:
            landmark = face_landmarks.landmark[idx]
            eye_top_y_coords.append(landmark.y * height)

        # Sağ göz üst kenarı
        for idx in RIGHT_EYE_TOP:
            landmark = face_landmarks.landmark[idx]
            eye_top_y_coords.append(landmark.y * height)

        # Kaşlar (daha güvenli kırpma için)
        eyebrow_y_coords = []
        for idx in LEFT_EYEBROW + RIGHT_EYEBROW:
            landmark = face_landmarks.landmark[idx]
            eyebrow_y_coords.append(landmark.y * height)

        # Göz üst seviyesi (en üstteki göz noktası)
        eye_top_y = min(eye_top_y_coords)

        # Kaş üst seviyesi
        eyebrow_top_y = min(eyebrow_y_coords)

        # Güvenli kırpma noktası: kaş üstünden biraz yukarı
        # (göz kapağı tamamen görünsün ama kaşlar kesilsin)
        crop_y = int(eyebrow_top_y - 5)  # Kaş üst sınırından 5px yukarı

        # Minimum sınır kontrolü
        crop_y = max(0, crop_y)

        return (crop_y, height, width, image)


def crop_above_eyes(image_path: str, output_path: str, margin: int = 0) -> bool:
    """
    Görüntüyü göz seviyesinden kırpar.

    Args:
        image_path: Giriş görüntüsü yolu
        output_path: Çıkış görüntüsü yolu
        margin: Ekstra marj (piksel)

    Returns:
        bool: Başarılı ise True
    """
    result = find_eye_level(image_path)

    if result is None:
        return False

    crop_y, height, width, image = result

    # Marj ekle
    crop_y = max(0, crop_y - margin)

    # Kırpma işlemi
    cropped = image[crop_y:height, 0:width]

    # Kaydet
    cv2.imwrite(str(output_path), cropped)

    new_height = height - crop_y
    print(f"  ✅ Kırpıldı: {height}px → {new_height}px (üstten {crop_y}px kesildi)")

    return True


def process_folder(input_folder: str, output_folder: str, margin: int = 0) -> dict:
    """
    Klasördeki tüm görüntüleri işler.

    Args:
        input_folder: Giriş klasörü
        output_folder: Çıkış klasörü
        margin: Ekstra marj

    Returns:
        dict: İstatistikler
    """
    input_path = Path(input_folder)
    output_path = Path(output_folder)

    # Çıkış klasörünü oluştur
    output_path.mkdir(parents=True, exist_ok=True)

    # Desteklenen formatlar
    extensions = ['*.jpg', '*.jpeg', '*.png', '*.JPG', '*.JPEG', '*.PNG']

    # Tüm görüntüleri bul
    image_files = []
    for ext in extensions:
        image_files.extend(input_path.glob(ext))

    if not image_files:
        print(f"❌ Görüntü bulunamadı: {input_folder}")
        return {'total': 0, 'success': 0, 'failed': 0, 'no_face': 0}

    stats = {'total': len(image_files), 'success': 0, 'failed': 0, 'no_face': 0}

    print(f"\n📁 Klasör: {input_folder}")
    print(f"📊 Toplam {len(image_files)} görüntü bulundu\n")
    print("=" * 50)

    for i, img_file in enumerate(image_files, 1):
        print(f"\n[{i}/{len(image_files)}] {img_file.name}")

        output_file = output_path / f"cropped_{img_file.name}"

        result = crop_above_eyes(str(img_file), str(output_file), margin)

        if result:
            stats['success'] += 1
        else:
            # Yüz bulunamadıysa orijinali kopyala
            stats['no_face'] += 1
            try:
                # Orijinali çıkış klasörüne kopyala (işaretli)
                output_file_noface = output_path / f"noface_{img_file.name}"
                Image.open(img_file).save(output_file_noface)
                print(f"  📋 Yüz yok, orijinal kopyalandı: {output_file_noface.name}")
            except Exception as e:
                stats['failed'] += 1
                print(f"  ❌ Hata: {e}")

    print("\n" + "=" * 50)
    print(f"\n📊 SONUÇ:")
    print(f"   ✅ Başarılı: {stats['success']}")
    print(f"   ⚠️ Yüz bulunamadı: {stats['no_face']}")
    print(f"   ❌ Hatalı: {stats['failed']}")
    print(f"   📁 Çıkış: {output_folder}")

    return stats


def main():
    parser = argparse.ArgumentParser(
        description='Göz üstü kırpma - Kimlik gizleme için takı fotoğrafları',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Örnekler:
  python crop_above_eyes.py --input ./photos --output ./cropped
  python crop_above_eyes.py -i ./photos -o ./cropped --margin 10

Notlar:
  - Göz seviyesinden yukarısı (alın, saç) kırpılır
  - Çene, dudak, burun korunur
  - Orijinal dosyalara dokunulmaz
  - Yüz bulunamazsa dosya "noface_" prefix ile kopyalanır
        """
    )

    parser.add_argument(
        '-i', '--input',
        required=True,
        help='Giriş klasörü (jpg, png dosyaları)'
    )

    parser.add_argument(
        '-o', '--output',
        required=True,
        help='Çıkış klasörü'
    )

    parser.add_argument(
        '-m', '--margin',
        type=int,
        default=0,
        help='Ekstra marj piksel (varsayılan: 0)'
    )

    parser.add_argument(
        '--single',
        help='Tek dosya işle (klasör yerine)'
    )

    args = parser.parse_args()

    print("\n" + "=" * 50)
    print("   👁️ GÖZ ÜSTÜ KIRPMA SCRIPTİ")
    print("   Kimlik gizleme & Ürün odaklı görseller")
    print("=" * 50)

    if args.single:
        # Tek dosya modu
        output_path = Path(args.output)
        output_path.mkdir(parents=True, exist_ok=True)

        input_file = Path(args.single)
        output_file = output_path / f"cropped_{input_file.name}"

        print(f"\n📄 Dosya: {args.single}")
        crop_above_eyes(args.single, str(output_file), args.margin)
    else:
        # Klasör modu
        process_folder(args.input, args.output, args.margin)

    print("\n✨ İşlem tamamlandı!\n")


if __name__ == "__main__":
    main()
