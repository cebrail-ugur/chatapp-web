# ChatApp Ultra - Android (Capacitor) Güvenlik Sertleştirme Rehberi

**Versiyon:** 1.0 | **Tarih:** 27 Şubat 2026 | **Yazar:** Manus AI

---

## Genel Bakış

Bu rehber, ChatApp Ultra'nın Android APK'sını (Capacitor JS ile derlenen) devlet seviyesinde güvenlik sertleştirmesine tabi tutmak için gereken tüm adımları içermektedir. Tarayıcı tarafındaki sertleştirmeler (CSP, SRI, padding, header encryption) zaten uygulanmıştır. Bu doküman, Android'e özgü ek sertleştirmeleri kapsar.

---

## Bölüm 1: Güvenli Anahtar Saklama (Android Keystore)

### 1.1 Mevcut Durum

Şu an tüm anahtarlar IndexedDB'de (WebView içinde) saklanıyor. Android'de bu veriler `/data/data/com.chatappultra/` dizininde şifresiz tutulabilir.

### 1.2 Yapılması Gereken

Android Keystore System kullanılarak private key'ler donanım destekli güvenli alanda saklanmalıdır.

**Capacitor Plugin:** `@nicepay/capacitor-biometric-keychain` veya özel bir Capacitor plugin yazılmalıdır.

**Adım 1:** Capacitor plugin oluştur:

```bash
npx @capacitor/cli plugin:generate
# Plugin adı: capacitor-secure-keystore
```

**Adım 2:** Android tarafında `KeyGenParameterSpec` ile AES-256 key üret:

```java
// android/src/main/java/com/chatappultra/SecureKeystorePlugin.java

import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import java.security.KeyStore;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;

public class SecureKeystorePlugin extends Plugin {
    
    private static final String KEYSTORE_ALIAS = "sentinel_master_key";
    
    @PluginMethod
    public void generateMasterKey(PluginCall call) {
        try {
            KeyGenerator keyGen = KeyGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore"
            );
            
            KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
                KEYSTORE_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
            )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setUserAuthenticationRequired(true)  // Biyometrik zorunlu
            .setUserAuthenticationValidityDurationSeconds(300) // 5 dk
            .setInvalidatedByBiometricEnrollment(true) // Yeni parmak izi eklenirse key geçersiz
            .build();
            
            keyGen.init(spec);
            keyGen.generateKey();
            
            call.resolve();
        } catch (Exception e) {
            call.reject("Key generation failed", e);
        }
    }
    
    @PluginMethod
    public void encryptData(PluginCall call) {
        String data = call.getString("data");
        try {
            KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
            keyStore.load(null);
            SecretKey key = (SecretKey) keyStore.getKey(KEYSTORE_ALIAS, null);
            
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key);
            
            byte[] iv = cipher.getIV();
            byte[] encrypted = cipher.doFinal(data.getBytes("UTF-8"));
            
            JSObject result = new JSObject();
            result.put("iv", Base64.encodeToString(iv, Base64.NO_WRAP));
            result.put("data", Base64.encodeToString(encrypted, Base64.NO_WRAP));
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Encryption failed", e);
        }
    }
}
```

**Adım 3:** JavaScript tarafında kullan:

```typescript
// client/src/lib/androidKeystore.ts
import { Capacitor } from '@capacitor/core';
import { registerPlugin } from '@capacitor/core';

const SecureKeystore = registerPlugin('SecureKeystore');

export async function storeKeySecurely(key: string, data: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await SecureKeystore.encryptData({ key, data });
  } else {
    // Web fallback: IndexedDB (mevcut secureStore.ts)
    await storeEncryptedData(key, data);
  }
}
```

---

## Bölüm 2: Root/Jailbreak Tespiti

### 2.1 Yapılması Gereken

Root edilmiş cihazlarda hassas işlemler engellenmelidir.

**Capacitor Plugin:** `capacitor-root-detection` veya `@nicepay/capacitor-root-detection`

**Adım 1:** Plugin kur:

```bash
npm install capacitor-root-detection
npx cap sync
```

**Adım 2:** Uygulama başlangıcında kontrol et:

```typescript
// client/src/lib/deviceSecurity.ts
import { Capacitor } from '@capacitor/core';

export async function checkDeviceSecurity(): Promise<{
  isRooted: boolean;
  isEmulator: boolean;
  isDebugMode: boolean;
}> {
  if (!Capacitor.isNativePlatform()) {
    return { isRooted: false, isEmulator: false, isDebugMode: false };
  }
  
  try {
    const { RootDetection } = await import('capacitor-root-detection');
    const result = await RootDetection.isRooted();
    
    return {
      isRooted: result.isRooted,
      isEmulator: result.isEmulator || false,
      isDebugMode: false, // Ayrı kontrol gerekir
    };
  } catch {
    return { isRooted: false, isEmulator: false, isDebugMode: false };
  }
}

export async function enforceSecurityPolicy(): Promise<void> {
  const security = await checkDeviceSecurity();
  
  if (security.isRooted) {
    // Root tespit edildi - kullanıcıyı uyar
    alert(
      '⚠️ GÜVENLİK UYARISI\n\n' +
      'Bu cihaz root edilmiş. ChatApp Ultra güvenlik politikası gereği ' +
      'root edilmiş cihazlarda şifreleme anahtarları oluşturulamaz.\n\n' +
      'Lütfen root erişimini kaldırın veya güvenli bir cihaz kullanın.'
    );
    
    // Hassas işlemleri engelle
    throw new Error('SECURITY_VIOLATION: Rooted device detected');
  }
}
```

**Adım 3:** App.tsx'te başlangıçta çağır:

```typescript
useEffect(() => {
  enforceSecurityPolicy().catch(() => {
    // Root cihaz - sınırlı mod
  });
}, []);
```

---

## Bölüm 3: Ekran Görüntüsü ve Ekran Kaydı Engelleme

### 3.1 Yapılması Gereken

Hassas mesajların ekran görüntüsü alınması engellenmelidir.

**Adım 1:** `capacitor.config.ts`'e ekle:

```typescript
// capacitor.config.ts
const config: CapacitorConfig = {
  appId: 'com.chatappultra.app',
  appName: 'ChatApp Ultra',
  android: {
    // FLAG_SECURE ekle - ekran görüntüsü ve ekran kaydı engellenir
    allowMixedContent: false,
  },
};
```

**Adım 2:** Android MainActivity'ye FLAG_SECURE ekle:

```java
// android/app/src/main/java/com/chatappultra/MainActivity.java
import android.os.Bundle;
import android.view.WindowManager;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Ekran görüntüsü ve ekran kaydını engelle
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        );
    }
}
```

---

## Bölüm 4: Session Lock (PIN / Biyometrik)

### 4.1 Yapılması Gereken

Uygulama arka plana alındığında veya belirli süre sonra kilit ekranı gösterilmelidir.

**Capacitor Plugin:** `@aparajita/capacitor-biometric-auth`

**Adım 1:** Plugin kur:

```bash
npm install @aparajita/capacitor-biometric-auth
npx cap sync
```

**Adım 2:** Session lock mekanizması:

```typescript
// client/src/lib/sessionLock.ts
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 dakika
let lastActiveTime = Date.now();
let isLocked = false;

export function initSessionLock(): void {
  if (!Capacitor.isNativePlatform()) return;
  
  // Arka plana alındığında zamanlayıcı başlat
  App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) {
      const elapsed = Date.now() - lastActiveTime;
      if (elapsed > LOCK_TIMEOUT_MS) {
        lockApp();
      }
    } else {
      lastActiveTime = Date.now();
    }
  });
}

async function lockApp(): Promise<void> {
  isLocked = true;
  
  try {
    const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
    
    const result = await BiometricAuth.authenticate({
      reason: 'ChatApp Ultra\'ya erişmek için kimliğinizi doğrulayın',
      cancelTitle: 'İptal',
      allowDeviceCredential: true, // PIN/desen de kabul et
    });
    
    if (result.verified) {
      isLocked = false;
    }
  } catch {
    // Doğrulama başarısız - uygulama kilitli kalır
  }
}

export function isAppLocked(): boolean {
  return isLocked;
}
```

---

## Bölüm 5: Memory Temizleme (Arka Plan)

### 5.1 Yapılması Gereken

Uygulama arka plana alındığında hassas veriler bellekten temizlenmelidir.

```typescript
// client/src/lib/memoryGuard.ts
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

// Hassas verileri tutan referanslar
const sensitiveBuffers: WeakRef<ArrayBuffer>[] = [];

export function registerSensitiveBuffer(buffer: ArrayBuffer): void {
  sensitiveBuffers.push(new WeakRef(buffer));
}

export function clearSensitiveMemory(): void {
  for (const ref of sensitiveBuffers) {
    const buffer = ref.deref();
    if (buffer) {
      try {
        new Uint8Array(buffer).fill(0);
      } catch {
        // Buffer zaten GC tarafından temizlenmiş olabilir
      }
    }
  }
  sensitiveBuffers.length = 0;
}

export function initMemoryGuard(): void {
  if (!Capacitor.isNativePlatform()) return;
  
  App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) {
      // Arka plana alındı - hassas belleği temizle
      clearSensitiveMemory();
    }
  });
}
```

---

## Bölüm 6: Remote Wipe (Uzaktan Silme)

### 6.1 Yapılması Gereken

Kullanıcı cihaz kaybında tüm anahtarlar ve veriler silinebilmelidir.

**Supabase Tablosu:** `remote_wipe_commands`

```sql
CREATE TABLE remote_wipe_commands (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  target_device_id TEXT NOT NULL,
  issued_by TEXT NOT NULL,
  issued_at BIGINT NOT NULL,
  executed BOOLEAN DEFAULT false
);
```

**JavaScript Tarafı:**

```typescript
// client/src/lib/remoteWipe.ts
import { supabase } from './supabase';
import { clearAllSecureData } from './secureStore';

export async function checkRemoteWipeCommand(
  workspaceId: string,
  deviceId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('remote_wipe_commands')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('target_device_id', deviceId)
    .eq('executed', false)
    .order('issued_at', { ascending: false })
    .limit(1);
  
  if (data && data.length > 0) {
    // Wipe komutu var - tüm verileri sil
    await executeWipe(workspaceId, deviceId, data[0].id);
    return true;
  }
  
  return false;
}

async function executeWipe(
  workspaceId: string,
  deviceId: string,
  commandId: string
): Promise<void> {
  // 1. IndexedDB'deki tüm anahtarları sil
  await clearAllSecureData();
  
  // 2. localStorage temizle
  localStorage.clear();
  
  // 3. SessionStorage temizle
  sessionStorage.clear();
  
  // 4. Komutu "executed" olarak işaretle
  await supabase
    .from('remote_wipe_commands')
    .update({ executed: true })
    .eq('id', commandId);
  
  // 5. Kullanıcıyı çıkış yap
  window.location.href = '/';
}

// Admin panelinden wipe komutu gönder
export async function issueRemoteWipe(
  workspaceId: string,
  targetDeviceId: string,
  issuedBy: string
): Promise<void> {
  await supabase.from('remote_wipe_commands').insert({
    workspace_id: workspaceId,
    target_device_id: targetDeviceId,
    issued_by: issuedBy,
    issued_at: Date.now(),
  });
}
```

---

## Bölüm 7: Uygulama Bütünlüğü (Tamper Detection)

### 7.1 Yapılması Gereken

APK'nın değiştirilmediği doğrulanmalıdır.

**Adım 1:** `build.gradle`'a imzalama ayarları ekle:

```groovy
// android/app/build.gradle
android {
    signingConfigs {
        release {
            storeFile file("keystore/chatapp-ultra.jks")
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias "chatapp-ultra"
            keyPassword System.getenv("KEY_PASSWORD")
        }
    }
    
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

**Adım 2:** ProGuard kuralları:

```
# proguard-rules.pro
-keep class com.chatappultra.** { *; }
-keep class com.getcapacitor.** { *; }
-dontwarn com.google.android.gms.**
```

---

## Bölüm 8: Network Security Config

### 8.1 Yapılması Gereken

Yalnızca HTTPS bağlantılarına izin verilmelidir.

**Adım 1:** `network_security_config.xml` oluştur:

```xml
<!-- android/app/src/main/res/xml/network_security_config.xml -->
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
    
    <!-- Sadece Supabase ve Firebase domainlerine izin ver -->
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">supabase.co</domain>
        <domain includeSubdomains="true">firebase.googleapis.com</domain>
        <domain includeSubdomains="true">fcm.googleapis.com</domain>
    </domain-config>
</network-security-config>
```

**Adım 2:** `AndroidManifest.xml`'e ekle:

```xml
<application
    android:networkSecurityConfig="@xml/network_security_config"
    ...>
```

---

## Uygulama Öncelik Sırası

| Öncelik | Bölüm | Zorluk | Etki |
|---------|-------|--------|------|
| 1 | Ekran Görüntüsü Engelleme (Bölüm 3) | Kolay | Yüksek |
| 2 | Network Security Config (Bölüm 8) | Kolay | Yüksek |
| 3 | Root/Jailbreak Tespiti (Bölüm 2) | Orta | Yüksek |
| 4 | Session Lock (Bölüm 4) | Orta | Yüksek |
| 5 | Android Keystore (Bölüm 1) | Zor | Kritik |
| 6 | Remote Wipe (Bölüm 6) | Orta | Yüksek |
| 7 | Memory Temizleme (Bölüm 5) | Kolay | Orta |
| 8 | Tamper Detection (Bölüm 7) | Zor | Yüksek |

---

## Referanslar

- [1] [Android Keystore System](https://developer.android.com/training/articles/keystore)
- [2] [Capacitor Security Best Practices](https://capacitorjs.com/docs/guides/security)
- [3] [OWASP Mobile Security Testing Guide](https://owasp.org/www-project-mobile-security-testing-guide/)
- [4] [Android Network Security Configuration](https://developer.android.com/training/articles/security-config)
