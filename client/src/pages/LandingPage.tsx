/**
 * ChatApp Ultra - Landing Page
 * Profesyonel tanıtım: Hero, Özellikler, Güvenlik, E2EE, Grup Kullanımı,
 * Android İndirme, Fiyatlandırma, SSS, İletişim, Footer
 * Design: Deep dark cybersecurity aesthetic, teal accents
 */

import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Shield, Lock, Zap, Timer, Globe, Cloud,
  ChevronRight, ArrowRight, CheckCircle2, Eye,
  MessageSquare, Users, Fingerprint, ShieldCheck, Star,
  Smartphone, Monitor, KeyRound, FileText, Trash2,
  ChevronDown, Download, CreditCard, HelpCircle,
  Mail, Phone, MapPin, Send, UserPlus, Crown,
  Building2, Rocket, Check, X, Plus, Minus,
  ExternalLink
} from 'lucide-react';

// Image URLs
const HERO_BG = 'https://private-us-east-1.manuscdn.com/sessionFile/Q1C2087AngtTLCIWZ2CMlz/sandbox/xQdZru2gmbuIiCAifmgew9-img-1_1772116381000_na1fn_aGVyby1iZw.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvUTFDMjA4N0FuZ3RUTENJV1oyQ01sei9zYW5kYm94L3hRZFpydTJnbWJ1SWlDQWlmbWdldzktaW1nLTFfMTc3MjExNjM4MTAwMF9uYTFmbl9hR1Z5YnkxaVp3LnBuZz94LW9zcy1wcm9jZXNzPWltYWdlL3Jlc2l6ZSx3XzE5MjAsaF8xOTIwL2Zvcm1hdCx3ZWJwL3F1YWxpdHkscV84MCIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5ODc2MTYwMH19fV19&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=cHc1rkITsIZRj94x51IwrMLRRvE9cdsfQK-mvA2~kMtO67Chp7UwWqdLRX0UqpnnwnUM-L297UTrb0DGp5JovNiryOjRj2aPfcQb1Kq5fS3WpXWUWg7VTfdQZpugmyivnp2Q1VsBw50JuZo3chYP3l3q4PT~K929Kj3EFNSlLOoTMvxEOxvJYu4pzEMcACawfLBuHpBB7pvy2YbAEk282NA2YQfZ8Wtv51ra36LHp0h~LJPpNxPlIStIdPWuc0EDWtxqoJkx7QfobOIlI1L~Lj7O5L1aBU50kydhZZdXP9-uLvKowk2d48wJf~tLYlLFicuJpTi9hz4SUVjhEiIBLg__';

const SECURITY_IMG = 'https://private-us-east-1.manuscdn.com/sessionFile/Q1C2087AngtTLCIWZ2CMlz/sandbox/xQdZru2gmbuIiCAifmgew9-img-2_1772116469000_na1fn_c2VjdXJpdHktdmlzdWFs.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvUTFDMjA4N0FuZ3RUTENJV1oyQ01sei9zYW5kYm94L3hRZFpydTJnbWJ1SWlDQWlmbWdldzktaW1nLTJfMTc3MjExNjQ2OTAwMF9uYTFmbl9jMlZqZFhKcGRIa3RkbWx6ZFdGcy5wbmc~eC1vc3MtcHJvY2Vzcz1pbWFnZS9yZXNpemUsd18xOTIwLGhfMTkyMC9mb3JtYXQsd2VicC9xdWFsaXR5LHFfODAiLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=rAkldBZjJ3GSGRGH~zDmX0tJ4GSQ~4GD2WpPu4BVmrr0-pTSvgNe26wE-hiF03YMwSYzZPCuhxc5mAKqek2XTD~C9yoibF16ICb4xHGlBe-EoVmf-RqdR8lAdRxqx6y9tqRJkmaFkFCieX0eQJ~~2xsl~fXI4H3JUZMmw1RIseMyFoAX05xmaigQ6goFt9IeElnBDynLDqK7mYHMaFQd7cPJ4Wdjg6Bpgch8r17lEQeKL1FnT4iY3YqvJXBC7KMtBK9-666mkUE-l1KERaTqi5ZM5lHDIBMjkWRENffxGaFGgs91ldInTd7EbUJ4-UtHjHfYHCUmJb-2bPzzNFCE7Q__';

const MOCKUP_IMG = 'https://private-us-east-1.manuscdn.com/sessionFile/Q1C2087AngtTLCIWZ2CMlz/sandbox/xQdZru2gmbuIiCAifmgew9-img-3_1772116365000_na1fn_Y2hhdC1tb2NrdXA.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvUTFDMjA4N0FuZ3RUTENJV1oyQ01sei9zYW5kYm94L3hRZFpydTJnbWJ1SWlDQWlmbWdldzktaW1nLTNfMTc3MjExNjM2NTAwMF9uYTFmbl9ZMmhoZEMxdGIyTnJkWEEucG5nP3gtb3NzLXByb2Nlc3M9aW1hZ2UvcmVzaXplLHdfMTkyMCxoXzE5MjAvZm9ybWF0LHdlYnAvcXVhbGl0eSxxXzgwIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzk4NzYxNjAwfX19XX0_&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=N60Q1jEMKO3uyr8o4VK4ncsCvH5A8RZ~mhYmcY9yhptH268FR6zjYIj3wBM0iOmSVpC8zrnvbWSImxhBnaRMtw8yyd916ep9henr7plNumO0zYyILwv0oe~lzOBG~T8VAabeFV2fDsdOIw20LzYZm~HfkDO976ks7VlYF9enfBaOkDrJ7ROAD~-BLdFSdOt0-71FkZpyR4ERErwkuG4Wb8T4nDK~j3WJOVsbZe-AIss510Q8kCMjsGDrWBYdhXe0QUrWDcptI8bkyhKCLTYLGRyG7LHfq1jGtAf3tS6CO5ofcwQwV7IIGpELDdAlUF0hqJKSoi26QyROMnPcKOJ60g__';

const FEATURES_IMG = 'https://private-us-east-1.manuscdn.com/sessionFile/Q1C2087AngtTLCIWZ2CMlz/sandbox/xQdZru2gmbuIiCAifmgew9-img-4_1772116376000_na1fn_ZmVhdHVyZXMtZ3JpZA.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvUTFDMjA4N0FuZ3RUTENJV1oyQ01sei9zYW5kYm94L3hRZFpydTJnbWJ1SWlDQWlmbWdldzktaW1nLTRfMTc3MjExNjM3NjAwMF9uYTFmbl9abVZoZEhWeVpYTXRaM0pwWkEucG5nP3gtb3NzLXByb2Nlc3M9aW1hZ2UvcmVzaXplLHdfMTkyMCxoXzE5MjAvZm9ybWF0LHdlYnAvcXVhbGl0eSxxXzgwIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzk4NzYxNjAwfX19XX0_&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=NSIDnHzKyGae6r1AaznPh4VDINcNcoz2jGhK0Ugj2hQkR-3aeuY7uhknV6LAf8dKeIVv1zlPx3xZMNC~B66~S1nnzUE3gxQpozaOP0W2OCLI1CWi0t7rAM00xa9gJgjCdAJ3UVkkipLGE~pD9pVTNQ7rRF7UMuwoq6XV8iITFO2nCzOYdd6MryFHASuT4Zq16JFxeVmR20AQaJD-NjWqphfrlQYMT1pai~lGe2NyMj8Dotg4VTBpEPMhKkOdwic~htXvMwGsCStK-ZC82M99lA6ludS50MLC4WW1g2Kilox~rm52gg99hFD8O6wWHEVLPAHJ-MFBkwgglzVe0AgwUw__';

const E2EE_IMG = 'https://private-us-east-1.manuscdn.com/sessionFile/Q1C2087AngtTLCIWZ2CMlz/sandbox/yQxxqoQrl4tv0sWFzjyJS6-img-1_1772133457000_na1fn_eDNkaC1kb3VibGUtcmF0Y2hldC1kaWFncmFt.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvUTFDMjA4N0FuZ3RUTENJV1oyQ01sei9zYW5kYm94L3lReHhxb1FybDR0djBzV0Z6anlKUzYtaW1nLTFfMTc3MjEzMzQ1NzAwMF9uYTFmbl9lRE5rYUMxa2IzVmliR1V0Y21GMFkyaGxkQzFrYVdGbmNtRnQucG5nP3gtb3NzLXByb2Nlc3M9aW1hZ2UvcmVzaXplLHdfMTkyMCxoXzE5MjAvZm9ybWF0LHdlYnAvcXVhbGl0eSxxXzgwIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzk4NzYxNjAwfX19XX0_&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=M6Hz7H9iG1oIMNZ4mZ98jJyniqmecl0F6Y9ZK93DQKujdqlSdtYjYCPv4CLhJ3A7izvuTHqMJfYCxdVlTBj~X0otMbN-0Yzx~1SCzFBaani-eBDgvCQaFXIaHBenh1nBewT9beNDw5OGelPozMCG73BZRalaWTOcDfWBrv8OmQarkkcXYC8Jh2tus8SEGmCwn4Iy5-fwKXyfvh7FTjB0kHgP~mk~~LZ8SqmGGCRXMajDYl1-IGf-yaCC0DI-~D~cmwAV202nQO-vzjYQm9KIug9QmXzOk1s0zTrorWzVwtDBWK2cXlk4p3BquTTKlj7rXOT9OeizyQuRF~rROf2Ahw__';

const features = [
  { icon: Lock, title: 'Signal Protocol Şifreleme', desc: 'X3DH el sıkışması + Double Ratchet + AES-256-GCM ile askeri düzeyde uçtan uça şifreleme. Forward Secrecy ile geçmiş mesajlar korunamaz.' },
  { icon: Zap, title: 'Anlık Mesajlaşma', desc: 'Supabase Realtime WebSocket ile milisaniye düzeyinde mesaj iletimi. Yazıyor göstergesi ve çift tik.' },
  { icon: Users, title: 'Çok Kanallı Yapı', desc: 'Genel odalar, özel kanallar ve birebir mesajlaşma. Her kanal için ayrı şifreleme anahtarı.' },
  { icon: Timer, title: 'Süreli Mesajlar', desc: 'Görevimiz Tehlike modu: Belirlenen süre sonunda mesaj her iki taraftan otomatik imha edilir.' },
  { icon: Globe, title: '5 Dil Desteği', desc: 'Türkçe, İngilizce, Almanca, Arapça ve Fransızca arayüz desteği. RTL yazım uyumlu.' },
  { icon: Cloud, title: 'Güvenli Dosya Paylaşımı', desc: 'Resim, PDF ve belge paylaşımı. 25MB\'a kadar dosya yükleme. Dosya türü doğrulama.' },
];

const securityFeatures = [
  { icon: ShieldCheck, label: 'X3DH + Double Ratchet (Signal Protocol)' },
  { icon: KeyRound, label: 'X25519 ECDH + HKDF Anahtar Türetme' },
  { icon: Fingerprint, label: 'Ed25519 İmza + AES-256-GCM (AEAD)' },
  { icon: Eye, label: 'Forward Secrecy (Her Mesajda Yeni Anahtar)' },
  { icon: Trash2, label: 'Hayaletsiz Silme (Kara Delik)' },
  { icon: FileText, label: 'GDPR / KVKK Uyumu' },
];

// Kişi başı fiyat - sabit 10₺/kişi
const PER_USER_PRICE = 10;

const userCountOptions = [10, 25, 50, 100, 200, 500, 1000];

const pricingPlans = [
  {
    name: 'Pro (Kişi Başı)',
    price: 'dynamic',
    period: '/ay',
    desc: 'Kişi sayınıza göre esnek fiyatlandırma',
    icon: Crown,
    color: 'from-[#00a884]/30 to-[#00d4aa]/10',
    borderColor: 'border-[#00a884]/40',
    features: [
      { text: 'Kişi sayısına göre fiyatlandırma', included: true },
      { text: 'Signal Protocol (X3DH + Double Ratchet)', included: true },
      { text: 'Sınırsız oda', included: true },
      { text: 'Dosya paylaşımı (25MB)', included: true },
      { text: 'Sesli ve görüntülü arama (WebRTC)', included: true },
      { text: 'Süreli mesajlar', included: true },
      { text: 'E-posta desteği', included: true },
    ],
    cta: 'Pro\'ya Geç',
    popular: true,
  },
  {
    name: 'Kurumsal',
    price: 'Özel',
    period: 'fiyat',
    desc: 'Büyük organizasyonlar için özel çözüm',
    icon: Building2,
    color: 'from-[#00a884]/15 to-[#025144]/15',
    borderColor: 'border-white/5',
    features: [
      { text: 'Sınırsız kullanıcı', included: true },
      { text: 'Signal Protocol + Forward Secrecy', included: true },
      { text: 'Sınırsız oda + özel kanallar', included: true },
      { text: 'Sınırsız dosya paylaşımı', included: true },
      { text: 'Özel sunucu ve özel domain', included: true },
      { text: 'Tüm gelişmiş özellikler', included: true },
      { text: '7/24 öncelikli destek', included: true },
    ],
    cta: 'İletişime Geç',
    popular: false,
  },
];

const faqItems = [
  {
    q: 'ChatApp Ultra nedir ve ne işe yarar?',
    a: 'ChatApp Ultra, şirketler ve kapalı gruplar için geliştirilmiş ultra güvenli bir mesajlaşma platformudur. Signal Protocol (X3DH + Double Ratchet) ile uçtan uça şifreleme, süreli mesajlar, sesli/görüntülü arama ve çok daha fazlasını sunar.',
  },
  {
    q: 'Mesajlarım gerçekten güvende mi?',
    a: 'Evet. Signal Protocol (X3DH + Double Ratchet) ile korunur. Her oturum X3DH el sıkışması ile başlar (3-4 Diffie-Hellman hesaplaması), her mesajda anahtar ratchet edilir (Forward Secrecy), AES-256-GCM ile şifrelenir. Sunucu dahil hiç kimse mesajlarınızı okuyamaz.',
  },
  {
    q: 'Telefona nasıl indirebilirim?',
    a: 'ChatApp Ultra\'yı Android telefonunuza APK olarak indirebilirsiniz. Web sitemizden APK dosyasını indirin, telefonunuzda "Bilinmeyen Kaynaklara İzin Ver" ayarını açın ve APK\'yı yükleyin. Ayrıca herhangi bir web tarayıcıdan da kullanabilirsiniz.',
  },
  {
    q: 'Grup mesajlaşma nasıl çalışır?',
    a: 'Yönetici bir Workspace (çalışma alanı) oluşturur ve davet kodları üretir. Personel bu kodlarla katılır. Genel Oda\'da herkes mesajlaşabilir, Özel Odalar ile birebir iletişim kurulabilir. Tüm mesajlar şifrelidir.',
  },
  {
    q: 'Süreli mesaj nedir?',
    a: 'Görevimiz Tehlike modu ile belirlediğiniz süre (saniye/dakika) sonunda mesaj hem gönderen hem alıcı tarafından otomatik olarak silinir. İz bırakmaz.',
  },
  {
    q: 'Birisi kovulduğunda ne olur?',
    a: 'Yönetici bir personeli kovduğunda, o kişinin tüm mesaj geçmişi, profil bilgileri ve özel odası veritabanından kalıcı olarak yok edilir. Geri dönüşü yoktur.',
  },
  {
    q: 'KVKK ve GDPR\'a uyumlu mu?',
    a: 'Evet. ChatApp Ultra, 6698 sayılı KVKK ve AB GDPR düzenlemelerine tam uyumludur. Kullanıcılar verilerini dışa aktarabilir, silinmesini talep edebilir. Detaylar için Gizlilik Politikamızı inceleyebilirsiniz.',
  },
];

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); }
    }, { threshold });
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, isVisible };
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-white/5 rounded-xl overflow-hidden hover:border-white/15 transition-all">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-white/[0.02] transition-colors">
        <span className="text-white font-medium pr-4">{q}</span>
        <div className={`shrink-0 w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center transition-transform duration-300 ${open ? 'rotate-45' : ''}`}>
          <Plus className="w-4 h-4 text-white/50" />
        </div>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <p className="px-6 pb-5 text-[#8696a0] leading-relaxed">{a}</p>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [, navigate] = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [selectedUserCount, setSelectedUserCount] = useState(50);

  // Kişi başı fiyat hesaplama
  const perUserPrice = PER_USER_PRICE;
  const totalMonthly = selectedUserCount * perUserPrice;

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const heroAnim = useInView(0.1);
  const featuresAnim = useInView();
  const securityAnim = useInView();
  const e2eeAnim = useInView();
  const groupAnim = useInView();
  const downloadAnim = useInView();
  const pricingAnim = useInView();
  const faqAnim = useInView();
  const contactAnim = useInView();
  const ctaAnim = useInView();

  const navLinks = [
    { href: '#features', label: 'Özellikler' },
    { href: '#security', label: 'Güvenlik' },
    { href: '#download', label: 'İndir' },
    { href: '#pricing', label: 'Fiyatlar' },
    { href: '#faq', label: 'SSS' },
    { href: '#contact', label: 'İletişim' },
  ];

  return (
    <div className="min-h-screen bg-[#0b141a] text-white overflow-x-hidden scroll-smooth">
      {/* ===== NAVBAR ===== */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? 'bg-[#111b21]/95 backdrop-blur-xl border-b border-white/5 shadow-2xl shadow-black/30' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00a884] to-[#025144] flex items-center justify-center shadow-lg shadow-[#00a884]/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold font-[Noto_Sans] text-white">ChatApp Ultra</span>
          </div>
          <div className="hidden lg:flex items-center gap-6">
            {navLinks.map(l => (
              <a key={l.href} href={l.href} className="text-sm text-[#8696a0] hover:text-white transition-colors">{l.label}</a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <a href="https://files.manuscdn.com/user_upload_by_module/session_file/310419663026722638/khWSYgPFZBDVdNLI.apk" download="ChatAppUltra-v2.0.apk" rel="noopener noreferrer" className="hidden sm:block">
              <Button variant="outline" className="border-[#1a3a6a]/60 bg-[#0d2a52]/80 text-[#93b4e0] hover:bg-[#112f5c] hover:text-white rounded-full px-4 h-9 text-sm font-medium transition-all">
                <Download className="w-3.5 h-3.5 mr-1.5" />
                APK İndir
              </Button>
            </a>
            <Button onClick={() => navigate('/chat')}
              className="bg-[#0d2a52] hover:bg-[#112f5c] text-white border border-[#1a3a6a]/60 hover:border-[#2a5a9a]/60 rounded-full px-6 h-9 text-sm font-semibold shadow-lg shadow-[#0a1e3d]/40 transition-all hover:scale-105">
              Başlat
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
            {/* Mobile menu toggle */}
            <button onClick={() => setMobileMenu(!mobileMenu)} className="lg:hidden text-[#8696a0] hover:text-white p-2">
              <div className="space-y-1.5">
                <div className={`w-5 h-0.5 bg-current transition-all ${mobileMenu ? 'rotate-45 translate-y-2' : ''}`} />
                <div className={`w-5 h-0.5 bg-current transition-all ${mobileMenu ? 'opacity-0' : ''}`} />
                <div className={`w-5 h-0.5 bg-current transition-all ${mobileMenu ? '-rotate-45 -translate-y-2' : ''}`} />
              </div>
            </button>
          </div>
        </div>
        {/* Mobile menu */}
        {mobileMenu && (
          <div className="lg:hidden bg-[#111b21]/98 backdrop-blur-xl border-t border-white/5 px-4 py-4 space-y-2">
            {navLinks.map(l => (
              <a key={l.href} href={l.href} onClick={() => setMobileMenu(false)}
                className="block text-sm text-[#8696a0] hover:text-white py-2 px-3 rounded-lg hover:bg-white/5 transition-all">{l.label}</a>
            ))}
            <div className="border-t border-[#1a3a6a]/30 pt-3 mt-2 flex flex-col gap-2">
              <a href="https://files.manuscdn.com/user_upload_by_module/session_file/310419663026722638/khWSYgPFZBDVdNLI.apk" download="ChatAppUltra-v2.0.apk" rel="noopener noreferrer"
                className="flex items-center gap-3 text-sm text-white py-3 px-4 rounded-xl bg-[#0d2a52] border border-[#1a3a6a]/40 hover:bg-[#112f5c] transition-all">
                <Smartphone className="w-5 h-5 text-[#60a5fa]" />
                <div>
                  <div className="font-medium">Android APK İndir</div>
                  <div className="text-[#7a9cc6] text-xs">v2.0 • 1.4 MB</div>
                </div>
              </a>
              <button onClick={() => { setMobileMenu(false); navigate('/chat'); }}
                className="flex items-center gap-3 text-sm text-white py-3 px-4 rounded-xl bg-[#0d2a52] border border-[#1a3a6a]/40 hover:bg-[#112f5c] transition-all">
                <Monitor className="w-5 h-5 text-[#00a884]" />
                <div className="text-left">
                  <div className="font-medium">Web'den Başlat</div>
                  <div className="text-[#7a9cc6] text-xs">Tarayıcıdan anında erişin</div>
                </div>
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* ===== HERO SECTION ===== */}
      <section ref={heroAnim.ref} className="relative min-h-screen flex items-center justify-center pt-16">
        <div className="absolute inset-0">
          <img src={HERO_BG} alt="" className="w-full h-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0b141a]/60 via-[#0b141a]/40 to-[#0b141a]" />
        </div>

        <div className={`relative z-10 max-w-5xl mx-auto px-4 text-center transition-all duration-1000 ${
          heroAnim.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
        }`}>
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/15 rounded-full px-4 py-1.5 mb-8">
            <div className="w-2 h-2 rounded-full bg-[#00a884] animate-pulse" />
            <span className="text-[#c1cdd7] text-xs font-medium tracking-wide uppercase">Sentinel Ultra - Kurumsal Sürüm</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold font-[Noto_Sans] leading-tight mb-6">
            <span className="text-white">Kurumsal İletişimde</span>
            <br />
            <span className="bg-gradient-to-r from-[#00a884] via-[#00d4aa] to-[#00a884] bg-clip-text text-transparent">
              Ultra Güvenlik
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-[#8696a0] max-w-2xl mx-auto mb-10 leading-relaxed">
            WhatsApp ve Slack'in en iyi özelliklerini birleştiren, Signal Protocol (X3DH + Double Ratchet)
            ile uçtan uça şifreli, yapay zeka destekli kurumsal mesajlaşma platformu.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
            {['X3DH', 'Double Ratchet', 'X25519', 'AES-256-GCM', 'Forward Secrecy'].map(badge => (
              <Badge key={badge} variant="outline" className="border-white/15 text-[#c1cdd7] bg-white/5 px-3 py-1 text-xs font-mono">
                <Lock className="w-3 h-3 mr-1.5 text-white/50" />
                {badge}
              </Badge>
            ))}
          </div>

          {/* İndirme Butonları - Açık Lacivert Kart */}
          <div className="max-w-xl mx-auto w-full">
            <div className="bg-[#0a1e3d]/80 backdrop-blur-sm border border-[#1a3a6a]/50 rounded-2xl p-6 sm:p-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Web'den Başlat */}
                <button onClick={() => navigate('/chat')}
                  className="group flex items-center gap-4 bg-[#0d2a52] hover:bg-[#112f5c] border border-[#1a3a6a]/60 hover:border-[#2a5a9a]/60 rounded-xl p-4 transition-all hover:scale-[1.02] active:scale-[0.98]">
                  <div className="w-12 h-12 rounded-xl bg-[#00a884]/15 border border-[#00a884]/25 flex items-center justify-center shrink-0 group-hover:bg-[#00a884]/20 transition-colors">
                    <Monitor className="w-6 h-6 text-[#00a884]" />
                  </div>
                  <div className="text-left">
                    <div className="text-white font-semibold text-base">Web'den Başlat</div>
                    <div className="text-[#7a9cc6] text-xs mt-0.5">Tarayıcıdan anında erişin</div>
                  </div>
                </button>

                {/* Android APK İndir */}
                <a href="https://files.manuscdn.com/user_upload_by_module/session_file/310419663026722638/khWSYgPFZBDVdNLI.apk" download="ChatAppUltra-v2.0.apk" rel="noopener noreferrer"
                  className="group flex items-center gap-4 bg-[#0d2a52] hover:bg-[#112f5c] border border-[#1a3a6a]/60 hover:border-[#2a5a9a]/60 rounded-xl p-4 transition-all hover:scale-[1.02] active:scale-[0.98]">
                  <div className="w-12 h-12 rounded-xl bg-[#3b82f6]/15 border border-[#3b82f6]/25 flex items-center justify-center shrink-0 group-hover:bg-[#3b82f6]/20 transition-colors">
                    <Smartphone className="w-6 h-6 text-[#60a5fa]" />
                  </div>
                  <div className="text-left">
                    <div className="text-white font-semibold text-base">Android APK</div>
                    <div className="text-[#7a9cc6] text-xs mt-0.5">v2.0 • 1.4 MB</div>
                  </div>
                </a>
              </div>

              {/* Alt satır: AAB + Özellikleri Keşfet */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#1a3a6a]/30">
                <a href="https://files.manuscdn.com/user_upload_by_module/session_file/310419663026722638/NzMDRVsDaybxomlt.aab" download="ChatAppUltra-v2.0.aab" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[#7a9cc6] hover:text-white text-xs transition-colors">
                  <Download className="w-3.5 h-3.5" />
                  AAB (Play Store)
                </a>
                <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                  className="flex items-center gap-1 text-[#7a9cc6] hover:text-white text-xs transition-colors">
                  Özellikleri Keşfet
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-8 mt-16 max-w-lg mx-auto">
            {[
              { value: '256-bit', label: 'Şifreleme' },
              { value: '5+', label: 'Dil Desteği' },
              { value: '<50ms', label: 'Gecikme' },
            ].map(stat => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-white font-mono">{stat.value}</div>
                <div className="text-xs text-[#8696a0] mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-6 h-6 text-white/30" />
        </div>
      </section>

      {/* ===== FEATURES SECTION ===== */}
      <section id="features" ref={featuresAnim.ref} className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b141a] via-[#0d1f2d]/30 to-[#0b141a]" />
        <div className={`relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-1000 ${
          featuresAnim.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
        }`}>
          <div className="text-center mb-16">
            <Badge variant="outline" className="border-white/15 text-[#c1cdd7] bg-white/5 px-4 py-1.5 mb-4">
              <Star className="w-3 h-3 mr-1.5" />
              Özellikler
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold font-[Noto_Sans] text-white mt-4">
              Kurumsal Mesajlaşmanın Geleceği
            </h2>
            <p className="text-[#8696a0] mt-4 max-w-xl mx-auto">
              Her özellik, güvenlik ve verimlilik odaklı tasarlandı.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={f.title}
                className="group relative bg-[#111b21]/80 border border-white/5 rounded-2xl p-6 hover:border-white/15 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-white/5"
                style={{ transitionDelay: `${i * 100}ms` }}>
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4 group-hover:bg-white/10 transition-colors">
                  <f.icon className="w-6 h-6 text-[#c1cdd7] group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2 font-[Noto_Sans]">{f.title}</h3>
                <p className="text-sm text-[#8696a0] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 rounded-2xl overflow-hidden border border-white/5">
            <img src={FEATURES_IMG} alt="ChatApp Ultra Özellikler" className="w-full h-auto" loading="lazy" />
          </div>
        </div>
      </section>

      {/* ===== SECURITY SECTION ===== */}
      <section id="security" ref={securityAnim.ref} className="py-24 relative">
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-1000 ${
          securityAnim.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
        }`}>
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="relative">
              <div className="absolute inset-0 bg-white/[0.03] rounded-3xl blur-3xl" />
              <img src={SECURITY_IMG} alt="Güvenlik Kalkanı" className="relative w-full max-w-md mx-auto" loading="lazy" />
            </div>
            <div>
              <Badge variant="outline" className="border-white/15 text-[#c1cdd7] bg-white/5 px-4 py-1.5 mb-4">
                <Shield className="w-3 h-3 mr-1.5" />
                Güvenlik Mimarisi
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold font-[Noto_Sans] text-white mt-4 mb-6">
                Askeri Düzeyde Koruma
              </h2>
              <p className="text-[#8696a0] mb-8 leading-relaxed">
                Signal Protocol ile korunur: X3DH el sıkışması (3-4 DH), Double Ratchet (her mesajda yeni anahtar),
                AES-256-GCM şifreleme. Sunucu dahil hiç kimse mesajlarınızı okuyamaz.
              </p>
              <div className="space-y-4">
                {securityFeatures.map((sf, i) => (
                  <div key={sf.label} className="flex items-center gap-4 bg-[#111b21]/60 border border-white/5 rounded-xl px-4 py-3 hover:border-white/15 transition-all"
                    style={{ transitionDelay: `${i * 80}ms` }}>
                    <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                      <sf.icon className="w-5 h-5 text-[#c1cdd7]" />
                    </div>
                    <span className="text-sm text-white font-medium">{sf.label}</span>
                    <CheckCircle2 className="w-4 h-4 text-[#00a884] ml-auto shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== E2EE HOW IT WORKS ===== */}
      <section id="how-it-works" ref={e2eeAnim.ref} className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b141a] via-[#0d1f2d]/20 to-[#0b141a]" />
        <div className={`relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-1000 ${
          e2eeAnim.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
        }`}>
          <div className="text-center mb-12">
            <Badge variant="outline" className="border-white/15 text-[#c1cdd7] bg-white/5 px-4 py-1.5 mb-4">
              <Lock className="w-3 h-3 mr-1.5" />
              Nasıl Çalışır
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold font-[Noto_Sans] text-white mt-4">
              Uçtan Uca Şifreleme (E2EE)
            </h2>
            <p className="text-[#8696a0] mt-4 max-w-2xl mx-auto">
              X3DH el sıkışması ile oturum başlar, Double Ratchet ile her mesajda anahtar yenilenir, AES-256-GCM ile şifrelenir.
            </p>
          </div>
          <div className="rounded-2xl overflow-hidden border border-white/5 bg-[#111b21]/50">
            <img src={E2EE_IMG} alt="X3DH + Double Ratchet Şifreleme Protokolü Akış Diyagramı" className="w-full h-auto" loading="lazy" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            {[
              { step: '01', title: 'X3DH El Sıkışması', desc: 'Identity Key + Signed PreKey + One-Time PreKey ile 3-4 DH hesaplaması. Mutual authentication + Forward Secrecy.' },
              { step: '02', title: 'Double Ratchet', desc: 'Her mesajda chain key ratchet edilir, yeni message key türetilir. DH ratchet ile tüm zincir yenilenir.' },
              { step: '03', title: 'AES-256-GCM Şifreleme', desc: 'Authenticated encryption: şifreleme + bütünlük tek adımda. 96-bit IV + 128-bit auth tag.' },
            ].map(s => (
              <div key={s.step} className="bg-[#111b21]/80 border border-white/5 rounded-2xl p-6 text-center">
                <div className="text-4xl font-bold text-white/10 font-mono mb-3">{s.step}</div>
                <h3 className="text-lg font-semibold text-white mb-2 font-[Noto_Sans]">{s.title}</h3>
                <p className="text-sm text-[#8696a0]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== GRUP KULLANIMI ===== */}
      <section ref={groupAnim.ref} className="py-24 relative">
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-1000 ${
          groupAnim.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
        }`}>
          <div className="text-center mb-16">
            <Badge variant="outline" className="border-white/15 text-[#c1cdd7] bg-white/5 px-4 py-1.5 mb-4">
              <Users className="w-3 h-3 mr-1.5" />
              Grup Mesajlaşma
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold font-[Noto_Sans] text-white mt-4">
              Ekibinizle Güvenle İletişim Kurun
            </h2>
            <p className="text-[#8696a0] mt-4 max-w-2xl mx-auto">
              Workspace sistemi ile şirketinizi veya grubunuzu oluşturun, davet kodları ile ekibinizi ekleyin.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Building2,
                step: '1',
                title: 'Workspace Oluştur',
                desc: 'Şirketiniz veya grubunuz için bir çalışma alanı oluşturun. Adını ve kapasitesini belirleyin.',
              },
              {
                icon: UserPlus,
                step: '2',
                title: 'Ekibinizi Davet Edin',
                desc: '6 haneli davet kodları üretin. Her kod tek kullanımlıktır ve kişiye özeldir.',
              },
              {
                icon: MessageSquare,
                step: '3',
                title: 'Mesajlaşmaya Başlayın',
                desc: 'Genel Oda\'da grup sohbeti, Özel Odalar\'da birebir iletişim. Tüm mesajlar şifreli.',
              },
              {
                icon: Crown,
                step: '4',
                title: 'Yönetin ve Kontrol Edin',
                desc: 'Admin panelinden personeli yönetin, kanalları yapılandırın, davet kodları oluşturun.',
              },
            ].map((item) => (
              <div key={item.step} className="relative bg-[#111b21]/80 border border-white/5 rounded-2xl p-6 hover:border-white/15 transition-all group">
                <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-white/15 border border-white/30 flex items-center justify-center text-white text-sm font-bold">
                  {item.step}
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4 mt-2 group-hover:bg-white/10 transition-colors">
                  <item.icon className="w-6 h-6 text-[#c1cdd7] group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2 font-[Noto_Sans]">{item.title}</h3>
                <p className="text-sm text-[#8696a0] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Admin capabilities */}
          <div className="mt-12 bg-[#111b21]/60 border border-white/10 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <Crown className="w-6 h-6 text-white" />
              <h3 className="text-xl font-semibold text-white font-[Noto_Sans]">Yönetici (Admin) Yetkileri</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                'Workspace oluşturma ve yapılandırma',
                'Davet kodu üretme ve personel ekleme',
                'Personeli kovma (tüm verileri silinir)',
                'Şirket kurallarını belirleme',
                'Kanal oluşturma ve yapılandırma',
                'Tüm mesajları silme yetkisi',
              ].map(cap => (
                <div key={cap} className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-white/40 shrink-0" />
                  <span className="text-sm text-[#8696a0]">{cap}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== DOWNLOAD / PLATFORM SECTION ===== */}
      <section id="download" ref={downloadAnim.ref} className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b141a] via-[#0d1f2d]/30 to-[#0b141a]" />
        <div className={`relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-1000 ${
          downloadAnim.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
        }`}>
          <div className="text-center mb-12">
            <Badge variant="outline" className="border-white/15 text-[#c1cdd7] bg-white/5 px-4 py-1.5 mb-4">
              <Download className="w-3 h-3 mr-1.5" />
              İndir ve Kullan
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold font-[Noto_Sans] text-white mt-4">
              Her Cihazda, Her Yerde
            </h2>
            <p className="text-[#8696a0] mt-4 max-w-xl mx-auto">
              Web tarayıcı ve Android APK desteği ile her cihazdan güvenle erişin.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Web Browser */}
            <div className="bg-[#111b21]/80 border border-white/5 rounded-2xl p-8 hover:border-white/15 transition-all">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <Monitor className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white font-[Noto_Sans]">Web Tarayıcı</h3>
                  <p className="text-sm text-[#8696a0]">Chrome, Firefox, Safari, Edge</p>
                </div>
              </div>
              <p className="text-[#8696a0] leading-relaxed mb-6">
                Herhangi bir kurulum gerektirmez. Web tarayıcınızdan doğrudan erişin ve anında mesajlaşmaya başlayın.
                Tüm modern tarayıcılarla uyumludur.
              </p>
              <div className="space-y-3 mb-6">
                {['Kurulum gerektirmez', 'Tüm tarayıcılarla uyumlu', 'Anında erişim', 'Otomatik güncelleme'].map(f => (
                  <div key={f} className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-white/40 shrink-0" />
                    <span className="text-sm text-[#8696a0]">{f}</span>
                  </div>
                ))}
              </div>
              <Button onClick={() => navigate('/chat')}
                className="w-full bg-[#00a884] hover:bg-[#00a884]/90 text-white rounded-xl h-12 font-semibold shadow-lg shadow-[#00a884]/20">
                <Monitor className="w-5 h-5 mr-2" />
                Web'den Başlat
              </Button>
            </div>

            {/* Android APK */}
            <div className="bg-[#111b21]/80 border border-white/5 rounded-2xl p-8 hover:border-white/15 transition-all">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <Smartphone className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white font-[Noto_Sans]">Android APK</h3>
                  <p className="text-sm text-[#8696a0]">Android 7.0 ve üzeri</p>
                </div>
              </div>
              <p className="text-[#8696a0] leading-relaxed mb-4">
                Android telefonunuza APK olarak indirin. Capacitor JS altyapısı ile native performans.
                Push bildirimleri ve yerel dosya erişimi desteği.
              </p>
              <div className="space-y-3 mb-4">
                <a href="https://files.manuscdn.com/user_upload_by_module/session_file/310419663026722638/NzMDRVsDaybxomlt.aab" download="ChatAppUltra-v2.0.aab" rel="noopener noreferrer" className="w-full block">
                  <Button variant="outline"
                    className="w-full border-white/20 text-white hover:bg-white/10 rounded-xl h-12 font-semibold">
                    <Download className="w-5 h-5 mr-2" />
                    AAB İndir (Google Play için)
                  </Button>
                </a>
                <a href="https://files.manuscdn.com/user_upload_by_module/session_file/310419663026722638/khWSYgPFZBDVdNLI.apk" download="ChatAppUltra-v2.0.apk" rel="noopener noreferrer" className="w-full block">
                  <Button variant="outline"
                    className="w-full border-white/10 text-[#8696a0] hover:bg-white/5 rounded-xl h-10 text-sm">
                    <Download className="w-4 h-4 mr-2" />
                    APK İndir (Doğrudan Kurulum)
                  </Button>
                </a>
              </div>
              <p className="text-xs text-[#8696a0]/60 text-center">AAB: 1.8MB (Play Store) | APK: 1.4MB (Doğrudan)</p>
            </div>
          </div>

          <div className="mt-12 rounded-2xl overflow-hidden border border-white/5 shadow-2xl shadow-black/30">
            <img src={MOCKUP_IMG} alt="ChatApp Ultra - Çoklu Platform" className="w-full h-auto" loading="lazy" />
          </div>
        </div>
      </section>

      {/* ===== DETAILED ANDROID INSTALLATION GUIDE ===== */}
      <section id="android-guide" className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b141a] via-[#071a12]/30 to-[#0b141a]" />
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <Badge variant="outline" className="border-white/15 text-[#c1cdd7] bg-white/5 px-4 py-1.5 mb-4">
              <Smartphone className="w-3 h-3 mr-1.5" />
              Adım Adım Rehber
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold font-[Noto_Sans] text-white mt-4">
              Android Kurulum Rehberi
            </h2>
            <p className="text-[#8696a0] mt-4 max-w-2xl mx-auto">
              ChatApp Ultra'yı Android telefonunuza kurmak çok kolay! Aşağıdaki adımları sırayla takip edin.
              <strong className="text-white"> Her adımı detaylı anlattık, herkes kolayca kurabilir.</strong>
            </p>
          </div>

          <div className="space-y-6">
            {/* ADIM 1 */}
            <div className="bg-[#111b21]/80 border border-white/5 rounded-2xl p-6 sm:p-8 hover:border-white/15 transition-all">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white font-bold text-lg shrink-0">1</div>
                <h3 className="text-xl font-semibold text-white font-[Noto_Sans]">APK Dosyasını İndirin</h3>
              </div>
              <div className="ml-16 space-y-3">
                <p className="text-[#8696a0] leading-relaxed">
                  👉 Aşağıdaki yeşil butona tıklayın. Dosya otomatik olarak telefonunuza inecek.
                </p>
                <p className="text-[#8696a0] leading-relaxed">
                  👉 İndirme başladığında ekranın üstünde bir bildirim çıkacak. Bu normal, endişelenmeyin.
                </p>
                <p className="text-[#8696a0] leading-relaxed">
                  👉 Dosya boyutu yaklaşık <strong className="text-white">1.4 MB</strong> civarındadır. Wi-Fi ile indirmenizi öneririz.
                </p>
                <a href="https://files.manuscdn.com/user_upload_by_module/session_file/310419663026722638/khWSYgPFZBDVdNLI.apk" download="ChatAppUltra-v2.0.apk" rel="noopener noreferrer">
                  <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 rounded-xl h-12 font-semibold mt-2">
                    <Download className="w-5 h-5 mr-2" />
                    ChatApp Ultra APK İndir (v2.0)
                  </Button>
                </a>
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 mt-3">
                  <p className="text-yellow-400 text-sm">⚠️ Eğer indirme başlamazsa, tarayıcınızın indirme izni kapalı olabilir. Tarayıcı ayarlarından indirme iznini açın.</p>
                </div>
              </div>
            </div>

            {/* ADIM 2 */}
            <div className="bg-[#111b21]/80 border border-white/5 rounded-2xl p-6 sm:p-8 hover:border-white/15 transition-all">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white font-bold text-lg shrink-0">2</div>
                <h3 className="text-xl font-semibold text-white font-[Noto_Sans]">"Bilinmeyen Kaynaklardan Yükleme" İznini Açın</h3>
              </div>
              <div className="ml-16 space-y-4">
                <p className="text-[#8696a0] leading-relaxed">
                  Android telefonunuz, güvenlik nedeniyle mağaza dışı uygulamaları engeller. Bu izni açmanız gerekiyor.
                  <strong className="text-white"> Endişelenmeyin, ChatApp Ultra %100 güvenlidir.</strong>
                </p>
                
                {/* Samsung */}
                <div className="bg-[#0b141a]/80 border border-blue-500/10 rounded-xl p-4">
                  <h4 className="text-blue-400 font-medium mb-2 flex items-center gap-2">
                    <Smartphone className="w-4 h-4" /> Samsung Telefonlar
                  </h4>
                  <ol className="space-y-1.5 text-sm text-[#8696a0]">
                    <li>1️⃣ Telefonunuzun <strong className="text-white">Ayarlar</strong> uygulamasını açın (⚙️ dişli çark simgesi)</li>
                    <li>2️⃣ <strong className="text-white">"Biyometri ve Güvenlik"</strong> veya <strong className="text-white">"Güvenlik"</strong> bölümüne girin</li>
                    <li>3️⃣ <strong className="text-white">"Bilinmeyen uygulamaları yükle"</strong> seçeneğine dokunun</li>
                    <li>4️⃣ Kullandığınız tarayıcıyı bulun (Chrome, Samsung Internet vb.)</li>
                    <li>5️⃣ <strong className="text-white">"Bu kaynaktan izin ver"</strong> seçeneğini <strong className="text-white">AÇIK</strong> yapın</li>
                  </ol>
                </div>

                {/* Xiaomi */}
                <div className="bg-[#0b141a]/80 border border-orange-500/10 rounded-xl p-4">
                  <h4 className="text-orange-400 font-medium mb-2 flex items-center gap-2">
                    <Smartphone className="w-4 h-4" /> Xiaomi / Redmi Telefonlar
                  </h4>
                  <ol className="space-y-1.5 text-sm text-[#8696a0]">
                    <li>1️⃣ <strong className="text-white">Ayarlar</strong> → <strong className="text-white">"Gizlilik koruması"</strong> → <strong className="text-white">"Özel izinler"</strong></li>
                    <li>2️⃣ <strong className="text-white">"Bilinmeyen uygulamaları yükle"</strong> seçeneğine dokunun</li>
                    <li>3️⃣ Tarayıcınızı seçip izni <strong className="text-white">AÇIK</strong> yapın</li>
                  </ol>
                </div>

                {/* Huawei */}
                <div className="bg-[#0b141a]/80 border border-red-500/10 rounded-xl p-4">
                  <h4 className="text-red-400 font-medium mb-2 flex items-center gap-2">
                    <Smartphone className="w-4 h-4" /> Huawei Telefonlar
                  </h4>
                  <ol className="space-y-1.5 text-sm text-[#8696a0]">
                    <li>1️⃣ <strong className="text-white">Ayarlar</strong> → <strong className="text-white">"Güvenlik"</strong> → <strong className="text-white">"Diğer ayarlar"</strong></li>
                    <li>2️⃣ <strong className="text-white">"Bilinmeyen uygulamaları yükle"</strong> → Tarayıcınızı seçin → İzni açın</li>
                  </ol>
                </div>

                {/* Genel Android */}
                <div className="bg-[#0b141a]/80 border border-green-500/10 rounded-xl p-4">
                  <h4 className="text-green-400 font-medium mb-2 flex items-center gap-2">
                    <Smartphone className="w-4 h-4" /> Diğer Android (Pixel, Oppo, Realme vb.)
                  </h4>
                  <ol className="space-y-1.5 text-sm text-[#8696a0]">
                    <li>1️⃣ <strong className="text-white">Ayarlar</strong> → <strong className="text-white">"Uygulamalar"</strong> veya <strong className="text-white">"Uygulamalar ve bildirimler"</strong></li>
                    <li>2️⃣ <strong className="text-white">"Özel uygulama erişimi"</strong> → <strong className="text-white">"Bilinmeyen uygulamaları yükle"</strong></li>
                    <li>3️⃣ Tarayıcınızı seçip izni <strong className="text-white">AÇIK</strong> yapın</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* ADIM 3 */}
            <div className="bg-[#111b21]/80 border border-white/5 rounded-2xl p-6 sm:p-8 hover:border-white/15 transition-all">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white font-bold text-lg shrink-0">3</div>
                <h3 className="text-xl font-semibold text-white font-[Noto_Sans]">APK Dosyasını Açın ve Kurun</h3>
              </div>
              <div className="ml-16 space-y-3">
                <ol className="space-y-2 text-[#8696a0]">
                  <li>1️⃣ Telefonunuzun <strong className="text-white">bildirim çubuğunu</strong> aşağı çekin (ekranın en üstünden aşağı kaydırın)</li>
                  <li>2️⃣ İndirilen <strong className="text-white">"ChatAppUltra.apk"</strong> dosyasına dokunun</li>
                  <li>3️⃣ <strong className="text-white">"Yükle"</strong> veya <strong className="text-white">"Kur"</strong> butonuna basın</li>
                  <li>4️⃣ Yükleme tamamlanınca <strong className="text-white">"Aç"</strong> butonuna basın</li>
                </ol>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mt-3">
                  <p className="text-blue-400 text-sm">💡 <strong>İpucu:</strong> Eğer bildirimlerde bulamazsanız, <strong>Dosya Yöneticisi</strong> uygulamasını açıp <strong>"İndirilenler"</strong> klasörüne bakın.</p>
                </div>
              </div>
            </div>

            {/* ADIM 4 */}
            <div className="bg-[#111b21]/80 border border-white/5 rounded-2xl p-6 sm:p-8 hover:border-white/15 transition-all">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white font-bold text-lg shrink-0">4</div>
                <h3 className="text-xl font-semibold text-white font-[Noto_Sans]">Uygulamayı İlk Kez Açın</h3>
              </div>
              <div className="ml-16 space-y-4">
                <p className="text-[#8696a0] leading-relaxed">Uygulama açıldığında karşınıza <strong className="text-white">iki seçenek</strong> çıkacak:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                    <h4 className="text-blue-400 font-medium mb-2">🔵 "Yeni Ağ Oluştur"</h4>
                    <p className="text-sm text-[#8696a0]">Eğer siz <strong className="text-white">patron/yöneticiyseniz</strong> buna tıklayın. Şirketiniz için yeni bir mesajlaşma ağı kurarsınız.</p>
                  </div>
                  <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                    <h4 className="text-green-400 font-medium mb-2">🟢 "Davet Koduyla Katıl"</h4>
                    <p className="text-sm text-[#8696a0]">Eğer bir <strong className="text-white">çalışansınız</strong> ve patronunuz size 6 haneli bir kod verdiyse buna tıklayın.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ADIM 5A - Patron */}
            <div className="bg-[#111b21]/80 border border-blue-500/10 rounded-2xl p-6 sm:p-8 hover:border-blue-500/20 transition-all">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">5A</div>
                <h3 className="text-xl font-semibold text-white font-[Noto_Sans]">Patron/Yönetici İseniz – Yeni Ağ Oluşturun</h3>
              </div>
              <div className="ml-16 space-y-3">
                <ol className="space-y-2 text-[#8696a0]">
                  <li>1️⃣ <strong className="text-white">"Yeni Ağ Oluştur"</strong> butonuna dokunun</li>
                  <li>2️⃣ <strong className="text-white">Şirket adınızı</strong> yazın (Örnek: "Ultra A.Ş." veya "Takım Alfa")</li>
                  <li>3️⃣ <strong className="text-white">Kullanıcı adınızı</strong> yazın (Örnek: "Ahmet Bey" veya "Patron")</li>
                  <li>4️⃣ <strong className="text-white">"Oluştur"</strong> butonuna basın</li>
                  <li>5️⃣ 🎉 Tebrikler! Artık ağınız hazır. <strong className="text-white">Genel Oda</strong> kanalı otomatik oluşturuldu.</li>
                </ol>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mt-3">
                  <p className="text-blue-400 text-sm">🔑 <strong>Önemli:</strong> Sol menüdeki ⚙️ Ayarlar butonundan personel davet edebilir, kurallar belirleyebilir ve ağınızı yönetebilirsiniz.</p>
                </div>
              </div>
            </div>

            {/* ADIM 5B - Çalışan */}
            <div className="bg-[#111b21]/80 border border-green-500/10 rounded-2xl p-6 sm:p-8 hover:border-green-500/20 transition-all">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-sm shrink-0">5B</div>
                <h3 className="text-xl font-semibold text-white font-[Noto_Sans]">Çalışan İseniz – Davet Koduyla Katılın</h3>
              </div>
              <div className="ml-16 space-y-3">
                <ol className="space-y-2 text-[#8696a0]">
                  <li>1️⃣ <strong className="text-white">"Davet Koduyla Katıl"</strong> butonuna dokunun</li>
                  <li>2️⃣ Patronunuzun size verdiği <strong className="text-white">6 haneli kodu</strong> girin (Örnek: "A3B7K9")</li>
                  <li>3️⃣ <strong className="text-white">"Katıl"</strong> butonuna basın</li>
                  <li>4️⃣ 🎉 Tebrikler! Artık şirketinizin mesajlaşma ağına katıldınız.</li>
                </ol>
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 mt-3">
                  <p className="text-yellow-400 text-sm">⚠️ <strong>Not:</strong> Davet kodu tek kullanımlıktır. Kullandıktan sonra geçersiz olur. Yeni bir koda ihtiyacınız olursa patronunuzdan isteyin.</p>
                </div>
              </div>
            </div>

            {/* ADIM 6 */}
            <div className="bg-[#111b21]/80 border border-white/10 rounded-2xl p-6 sm:p-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white font-bold text-lg shrink-0">6</div>
                <h3 className="text-xl font-semibold text-white font-[Noto_Sans]">Mesajlaşmaya Başlayın! 🎉</h3>
              </div>
              <div className="ml-16 space-y-3">
                <div className="space-y-2 text-[#8696a0]">
                  <p>✅ Sol taraftaki kanallardan birine dokunun (<strong className="text-white">Genel Oda</strong> herkesin yazabildiği yerdir)</p>
                  <p>✅ Alt kısımdaki mesaj kutusuna yazın ve <strong className="text-white">göndere basın</strong></p>
                  <p>✅ Resim veya dosya göndermek için <strong className="text-white">📎 ataç simgesine</strong> dokunun</p>
                  <p>✅ Mesajınız <strong className="text-white">AES-256 ile şifrelenerek</strong> gönderilir – kimse okuyamaz!</p>
                </div>
              </div>
            </div>

            {/* SORUN GİDERME */}
            <div className="bg-[#111b21]/80 border border-red-500/10 rounded-2xl p-6 sm:p-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-600/80 flex items-center justify-center text-white font-bold text-lg shrink-0">🔧</div>
                <h3 className="text-xl font-semibold text-white font-[Noto_Sans]">Sorun mu Yaşıyorsunuz?</h3>
              </div>
              <div className="ml-16 space-y-4">
                {[
                  { q: '"Uygulama açılmıyor"', a: 'Telefonunuzu yeniden başlatın ve tekrar deneyin.' },
                  { q: '"APK yüklenemiyor" hatası', a: 'ADIM 2\'deki "Bilinmeyen Kaynaklar" iznini açtığınızdan emin olun.' },
                  { q: '"Davet kodu çalışmıyor"', a: 'Kodu doğru girdiğinizden emin olun. Kod büyük-küçük harf duyarlıdır. Patronunuzdan yeni kod isteyin.' },
                  { q: '"Mesajlar gelmiyor"', a: 'İnternet bağlantınızı kontrol edin. Wi-Fi veya mobil veri açık olmalı.' },
                  { q: 'Başka bir sorun mu var?', a: 'İletişim sayfamızdan bize yazın, 24 saat içinde dönüş yapalım.' },
                ].map((item, i) => (
                  <div key={i} className="bg-[#0b141a]/80 border border-white/5 rounded-xl p-4">
                    <p className="text-white font-medium text-sm mb-1">❓ {item.q}</p>
                    <p className="text-[#8696a0] text-sm">→ {item.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== PRICING SECTION ===== */}
      <section id="pricing" ref={pricingAnim.ref} className="py-24 relative">
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-1000 ${
          pricingAnim.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
        }`}>
          <div className="text-center mb-16">
            <Badge variant="outline" className="border-white/15 text-[#c1cdd7] bg-white/5 px-4 py-1.5 mb-4">
              <CreditCard className="w-3 h-3 mr-1.5" />
              Fiyatlandırma
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold font-[Noto_Sans] text-white mt-4">
              İhtiyacınıza Uygun Plan
            </h2>
            <p className="text-[#8696a0] mt-4 max-w-xl mx-auto">
              Kişi sayınıza göre esnek fiyatlandırma. Seçtiğiniz kişi sayısı kadar ödeyin.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {pricingPlans.map((plan) => (
              <div key={plan.name}
                className={`relative bg-gradient-to-b ${plan.color} border ${plan.borderColor} rounded-2xl p-8 ${
                  plan.popular ? 'ring-2 ring-[#00a884]/30 scale-[1.02]' : ''
                } hover:border-white/15 transition-all`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-[#00a884] text-white border-0 px-4 py-1 shadow-lg shadow-[#00a884]/30">
                      <Star className="w-3 h-3 mr-1" />
                      En Popüler
                    </Badge>
                  </div>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                    <plan.icon className="w-5 h-5 text-white/70" />
                  </div>
                  <h3 className="text-xl font-semibold text-white font-[Noto_Sans]">{plan.name}</h3>
                </div>

                {plan.price === 'dynamic' ? (
                  <div className="mb-6">
                    {/* Kişi sayısı seçici */}
                    <div className="mb-4">
                      <label className="text-xs text-[#8696a0] uppercase tracking-wider mb-2 block">Kişi Sayısı</label>
                      <div className="flex flex-wrap gap-2">
                        {userCountOptions.map(count => (
                          <button key={count}
                            onClick={() => setSelectedUserCount(count)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                              selectedUserCount === count
                                ? 'bg-[#00a884] text-white shadow-lg shadow-[#00a884]/30'
                                : 'bg-white/5 text-[#8696a0] hover:bg-white/10 hover:text-white'
                            }`}>
                            {count}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Fiyat gösterimi */}
                    <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-white">₺{totalMonthly.toLocaleString('tr-TR')}</span>
                        <span className="text-[#8696a0] text-sm">/ay</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Users className="w-3.5 h-3.5 text-[#00a884]" />
                        <span className="text-xs text-[#8696a0]">
                          {selectedUserCount} kişi × ₺{perUserPrice}/kişi
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-[#00a884]/70">
                        Sabit fiyat • Kişi başı ₺{PER_USER_PRICE}/ay
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mb-2">
                    <span className="text-4xl font-bold text-white">{plan.price}</span>
                    {plan.period && <span className="text-[#8696a0] text-sm ml-1">{plan.period}</span>}
                  </div>
                )}
                <p className="text-sm text-[#8696a0] mb-8">{plan.desc}</p>

                <div className="space-y-3 mb-8">
                  {plan.features.map(f => (
                    <div key={f.text} className="flex items-center gap-3">
                      {f.included ? (
                        <Check className="w-4 h-4 text-white/50 shrink-0" />
                      ) : (
                        <X className="w-4 h-4 text-[#8696a0]/30 shrink-0" />
                      )}
                      <span className={`text-sm ${f.included ? 'text-[#8696a0]' : 'text-[#8696a0]/40'}`}>{f.text}</span>
                    </div>
                  ))}
                </div>

                <Button onClick={() => plan.name === 'Kurumsal' ? document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' }) : navigate('/chat')}
                  className={`w-full rounded-xl h-12 font-semibold ${
                    plan.popular
                      ? 'bg-[#00a884] hover:bg-[#00a884]/90 text-white shadow-lg shadow-[#00a884]/20'
                      : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                  }`}>
                  {plan.cta}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FAQ SECTION ===== */}
      <section id="faq" ref={faqAnim.ref} className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b141a] via-[#0d1f2d]/20 to-[#0b141a]" />
        <div className={`relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-1000 ${
          faqAnim.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
        }`}>
          <div className="text-center mb-16">
            <Badge variant="outline" className="border-white/15 text-[#c1cdd7] bg-white/5 px-4 py-1.5 mb-4">
              <HelpCircle className="w-3 h-3 mr-1.5" />
              Sıkça Sorulan Sorular
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold font-[Noto_Sans] text-white mt-4">
              Merak Ettikleriniz
            </h2>
            <p className="text-[#8696a0] mt-4">
              En çok sorulan sorular ve yanıtları.
            </p>
          </div>

          <div className="space-y-3">
            {faqItems.map((item, i) => (
              <FAQItem key={i} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ===== CONTACT SECTION ===== */}
      <section id="contact" ref={contactAnim.ref} className="py-24 relative">
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-all duration-1000 ${
          contactAnim.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
        }`}>
          <div className="text-center mb-16">
            <Badge variant="outline" className="border-white/15 text-[#c1cdd7] bg-white/5 px-4 py-1.5 mb-4">
              <Mail className="w-3 h-3 mr-1.5" />
              İletişim
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold font-[Noto_Sans] text-white mt-4">
              Bizimle İletişime Geçin
            </h2>
            <p className="text-[#8696a0] mt-4 max-w-xl mx-auto">
              Sorularınız, önerileriniz veya kurumsal talepleriniz için bize ulaşın.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Contact cards */}
            <div className="space-y-6">
              <div className="bg-[#111b21]/80 border border-white/5 rounded-2xl p-6 hover:border-white/15 transition-all">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4">
                  <Globe className="w-6 h-6 text-[#c1cdd7]" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2 font-[Noto_Sans]">Web Sitesi</h3>
                <a href="https://creatortoolboxstudio.com" target="_blank" rel="noopener noreferrer"
                  className="text-white/70 hover:text-[#00a884] hover:underline text-sm flex items-center gap-1 transition-colors">
                  creatortoolboxstudio.com
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="bg-[#111b21]/80 border border-white/5 rounded-2xl p-6 hover:border-white/15 transition-all">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4">
                  <Mail className="w-6 h-6 text-[#c1cdd7]" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2 font-[Noto_Sans]">E-posta</h3>
                <p className="text-sm text-[#8696a0]">info@creatortoolboxstudio.com</p>
              </div>

              <div className="bg-[#111b21]/80 border border-white/5 rounded-2xl p-6 hover:border-white/15 transition-all">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-[#c1cdd7]" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2 font-[Noto_Sans]">Güvenlik</h3>
                <p className="text-sm text-[#8696a0]">Güvenlik açıkları için: security@creatortoolboxstudio.com</p>
              </div>
            </div>

            {/* Contact form */}
            <div className="lg:col-span-2 bg-[#111b21]/80 border border-white/5 rounded-2xl p-8">
              <h3 className="text-xl font-semibold text-white mb-6 font-[Noto_Sans]">Bize Mesaj Gönderin</h3>
              <form onSubmit={(e) => { e.preventDefault(); window.open('https://creatortoolboxstudio.com', '_blank'); }} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="text-sm text-[#8696a0] mb-2 block">Adınız</label>
                    <input type="text" placeholder="Adınızı girin"
                      className="w-full bg-[#0b141a]/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-[#8696a0]/50 focus:outline-none focus:border-white/30 transition-colors" />
                  </div>
                  <div>
                    <label className="text-sm text-[#8696a0] mb-2 block">E-posta</label>
                    <input type="email" placeholder="E-posta adresiniz"
                      className="w-full bg-[#0b141a]/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-[#8696a0]/50 focus:outline-none focus:border-white/30 transition-colors" />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-[#8696a0] mb-2 block">Konu</label>
                  <select className="w-full bg-[#0b141a]/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-white/30 transition-colors">
                    <option value="" className="bg-[#111b21]">Konu seçin</option>
                    <option value="genel" className="bg-[#111b21]">Genel Soru</option>
                    <option value="kurumsal" className="bg-[#111b21]">Kurumsal Teklif</option>
                    <option value="teknik" className="bg-[#111b21]">Teknik Destek</option>
                    <option value="guvenlik" className="bg-[#111b21]">Güvenlik Bildirimi</option>
                    <option value="diger" className="bg-[#111b21]">Diğer</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-[#8696a0] mb-2 block">Mesajınız</label>
                  <textarea rows={4} placeholder="Mesajınızı yazın..."
                    className="w-full bg-[#0b141a]/80 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-[#8696a0]/50 focus:outline-none focus:border-white/30 transition-colors resize-none" />
                </div>
                <Button type="submit"
                  className="bg-[#00a884] hover:bg-[#00a884]/90 text-white rounded-xl px-8 h-12 font-semibold shadow-lg shadow-[#00a884]/20">
                  <Send className="w-4 h-4 mr-2" />
                  Gönder
                </Button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section ref={ctaAnim.ref} className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-t from-white/[0.02] via-transparent to-transparent" />
        <div className={`relative z-10 max-w-3xl mx-auto px-4 text-center transition-all duration-1000 ${
          ctaAnim.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
        }`}>
          <div className="bg-[#111b21]/80 border border-white/10 rounded-3xl p-10 sm:p-16 backdrop-blur-sm">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00a884] to-[#025144] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#00a884]/20">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold font-[Noto_Sans] text-white mb-4">
              Güvenli İletişime Başlayın
            </h2>
            <p className="text-[#8696a0] mb-8 max-w-md mx-auto">
              Workspace oluşturun, ekibinizi davet edin ve askeri düzeyde şifreli mesajlaşmaya hemen başlayın.
            </p>
            <Button onClick={() => navigate('/chat')} size="lg"
              className="bg-[#00a884] hover:bg-[#00a884]/90 text-white rounded-xl px-10 h-14 text-lg font-semibold shadow-xl shadow-[#00a884]/25 hover:shadow-[#00a884]/40 transition-all hover:scale-105">
              <MessageSquare className="w-5 h-5 mr-2" />
              Uygulamayı Başlat
            </Button>
            <p className="text-[#8696a0]/50 text-xs mt-6">
              Hemen deneyin. Anında başlayın.
            </p>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-white/5 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00a884] to-[#025144] flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-lg font-bold text-white font-[Noto_Sans]">ChatApp Ultra</span>
                  <p className="text-xs text-[#8696a0]">Sentinel Ultra</p>
                </div>
              </div>
              <p className="text-sm text-[#8696a0] leading-relaxed">
                Kurumsal mesajlaşmanın geleceği. Signal Protocol (X3DH + Double Ratchet) ile uçtan uça şifreli, güvenli iletişim platformu.
              </p>
            </div>

            {/* Links */}
            <div>
              <h4 className="text-white font-semibold mb-4 font-[Noto_Sans]">Ürün</h4>
              <div className="space-y-3">
                <a href="#features" className="block text-sm text-[#8696a0] hover:text-white transition-colors">Özellikler</a>
                <a href="#security" className="block text-sm text-[#8696a0] hover:text-white transition-colors">Güvenlik</a>
                <a href="#pricing" className="block text-sm text-[#8696a0] hover:text-white transition-colors">Fiyatlandırma</a>
                <a href="#download" className="block text-sm text-[#8696a0] hover:text-white transition-colors">İndir</a>
              </div>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4 font-[Noto_Sans]">Destek</h4>
              <div className="space-y-3">
                <a href="#faq" className="block text-sm text-[#8696a0] hover:text-white transition-colors">SSS</a>
                <a href="#contact" className="block text-sm text-[#8696a0] hover:text-white transition-colors">İletişim</a>
                <a href="https://creatortoolboxstudio.com" target="_blank" rel="noopener noreferrer" className="block text-sm text-[#8696a0] hover:text-white transition-colors">CreatorToolbox Studio</a>
              </div>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-4 font-[Noto_Sans]">Yasal</h4>
              <div className="space-y-3">
                <button onClick={() => navigate('/terms')} className="block text-sm text-[#8696a0] hover:text-white transition-colors">Kullanım Sözleşmesi</button>
                <button onClick={() => navigate('/privacy')} className="block text-sm text-[#8696a0] hover:text-white transition-colors">Gizlilik Politikası</button>
                <button onClick={() => navigate('/privacy')} className="block text-sm text-[#8696a0] hover:text-white transition-colors">KVKK Aydınlatma Metni</button>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6 text-xs text-[#8696a0]">
              <div className="flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-white/40" />
                <span>E2E Encrypted</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="w-3 h-3 text-white/40" />
                <span>GDPR / KVKK</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Globe className="w-3 h-3 text-white/40" />
                <span>5 Languages</span>
              </div>
            </div>
            <p className="text-xs text-[#8696a0]/50">
              &copy; {new Date().getFullYear()} ChatApp Ultra - CreatorToolbox Studio. Tüm hakları saklıdır.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
