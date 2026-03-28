/**
 * ChatApp Ultra - Kullanım Sözleşmesi
 * KVKK/GDPR uyumlu yasal metin
 */
import { useLocation } from 'wouter';
import { Shield, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TermsOfService() {
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
        <h1 className="text-3xl sm:text-4xl font-bold font-[Noto_Sans] text-white mb-2">Kullanım Sözleşmesi</h1>
        <p className="text-[#8696a0] mb-12">Son güncelleme: {new Date().toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-[#00a884] mb-4">1. Genel Hükümler</h2>
            <p className="text-[#8696a0] leading-relaxed">
              Bu Kullanım Sözleşmesi ("Sözleşme"), ChatApp Ultra ("Uygulama") hizmetlerini kullanan tüm gerçek ve tüzel kişiler ("Kullanıcı") ile
              CreatorToolbox Studio ("Şirket") arasında akdedilmiştir. Uygulamayı kullanarak bu sözleşmenin tüm hükümlerini kabul etmiş sayılırsınız.
            </p>
            <p className="text-[#8696a0] leading-relaxed mt-3">
              ChatApp Ultra, kurumsal mesajlaşma ve iletişim platformu olarak hizmet vermektedir. Uygulama, uçtan uca şifreleme (E2EE) teknolojisi
              kullanarak kullanıcıların iletişim güvenliğini sağlamayı amaçlamaktadır.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#00a884] mb-4">2. Hizmet Tanımı</h2>
            <p className="text-[#8696a0] leading-relaxed">ChatApp Ultra aşağıdaki hizmetleri sunmaktadır:</p>
            <ul className="list-disc list-inside text-[#8696a0] space-y-2 mt-3 ml-4">
              <li>AES-256 uçtan uca şifreli anlık mesajlaşma</li>
              <li>Workspace (çalışma alanı) oluşturma ve yönetme</li>
              <li>Davet kodu ile güvenli katılım sistemi</li>
              <li>Yapay zeka destekli şirket asistanı (Google Gemini)</li>
              <li>Süreli (kendini imha eden) mesaj gönderme</li>
              <li>Dosya ve medya paylaşımı (25MB'a kadar)</li>
              <li>Çoklu dil desteği (Türkçe, İngilizce, Almanca, Arapça, Fransızca)</li>
              <li>Android APK ve Web tarayıcı üzerinden erişim</li>
              <li>Grup mesajlaşma ve özel oda sistemi</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#00a884] mb-4">3. Kullanıcı Yükümlülükleri</h2>
            <p className="text-[#8696a0] leading-relaxed">Kullanıcı, aşağıdaki hususlara uymayı kabul ve taahhüt eder:</p>
            <ul className="list-disc list-inside text-[#8696a0] space-y-2 mt-3 ml-4">
              <li>Uygulamayı yalnızca yasal amaçlarla kullanmak</li>
              <li>Başkalarının haklarını ihlal eden içerik paylaşmamak</li>
              <li>Spam, zararlı yazılım veya kötü amaçlı içerik göndermemek</li>
              <li>Workspace yöneticisinin belirlediği kurallara uymak</li>
              <li>Hesap bilgilerini gizli tutmak ve üçüncü kişilerle paylaşmamak</li>
              <li>Uygulamanın güvenlik mekanizmalarını atlatmaya çalışmamak</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#00a884] mb-4">4. Yönetici (Admin) Yetkileri</h2>
            <p className="text-[#8696a0] leading-relaxed">
              Workspace yöneticisi ("Patron/Admin") aşağıdaki yetkilere sahiptir:
            </p>
            <ul className="list-disc list-inside text-[#8696a0] space-y-2 mt-3 ml-4">
              <li>Workspace oluşturma, yapılandırma ve silme</li>
              <li>Davet kodu üretme ve personel ekleme</li>
              <li>Personeli kovma (kovulan kişinin tüm verileri kalıcı olarak silinir)</li>
              <li>Şirket kurallarını belirleme ve AI asistanını yapılandırma</li>
              <li>Tüm kanallardaki mesajları silme yetkisi</li>
              <li>Workspace kapasitesini belirleme</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#00a884] mb-4">5. Şifreleme ve Güvenlik</h2>
            <p className="text-[#8696a0] leading-relaxed">
              ChatApp Ultra, AES-256 şifreleme standardı ile uçtan uca şifreleme (E2EE) kullanmaktadır. Mesajlar yalnızca gönderen ve alıcı
              cihazlarda okunabilir durumdadır. Sunucu tarafında mesajlar şifreli olarak saklanır ve Şirket dahil hiçbir üçüncü taraf
              mesaj içeriklerine erişemez.
            </p>
            <p className="text-[#8696a0] leading-relaxed mt-3">
              Şifreleme anahtarları PBKDF2 algoritması ile türetilir ve HMAC ile bütünlük kontrolü sağlanır. Kullanıcı, şifreleme
              anahtarlarının güvenliğinden kendisi sorumludur.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#00a884] mb-4">6. Veri Saklama ve Silme</h2>
            <p className="text-[#8696a0] leading-relaxed">
              Mesajlar Supabase altyapısında şifreli olarak saklanır. Süreli mesajlar belirlenen süre sonunda otomatik olarak silinir.
              Yönetici tarafından kovulan kullanıcıların tüm verileri (mesajlar, profil bilgileri, özel odalar) kalıcı olarak imha edilir.
              Kullanıcılar GDPR/KVKK kapsamında verilerinin dışa aktarılmasını talep edebilir.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#00a884] mb-4">7. Fikri Mülkiyet Hakları</h2>
            <p className="text-[#8696a0] leading-relaxed">
              ChatApp Ultra uygulamasının tüm fikri mülkiyet hakları CreatorToolbox Studio'ya aittir. Kullanıcı, uygulama üzerinde
              herhangi bir fikri mülkiyet hakkı iddia edemez. Kullanıcıların uygulama üzerinden paylaştığı içeriklerin sorumluluğu
              tamamen kendilerine aittir.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#00a884] mb-4">8. Sorumluluk Sınırlandırması</h2>
            <p className="text-[#8696a0] leading-relaxed">
              Şirket, uygulamanın kesintisiz ve hatasız çalışacağını garanti etmez. Teknik arızalar, bakım çalışmaları veya
              mücbir sebepler nedeniyle hizmet kesintileri yaşanabilir. Şirket, kullanıcıların uygulama üzerinden paylaştığı
              içeriklerden sorumlu değildir. Şifreleme anahtarlarının kaybedilmesi durumunda mesajların kurtarılması mümkün değildir.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#00a884] mb-4">9. Sözleşme Değişiklikleri</h2>
            <p className="text-[#8696a0] leading-relaxed">
              Şirket, bu sözleşmeyi önceden bildirimde bulunarak değiştirme hakkını saklı tutar. Değişiklikler uygulama
              üzerinden duyurulacaktır. Değişiklik sonrasında uygulamayı kullanmaya devam eden kullanıcılar, yeni hükümleri
              kabul etmiş sayılır.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#00a884] mb-4">10. Uygulanacak Hukuk ve Yetki</h2>
            <p className="text-[#8696a0] leading-relaxed">
              Bu sözleşme Türkiye Cumhuriyeti kanunlarına tabidir. Uyuşmazlıklarda Türkiye Cumhuriyeti mahkemeleri ve
              icra daireleri yetkilidir. Avrupa Birliği vatandaşları için GDPR hükümleri, Türkiye vatandaşları için
              6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) hükümleri geçerlidir.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[#00a884] mb-4">11. İletişim</h2>
            <p className="text-[#8696a0] leading-relaxed">
              Bu sözleşme ile ilgili sorularınız için <a href="https://creatortoolboxstudio.com" target="_blank" rel="noopener noreferrer" className="text-[#00a884] hover:underline">creatortoolboxstudio.com</a> üzerinden
              bizimle iletişime geçebilirsiniz.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
