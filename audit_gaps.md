# E2EE Doğrulama - Tespit Edilen Eksikler

## EKSİK 1: PreKey Reuse Engeli (X3DH)
- **Durum:** OPK tüketimi var (isUsed=true) ama SPK reuse kontrolü yok
- **Risk:** Aynı initial message tekrar gönderilirse reddedilmiyor
- **Çözüm:** x3dh.ts'te responder tarafına session nonce kontrolü ekle

## EKSİK 2: TweetNaCl X25519 Secret Key Base64 Saklama
- **Durum:** keyManager.ts satır 152,166 ve x3dh.ts satır 100,147'de secretKey encodeBase64 ile string'e çevriliyor
- **Risk:** TweetNaCl X25519 key'leri Web Crypto CryptoKey değil, Uint8Array → extractable:false uygulanamıyor
- **Not:** Bu Web Crypto API'nin X25519 desteklememesinden kaynaklı bir sınırlama. ECDH P-256 key'leri extractable:false.
- **Çözüm:** X25519 secret key'leri IndexedDB'de AES-GCM ile şifreleyerek sakla (zaten secureStore yapıyor)

## EKSİK 3: X3DH Initial Message Replay Kontrolü
- **Durum:** Replay edilen initial message reddedilmiyor
- **Çözüm:** Responder tarafına ephemeral key nonce tracking ekle

## EKSİK 4: localStorage'da device_id Migration
- **Durum:** keyManager.ts satır 333'te localStorage.getItem('sentinel_device_id') hâlâ okunuyor (migration)
- **Risk:** Düşük - sadece okuma, yazma yok
- **Çözüm:** Migration tamamlandıktan sonra localStorage'dan sil

## EKSİK 5: Sunucu Log Anonimleştirme
- **Durum:** Supabase sunucu tarafı - client'ta yapılamaz
- **Not:** Bu server-side bir konu, client-side audit kapsamı dışında
