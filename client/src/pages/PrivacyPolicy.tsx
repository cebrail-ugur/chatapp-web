/**
 * ChatApp Ultra - Gizlilik Politikası
 * KVKK/GDPR uyumlu gizlilik metni
 */
import { useLocation } from 'wouter';
import { Shield, ArrowLeft, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PrivacyPolicy() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-[#0b141a] text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#111b21]/95 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="text-[#8696a0] hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Ana Sayfa
          </Button>
          <div className="flex items-center gap-2 ml-auto">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#00a884] to-[#025144] flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-white font-[Noto_Sans]">ChatApp Ultra</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl sm:text-4xl font-bold font-[Noto_Sans] text-white mb-2">Gizlilik Politikası</h1>
        <p className="text-[#8696a0] mb-12">Son güncelleme: {new Date().toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <div className="prose prose-invert max-w-none space-y-8">
          <section className="bg-[#111b21]/60 border border-[#00a884]/20 rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-3 mb-3">
              <Lock className="w-5 h-5 text-[#00a884]" />
              <h3 className="text-lg font-semibold text-[#00a884]">Temel İlkemiz</h3>
            </div>
            <p className="text-[#8696a0] leading-relaxed">
              ChatApp Ultra, kullanıcı gizliliğini en üst düzeyde korumayı taahhüt eder. Uçtan uca şifreleme (E2EE) sayesinde
              mesajlarınızı biz dahil hiç kimse okuyamaz. Verileriniz sizindir ve sizin kontrolünüzdedir.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#00a884] mb-4">1. Veri Sorumlusu</h2>
            <p className="text-[#8696a0] leading-relaxed">
              6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") ve Avrupa Birliği Genel Veri Koruma Tüzüğü ("GDPR")
              kapsamında veri sorumlusu CreatorToolbox Studio'dur. İletişim: <a href="https://creatortoolboxstudio.com" target="_blank" rel="noopener noreferrer" className="text-[#00a884] hover:underline">creatortoolboxstudio.com</a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#00a884] mb-4">2. Toplanan Veriler</h2>
            <p className="text-[#8696a0] leading-relaxed mb-3">ChatApp Ultra aşağıdaki verileri toplar ve işler:</p>

            <div className="space-y-4">
              <div className="bg-[#111b21]/60 border border-white/5 rounded-xl p-4">
                <h4 className="text-white font-medium mb-2">Cihaz Bilgileri</h4>
                <p className="text-[#8696a0] text-sm">Benzersiz cihaz kimliği (device_id), FCM token (bildirimler için). Bu veriler hizmetin çalışması için zorunludur.</p>
              </div>
              <div className="bg-[#111b21]/60 border border-white/5 rounded-xl p-4">
                <h4 className="text-white font-medium mb-2">Profil Bilgileri</h4>
                <p className="text-[#8696a0] text-sm">Kullanıcı adı, profil fotoğrafı, hakkımda yazısı, çevrimiçi durumu ve son görülme zamanı.</p>
              </div>
              <div className="bg-[#111b21]/60 border border-white/5 rounded-xl p-4">
                <h4 className="text-white font-medium mb-2">Mesaj Verileri (Şifreli)</h4>
                <p className="text-[#8696a0] text-sm">Mesajlar AES-256 ile şifrelenerek saklanır. Sunucu tarafında mesaj içerikleri okunamaz durumda tutulur. Yalnızca şifreli payload, gönderen cihaz kimliği ve zaman damgası saklanır.</p>
              </div>
              <div className="bg-[#111b21]/60 border border-white/5 rounded-xl p-4">
                <h4 className="text-white font-medium mb-2">Medya Dosyaları</h4>
                <p className="text-[#8696a0] text-sm">Yüklenen resim ve PDF dosyaları Supabase Storage üzerinde saklanır. Dosya boyutu 25MB ile sınırlıdır.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#00a884] mb-4">3. Verilerin İşlenme Amaçları</h2>
            <ul className="list-disc list-inside text-[#8696a0] space-y-2 ml-4">
              <li>Mesajlaşma hizmetinin sağlanması ve sürdürülmesi</li>
              <li>Kullanıcı kimlik doğrulaması ve yetkilendirme</li>
              <li>Push bildirimleri gönderimi</li>
              <li>Workspace yönetimi ve personel takibi</li>
              <li>Yapay zeka asistanı hizmetinin sunulması</li>
              <li>Hizmet kalitesinin iyileştirilmesi</li>
              <li>Yasal yükümlülüklerin yerine getirilmesi</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#00a884] mb-4">4. Verilerin Paylaşılması</h2>
            <p className="text-[#8696a0] leading-relaxed">
              Kişisel verileriniz aşağıdaki durumlar dışında üçüncü taraflarla paylaşılmaz:
            </p>
            <ul className="list-disc list-inside text-[#8696a0] space-y-2 mt-3 ml-4">
              <li><strong className="text-white">Supabase:</strong> Veritabanı ve depolama altyapısı sağlayıcısı (mesajlar şifreli olarak saklanır)</li>
              <li><strong className="text-white">Google (Gemini AI):</strong> Yapay zeka asistanı hizmeti için (yalnızca şirket kuralları ve kullanıcı soruları iletilir)</li>
              <li><strong className="text-white">Firebase (Google):</strong> Push bildirim hizmeti için (yalnızca FCM token kullanılır)</li>
              <li><strong className="text-white">Yasal zorunluluk:</strong> Mahkeme kararı veya yasal düzenleme gereği</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#00a884] mb-4">5. Veri Güvenliği</h2>
            <p className="text-[#8696a0] leading-relaxed">
              Verilerinizin güvenliği için aşağıdaki önlemler alınmıştır:
            </p>
            <ul className="list-disc list-inside text-[#8696a0] space-y-2 mt-3 ml-4">
              <li>AES-256 uçtan uca şifreleme (E2EE)</li>
              <li>PBKDF2 anahtar türetme algoritması</li>
              <li>HMAC bütünlük kontrolü</li>
              <li>XSS ve injection saldırılarına karşı koruma</li>
              <li>Rate limiting (dakikada 30 mesaj sınırı)</li>
              <li>Brute force koruması</li>
              <li>SSL/TLS şifreli veri aktarımı</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#00a884] mb-4">6. Kullanıcı Hakları (KVKK Madde 11 / GDPR Madde 15-22)</h2>
            <p className="text-[#8696a0] leading-relaxed mb-3">
              KVKK ve GDPR kapsamında aşağıdaki haklara sahipsiniz:
            </p>
            <ul className="list-disc list-inside text-[#8696a0] space-y-2 ml-4">
              <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
              <li>İşlenmişse buna ilişkin bilgi talep etme</li>
              <li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme</li>
              <li>Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme</li>
              <li>Eksik veya yanlış işlenmişse düzeltilmesini isteme</li>
              <li>KVKK Madde 7 / GDPR Madde 17 kapsamında silinmesini veya yok edilmesini isteme</li>
              <li>Verilerinizin taşınabilirliğini talep etme (GDPR Madde 20)</li>
              <li>İşlemenin kısıtlanmasını talep etme (GDPR Madde 18)</li>
              <li>Otomatik karar verme süreçlerine itiraz etme</li>
            </ul>
            <p className="text-[#8696a0] leading-relaxed mt-4">
              Uygulama içindeki "Verilerimi Dışa Aktar" butonu ile tüm kişisel verilerinizi JSON formatında indirebilirsiniz.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#00a884] mb-4">7. Çerezler ve Yerel Depolama</h2>
            <p className="text-[#8696a0] leading-relaxed">
              ChatApp Ultra, çerez (cookie) kullanmaz. Uygulama, cihaz kimliği ve oturum bilgilerini tarayıcının localStorage
              özelliğinde saklar. Bu veriler yalnızca sizin cihazınızda tutulur ve üçüncü taraflarla paylaşılmaz.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#00a884] mb-4">8. Veri Saklama Süresi</h2>
            <p className="text-[#8696a0] leading-relaxed">
              Mesajlar, kullanıcı veya yönetici tarafından silinene kadar şifreli olarak saklanır. Süreli mesajlar belirlenen
              süre sonunda otomatik olarak silinir. Kovulan kullanıcıların verileri anında ve kalıcı olarak imha edilir.
              Workspace silindiğinde tüm ilişkili veriler kalıcı olarak yok edilir.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#00a884] mb-4">9. Uluslararası Veri Aktarımı</h2>
            <p className="text-[#8696a0] leading-relaxed">
              Supabase altyapısı nedeniyle veriler uluslararası sunucularda işlenebilir. Bu aktarımlar GDPR'ın öngördüğü
              standart sözleşme hükümleri (SCC) ve uygun güvenlik önlemleri çerçevesinde gerçekleştirilir.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#00a884] mb-4">10. Çocukların Gizliliği</h2>
            <p className="text-[#8696a0] leading-relaxed">
              ChatApp Ultra, 18 yaşından küçük bireylere yönelik değildir. 18 yaşından küçük bireylerin uygulamayı kullanması
              durumunda sorumluluk velilerine aittir.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#00a884] mb-4">11. Politika Değişiklikleri</h2>
            <p className="text-[#8696a0] leading-relaxed">
              Bu gizlilik politikası zaman zaman güncellenebilir. Önemli değişiklikler uygulama üzerinden bildirilecektir.
              Güncel politikayı bu sayfadan takip edebilirsiniz.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#00a884] mb-4">12. İletişim ve Başvuru</h2>
            <p className="text-[#8696a0] leading-relaxed">
              Gizlilik politikası ile ilgili sorularınız, veri talepleriniz veya şikayetleriniz için
              <a href="https://creatortoolboxstudio.com" target="_blank" rel="noopener noreferrer" className="text-[#00a884] hover:underline ml-1">creatortoolboxstudio.com</a> üzerinden
              bizimle iletişime geçebilirsiniz.
            </p>
            <p className="text-[#8696a0] leading-relaxed mt-3">
              KVKK kapsamında Kişisel Verileri Koruma Kurumu'na, GDPR kapsamında ilgili ülkenizin Veri Koruma Otoritesine
              başvuru hakkınız saklıdır.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
