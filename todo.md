# Double Ratchet 10 Madde Kontrol + Ön İzleme + Hız Optimizasyonu

## DOUBLE RATCHET KONTROL SONUÇLARI
- [x] Madde 1: Benzersiz messageKey - GEÇER (kdfChainRatchet HKDF)
- [x] Madde 2: chainKey'den türetme - GEÇER (masterKey doğrudan kullanılmıyor)
- [x] Madde 3: chainKey tek yönlü ilerleme - GEÇER (HKDF)
- [ ] Madde 4: Eski key memory zeroing - EKSİK (GC'ye bırakılıyor)
- [x] Madde 5: DH ratchet zorunlu tetikleme - GEÇER
- [x] Madde 6: rootKey güncelleme - GEÇER (2 aşamalı)
- [x] Madde 7: rootKey geri hesaplanamaz - GEÇER (HKDF tek yönlü)
- [x] Madde 8: Replay rejection - GEÇER (isMessageSeen)
- [x] Madde 9: Aynı key+IV yasak - GEÇER (CSPRNG random IV)
- [x] Madde 10: Master secret reuse yok - GEÇER

## EKSİK DÜZELTMELER (TAMAMLANDI)
- [x] Memory zeroing: messageKey, chainKey, dhOutput kullanım sonrası sıfırla
- [x] Ön izleme sorunu teşhis ve çözüm
- [x] Uygulama geçiş hızı optimizasyonu

---

# KRİTİK HATA DÜZELTMELERİ
- [x] RateLimiter export hatası - Vite HMR cache temizlendi, server restart
- [x] Sayfa yenilenince mesajlar siliniyor - init()'e kanal restore + mesaj yükleme eklendi
- [x] Personel davet kodu üretilemiyor - encrypted_key alanı kaldırıldı

# Zaman Bazlı Anahtar Rotasyonu - TODO

## ratchet.ts Değişiklikleri
- [x] RatchetState interface'ine rotasyon metadata ekle (lastRotation, totalMessages, epoch)
- [x] Rotasyon sabitleri ekle (ROTATION_INTERVAL_MS, MAX_MESSAGES_PER_EPOCH)
- [x] `shouldRotateKeys()` fonksiyonu: zaman veya mesaj sayısı kontrolü
- [x] `performKeyRotation()` fonksiyonu: yeni DH key pair, rootKey/chainKey yenile, eski anahtarları secureZero
- [x] `ratchetEncrypt` içine rotasyon kontrolü entegre et
- [x] Rotasyon sonrası eski epoch verilerini temizle

## session.ts Değişiklikleri
- [x] SessionMeta'ya rotasyon sayacı ve son rotasyon zamanı ekle (RatchetState içinde)
- [x] `shouldRotateKeys()` fonksiyonu export edildi
- [x] `getRotationStatus()` fonksiyonu export edildi

## protocol.ts Değişiklikleri
- [x] ratchetEncrypt içinde otomatik rotasyon kontrolü (encrypt öncesi)
- [x] Re-export listesine shouldRotateKeys, performKeyRotation, getRotationStatus eklendi

## ChatContext Entegrasyonu
- [x] ratchetEncrypt içinde her mesajda otomatik kontrol (interval gereksiz)
- [x] Rotasyon DH ratchet olarak broadcast edilir (v4 formatında yeni DH pub key)

---

# SRI + MOBİL UI DÜZELTMELERİ

## SRI (Subresource Integrity)
- [x] index.html'deki CDN script/link'leri tespit et (Google Fonts + Vite bundle)
- [x] Custom Vite SRI plugin yazıldı (rollup-plugin-sri uyumsuz)
- [x] Build sonrası 9 dosyaya SHA-384 integrity hash eklendi
- [x] crossorigin="anonymous" attribute'ları eklendi
- [x] Google Fonts CSS'e SRI uygulanamaz (user-agent'a göre değişir) - belgelendi

## Mobil Mesaj Yazma Alanı
- [x] Chat ekranındaki input alanı analiz edildi
- [x] Mesaj input: h-9/w-full (mobil), h-10 (desktop), min-w-0 ile taşma önlendi
- [x] Butonlar: w-8 h-8 (mobil), w-10 h-10 (desktop), kompakt gap
- [x] Header: h-14 (mobil), h-16 (desktop)
- [x] Mesaj baloncukları: max-w-[85%] (mobil), max-w-[75%] (desktop)
- [x] Timer bar: overflow-x-auto, kompakt padding
- [x] Safe area: viewport-fit=cover + env(safe-area-inset-bottom)
- [x] 100dvh: Mobil klavye açıldığında layout düzeltmesi
- [x] Input zoom engelleme: 16px minimum font-size
- [x] Touch hedefleri: minimum 36px
