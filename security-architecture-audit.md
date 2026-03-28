# Güvenlik Mimarisi 10 Madde Analizi

## MEVCUT (Zaten Uygulanmış)
1. ✅ TLS/Gateway: Supabase HTTPS + WSS üzerinden çalışıyor
2. ✅ AES-256-GCM: Per-channel symmetric key, workspace key ile şifreleme (65 referans)
3. ❌ WebRTC: Yok - sesli/görüntülü arama yok
4. ❌ Speech-to-Text: Yok - local STT yok
5. ✅ Key Management: ECDH + HKDF + identity key + channel key (61 referans)
6. ✅ Rate Limiting: RateLimiter sınıfı mevcut (4 referans)
7. ✅ Replay Protection: seenMessages + REPLAY_WINDOW_SIZE + monotonic index
8. ❌ JWT: Supabase anon key kullanılıyor, custom JWT yok (frontend-only proje)
9. ❌ Audit Log: Yok
10. ❌ Key Revocation: Kısmen var (1 referans)

## MEVCUT AMA GÜÇLENDİRİLMESİ GEREKEN
- Forward Secrecy: Double Ratchet + zaman bazlı rotasyon mevcut (61 referans)
- Workspace Doğrulama: workspace_id kontrolü var ama channel membership yok
- Nonce/Timestamp: Mevcut ama sınırlı

## EKSİK VE UYGULANACAK
1. WebRTC P2P sesli/görüntülü arama (signaling via Supabase Realtime)
2. Local Speech-to-Text (tarayıcı Web Speech API veya Whisper.js)
3. Audit Log (metadata only - kim, ne zaman, hangi kanal, action type)
4. Key Revocation mekanizması (admin key iptal edebilmeli)
5. Channel membership doğrulama (kanal erişim kontrolü)
6. IP throttle (frontend-only projede sınırlı, Supabase RLS ile)

## FRONTEND-ONLY KISITLAMALAR
- JWT: Backend olmadan custom JWT uygulanamaz (Supabase anon key yeterli)
- IP Throttle: Server-side gerektirir, frontend'de rate limiter var
- Certificate Pinning: Mobil (Capacitor) tarafında yapılır, web'de tarayıcı yönetir
- HSM: Hardware Security Module - kurumsal on-prem kurulumda opsiyonel
- TURN Server: WebRTC eklendiğinde konfigüre edilecek
