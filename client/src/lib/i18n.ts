/**
 * ChatApp Ultra - Uluslararası Dil Desteği (i18n)
 * Desteklenen diller: Türkçe, İngilizce, Almanca, Arapça, Fransızca
 */

export type Language = 'tr' | 'en' | 'de' | 'ar' | 'fr';

export interface Translations {
  // App
  appName: string;
  appSubtitle: string;
  loading: string;
  
  // Login
  deviceName: string;
  deviceNamePlaceholder: string;
  createWorkspace: string;
  joinWorkspace: string;
  e2eEncrypted: string;
  ultraSecure: string;
  
  // Create Workspace
  workspaceName: string;
  workspaceNamePlaceholder: string;
  adminPassword: string;
  adminPasswordPlaceholder: string;
  maxUsers: string;
  adminName: string;
  adminNamePlaceholder: string;
  create: string;
  
  // Join Workspace
  inviteCode: string;
  inviteCodePlaceholder: string;
  yourName: string;
  yourNamePlaceholder: string;
  aboutMe: string;
  aboutMePlaceholder: string;
  join: string;
  
  // Chat
  typeMessage: string;
  searchPlaceholder: string;
  online: string;
  offline: string;
  lastSeen: string;
  typing: string;
  members: string;
  generalRoom: string;
  systemBot: string;
  aiAssistant: string;
  privateMessages: string;
  
  // Admin
  adminPanel: string;
  personnel: string;
  invites: string;
  rules: string;
  settings: string;
  newInviteCode: string;
  personName: string;
  role: string;
  rolePersonnel: string;
  roleAdmin: string;
  createInviteCode: string;
  existingCodes: string;
  used: string;
  fireUser: string;
  fireConfirm: string;
  companyRules: string;
  companyRulesDesc: string;
  companyRulesPlaceholder: string;
  saveRules: string;
  profile: string;
  statusMessage: string;
  updateProfile: string;
  workspaceInfo: string;
  name: string;
  totalUsers: string;
  
  // Messages
  photo: string;
  file: string;
  timedMessage: string;
  delete: string;
  messageSent: string;
  messageFailed: string;
  fileSent: string;
  fileFailed: string;
  workspaceCreated: string;
  joinedWorkspace: string;
  inviteCreated: string;
  userFired: string;
  rulesSaved: string;
  profileUpdated: string;
  fillAllFields: string;
  invalidInvite: string;
  copied: string;
  cancel: string;
  logout: string;
  
  // Security
  messagesEncrypted: string;
  securityInfo: string;
  
  // GDPR
  gdprTitle: string;
  gdprExportData: string;
  gdprDeleteData: string;
  gdprConsent: string;
  privacyPolicy: string;
}

const tr: Translations = {
  appName: 'ChatApp Ultra',
  appSubtitle: 'Sentinel Ultra - Kurumsal Güvenli Mesajlaşma',
  loading: 'Yükleniyor...',
  deviceName: 'Cihaz Adı',
  deviceNamePlaceholder: 'Bu cihazın adı',
  createWorkspace: 'Yeni Workspace Oluştur',
  joinWorkspace: "Workspace'e Katıl",
  e2eEncrypted: 'Uçtan Uca Şifreli',
  ultraSecure: 'Ultra Güvenli',
  workspaceName: 'Workspace Adı',
  workspaceNamePlaceholder: 'Şirket veya grup adı',
  adminPassword: 'Admin Şifresi',
  adminPasswordPlaceholder: 'Yönetici şifresi',
  maxUsers: 'Maksimum Kullanıcı',
  adminName: 'Yönetici Adı',
  adminNamePlaceholder: 'Adınız',
  create: 'Oluştur',
  inviteCode: 'Davet Kodu',
  inviteCodePlaceholder: '6 haneli davet kodu',
  yourName: 'Adınız',
  yourNamePlaceholder: 'Görünen adınız',
  aboutMe: 'Hakkımda',
  aboutMePlaceholder: 'Kısa bir açıklama',
  join: 'Katıl',
  typeMessage: 'Mesaj yazın...',
  searchPlaceholder: 'Ara veya yeni sohbet başlat',
  online: 'Çevrimiçi',
  offline: 'Çevrimdışı',
  lastSeen: 'Son görülme',
  typing: 'yazıyor...',
  members: 'üye',
  generalRoom: 'Genel Oda',
  systemBot: 'Sistem Botu',
  aiAssistant: 'AI Asistan',
  privateMessages: 'Özel mesajlar',
  adminPanel: 'Admin Paneli',
  personnel: 'Personel',
  invites: 'Davet',
  rules: 'Kurallar',
  settings: 'Ayarlar',
  newInviteCode: 'Yeni Davet Kodu',
  personName: 'Kişi Adı',
  role: 'Rol',
  rolePersonnel: 'Personel',
  roleAdmin: 'Admin',
  createInviteCode: 'Davet Kodu Oluştur',
  existingCodes: 'Mevcut Kodlar',
  used: 'Kullanıldı',
  fireUser: 'Kov',
  fireConfirm: 'adlı kullanıcıyı kovmak istediğinize emin misiniz? Tüm verileri silinecektir.',
  companyRules: 'Şirket Kuralları',
  companyRulesDesc: 'Bu bilgiler AI asistanın bağlamında kullanılır. Şirket kuralları, ürünler ve bilgileri yazın.',
  companyRulesPlaceholder: 'Şirket kuralları ve bilgileri...',
  saveRules: 'Kuralları Kaydet',
  profile: 'Profil',
  statusMessage: 'Durum mesajı',
  updateProfile: 'Profili Güncelle',
  workspaceInfo: 'Workspace Bilgileri',
  name: 'Ad',
  totalUsers: 'Toplam Kullanıcı',
  photo: 'Fotoğraf',
  file: 'Dosya',
  timedMessage: 'Süreli mesaj',
  delete: 'Sil',
  messageSent: 'Mesaj gönderildi',
  messageFailed: 'Mesaj gönderilemedi',
  fileSent: 'Dosya gönderildi',
  fileFailed: 'Dosya gönderilemedi',
  workspaceCreated: 'Workspace oluşturuldu!',
  joinedWorkspace: "Workspace'e katıldınız!",
  inviteCreated: 'Davet kodu oluşturuldu',
  userFired: 'kovuldu',
  rulesSaved: 'Kurallar kaydedildi',
  profileUpdated: 'Profil güncellendi',
  fillAllFields: 'Lütfen tüm alanları doldurun',
  invalidInvite: 'Geçersiz veya kullanılmış davet kodu',
  copied: 'Kopyalandı',
  cancel: 'İptal',
  logout: 'Çıkış',
  messagesEncrypted: 'Mesajlarınız AES-256 ile şifrelenir',
  securityInfo: 'Güvenlik Bilgisi',
  gdprTitle: 'Veri Gizliliği',
  gdprExportData: 'Verilerimi Dışa Aktar',
  gdprDeleteData: 'Verilerimi Sil',
  gdprConsent: 'Veri işleme politikasını kabul ediyorum',
  privacyPolicy: 'Gizlilik Politikası',
};

const en: Translations = {
  appName: 'ChatApp Ultra',
  appSubtitle: 'Sentinel Ultra - Enterprise Secure Messaging',
  loading: 'Loading...',
  deviceName: 'Device Name',
  deviceNamePlaceholder: 'Name of this device',
  createWorkspace: 'Create New Workspace',
  joinWorkspace: 'Join Workspace',
  e2eEncrypted: 'End-to-End Encrypted',
  ultraSecure: 'Ultra Secure',
  workspaceName: 'Workspace Name',
  workspaceNamePlaceholder: 'Company or group name',
  adminPassword: 'Admin Password',
  adminPasswordPlaceholder: 'Administrator password',
  maxUsers: 'Maximum Users',
  adminName: 'Admin Name',
  adminNamePlaceholder: 'Your name',
  create: 'Create',
  inviteCode: 'Invite Code',
  inviteCodePlaceholder: '6-digit invite code',
  yourName: 'Your Name',
  yourNamePlaceholder: 'Display name',
  aboutMe: 'About Me',
  aboutMePlaceholder: 'Short description',
  join: 'Join',
  typeMessage: 'Type a message...',
  searchPlaceholder: 'Search or start new chat',
  online: 'Online',
  offline: 'Offline',
  lastSeen: 'Last seen',
  typing: 'typing...',
  members: 'members',
  generalRoom: 'General Room',
  systemBot: 'System Bot',
  aiAssistant: 'AI Assistant',
  privateMessages: 'Private messages',
  adminPanel: 'Admin Panel',
  personnel: 'Personnel',
  invites: 'Invites',
  rules: 'Rules',
  settings: 'Settings',
  newInviteCode: 'New Invite Code',
  personName: 'Person Name',
  role: 'Role',
  rolePersonnel: 'Personnel',
  roleAdmin: 'Admin',
  createInviteCode: 'Create Invite Code',
  existingCodes: 'Existing Codes',
  used: 'Used',
  fireUser: 'Remove',
  fireConfirm: 'Are you sure you want to remove this user? All their data will be deleted.',
  companyRules: 'Company Rules',
  companyRulesDesc: 'This information is used as AI assistant context. Write company rules, products and information.',
  companyRulesPlaceholder: 'Company rules and information...',
  saveRules: 'Save Rules',
  profile: 'Profile',
  statusMessage: 'Status message',
  updateProfile: 'Update Profile',
  workspaceInfo: 'Workspace Info',
  name: 'Name',
  totalUsers: 'Total Users',
  photo: 'Photo',
  file: 'File',
  timedMessage: 'Timed message',
  delete: 'Delete',
  messageSent: 'Message sent',
  messageFailed: 'Failed to send message',
  fileSent: 'File sent',
  fileFailed: 'Failed to send file',
  workspaceCreated: 'Workspace created!',
  joinedWorkspace: 'Joined workspace!',
  inviteCreated: 'Invite code created',
  userFired: 'removed',
  rulesSaved: 'Rules saved',
  profileUpdated: 'Profile updated',
  fillAllFields: 'Please fill in all fields',
  invalidInvite: 'Invalid or used invite code',
  copied: 'Copied',
  cancel: 'Cancel',
  logout: 'Logout',
  messagesEncrypted: 'Your messages are encrypted with AES-256',
  securityInfo: 'Security Info',
  gdprTitle: 'Data Privacy',
  gdprExportData: 'Export My Data',
  gdprDeleteData: 'Delete My Data',
  gdprConsent: 'I accept the data processing policy',
  privacyPolicy: 'Privacy Policy',
};

const de: Translations = {
  appName: 'ChatApp Ultra',
  appSubtitle: 'Sentinel Ultra - Sichere Unternehmensnachrichten',
  loading: 'Laden...',
  deviceName: 'Gerätename',
  deviceNamePlaceholder: 'Name dieses Geräts',
  createWorkspace: 'Neuen Workspace erstellen',
  joinWorkspace: 'Workspace beitreten',
  e2eEncrypted: 'Ende-zu-Ende verschlüsselt',
  ultraSecure: 'Ultra Sicher',
  workspaceName: 'Workspace-Name',
  workspaceNamePlaceholder: 'Firmen- oder Gruppenname',
  adminPassword: 'Admin-Passwort',
  adminPasswordPlaceholder: 'Administratorpasswort',
  maxUsers: 'Maximale Benutzer',
  adminName: 'Admin-Name',
  adminNamePlaceholder: 'Ihr Name',
  create: 'Erstellen',
  inviteCode: 'Einladungscode',
  inviteCodePlaceholder: '6-stelliger Einladungscode',
  yourName: 'Ihr Name',
  yourNamePlaceholder: 'Anzeigename',
  aboutMe: 'Über mich',
  aboutMePlaceholder: 'Kurze Beschreibung',
  join: 'Beitreten',
  typeMessage: 'Nachricht eingeben...',
  searchPlaceholder: 'Suchen oder neuen Chat starten',
  online: 'Online',
  offline: 'Offline',
  lastSeen: 'Zuletzt gesehen',
  typing: 'tippt...',
  members: 'Mitglieder',
  generalRoom: 'Allgemeiner Raum',
  systemBot: 'System-Bot',
  aiAssistant: 'KI-Assistent',
  privateMessages: 'Private Nachrichten',
  adminPanel: 'Admin-Panel',
  personnel: 'Personal',
  invites: 'Einladungen',
  rules: 'Regeln',
  settings: 'Einstellungen',
  newInviteCode: 'Neuer Einladungscode',
  personName: 'Personenname',
  role: 'Rolle',
  rolePersonnel: 'Personal',
  roleAdmin: 'Admin',
  createInviteCode: 'Einladungscode erstellen',
  existingCodes: 'Vorhandene Codes',
  used: 'Verwendet',
  fireUser: 'Entfernen',
  fireConfirm: 'Möchten Sie diesen Benutzer wirklich entfernen? Alle Daten werden gelöscht.',
  companyRules: 'Unternehmensregeln',
  companyRulesDesc: 'Diese Informationen werden als KI-Assistentenkontext verwendet.',
  companyRulesPlaceholder: 'Unternehmensregeln und Informationen...',
  saveRules: 'Regeln speichern',
  profile: 'Profil',
  statusMessage: 'Statusnachricht',
  updateProfile: 'Profil aktualisieren',
  workspaceInfo: 'Workspace-Info',
  name: 'Name',
  totalUsers: 'Gesamtbenutzer',
  photo: 'Foto',
  file: 'Datei',
  timedMessage: 'Zeitgesteuerte Nachricht',
  delete: 'Löschen',
  messageSent: 'Nachricht gesendet',
  messageFailed: 'Nachricht konnte nicht gesendet werden',
  fileSent: 'Datei gesendet',
  fileFailed: 'Datei konnte nicht gesendet werden',
  workspaceCreated: 'Workspace erstellt!',
  joinedWorkspace: 'Workspace beigetreten!',
  inviteCreated: 'Einladungscode erstellt',
  userFired: 'entfernt',
  rulesSaved: 'Regeln gespeichert',
  profileUpdated: 'Profil aktualisiert',
  fillAllFields: 'Bitte füllen Sie alle Felder aus',
  invalidInvite: 'Ungültiger oder verwendeter Einladungscode',
  copied: 'Kopiert',
  cancel: 'Abbrechen',
  logout: 'Abmelden',
  messagesEncrypted: 'Ihre Nachrichten sind mit AES-256 verschlüsselt',
  securityInfo: 'Sicherheitsinfo',
  gdprTitle: 'Datenschutz',
  gdprExportData: 'Meine Daten exportieren',
  gdprDeleteData: 'Meine Daten löschen',
  gdprConsent: 'Ich akzeptiere die Datenverarbeitungsrichtlinie',
  privacyPolicy: 'Datenschutzrichtlinie',
};

const ar: Translations = {
  appName: 'ChatApp Ultra',
  appSubtitle: 'سنتينل ألترا - المراسلة المؤسسية الآمنة',
  loading: 'جاري التحميل...',
  deviceName: 'اسم الجهاز',
  deviceNamePlaceholder: 'اسم هذا الجهاز',
  createWorkspace: 'إنشاء مساحة عمل جديدة',
  joinWorkspace: 'الانضمام إلى مساحة العمل',
  e2eEncrypted: 'مشفر من طرف إلى طرف',
  ultraSecure: 'آمن للغاية',
  workspaceName: 'اسم مساحة العمل',
  workspaceNamePlaceholder: 'اسم الشركة أو المجموعة',
  adminPassword: 'كلمة مرور المسؤول',
  adminPasswordPlaceholder: 'كلمة مرور المسؤول',
  maxUsers: 'الحد الأقصى للمستخدمين',
  adminName: 'اسم المسؤول',
  adminNamePlaceholder: 'اسمك',
  create: 'إنشاء',
  inviteCode: 'رمز الدعوة',
  inviteCodePlaceholder: 'رمز دعوة مكون من 6 أرقام',
  yourName: 'اسمك',
  yourNamePlaceholder: 'الاسم المعروض',
  aboutMe: 'نبذة عني',
  aboutMePlaceholder: 'وصف قصير',
  join: 'انضمام',
  typeMessage: 'اكتب رسالة...',
  searchPlaceholder: 'بحث أو بدء محادثة جديدة',
  online: 'متصل',
  offline: 'غير متصل',
  lastSeen: 'آخر ظهور',
  typing: 'يكتب...',
  members: 'أعضاء',
  generalRoom: 'الغرفة العامة',
  systemBot: 'بوت النظام',
  aiAssistant: 'مساعد الذكاء الاصطناعي',
  privateMessages: 'رسائل خاصة',
  adminPanel: 'لوحة الإدارة',
  personnel: 'الموظفون',
  invites: 'الدعوات',
  rules: 'القواعد',
  settings: 'الإعدادات',
  newInviteCode: 'رمز دعوة جديد',
  personName: 'اسم الشخص',
  role: 'الدور',
  rolePersonnel: 'موظف',
  roleAdmin: 'مسؤول',
  createInviteCode: 'إنشاء رمز دعوة',
  existingCodes: 'الرموز الحالية',
  used: 'مستخدم',
  fireUser: 'إزالة',
  fireConfirm: 'هل أنت متأكد من إزالة هذا المستخدم؟ سيتم حذف جميع بياناته.',
  companyRules: 'قواعد الشركة',
  companyRulesDesc: 'تُستخدم هذه المعلومات كسياق لمساعد الذكاء الاصطناعي.',
  companyRulesPlaceholder: 'قواعد الشركة والمعلومات...',
  saveRules: 'حفظ القواعد',
  profile: 'الملف الشخصي',
  statusMessage: 'رسالة الحالة',
  updateProfile: 'تحديث الملف الشخصي',
  workspaceInfo: 'معلومات مساحة العمل',
  name: 'الاسم',
  totalUsers: 'إجمالي المستخدمين',
  photo: 'صورة',
  file: 'ملف',
  timedMessage: 'رسالة مؤقتة',
  delete: 'حذف',
  messageSent: 'تم إرسال الرسالة',
  messageFailed: 'فشل إرسال الرسالة',
  fileSent: 'تم إرسال الملف',
  fileFailed: 'فشل إرسال الملف',
  workspaceCreated: 'تم إنشاء مساحة العمل!',
  joinedWorkspace: 'تم الانضمام إلى مساحة العمل!',
  inviteCreated: 'تم إنشاء رمز الدعوة',
  userFired: 'تمت الإزالة',
  rulesSaved: 'تم حفظ القواعد',
  profileUpdated: 'تم تحديث الملف الشخصي',
  fillAllFields: 'يرجى ملء جميع الحقول',
  invalidInvite: 'رمز دعوة غير صالح أو مستخدم',
  copied: 'تم النسخ',
  cancel: 'إلغاء',
  logout: 'تسجيل الخروج',
  messagesEncrypted: 'رسائلك مشفرة بـ AES-256',
  securityInfo: 'معلومات الأمان',
  gdprTitle: 'خصوصية البيانات',
  gdprExportData: 'تصدير بياناتي',
  gdprDeleteData: 'حذف بياناتي',
  gdprConsent: 'أوافق على سياسة معالجة البيانات',
  privacyPolicy: 'سياسة الخصوصية',
};

const fr: Translations = {
  appName: 'ChatApp Ultra',
  appSubtitle: 'Sentinel Ultra - Messagerie Sécurisée d\'Entreprise',
  loading: 'Chargement...',
  deviceName: 'Nom de l\'appareil',
  deviceNamePlaceholder: 'Nom de cet appareil',
  createWorkspace: 'Créer un Workspace',
  joinWorkspace: 'Rejoindre un Workspace',
  e2eEncrypted: 'Chiffré de bout en bout',
  ultraSecure: 'Ultra Sécurisé',
  workspaceName: 'Nom du Workspace',
  workspaceNamePlaceholder: 'Nom de l\'entreprise ou du groupe',
  adminPassword: 'Mot de passe Admin',
  adminPasswordPlaceholder: 'Mot de passe administrateur',
  maxUsers: 'Utilisateurs maximum',
  adminName: 'Nom de l\'Admin',
  adminNamePlaceholder: 'Votre nom',
  create: 'Créer',
  inviteCode: 'Code d\'invitation',
  inviteCodePlaceholder: 'Code d\'invitation à 6 chiffres',
  yourName: 'Votre nom',
  yourNamePlaceholder: 'Nom affiché',
  aboutMe: 'À propos de moi',
  aboutMePlaceholder: 'Courte description',
  join: 'Rejoindre',
  typeMessage: 'Tapez un message...',
  searchPlaceholder: 'Rechercher ou démarrer une conversation',
  online: 'En ligne',
  offline: 'Hors ligne',
  lastSeen: 'Vu pour la dernière fois',
  typing: 'écrit...',
  members: 'membres',
  generalRoom: 'Salle Générale',
  systemBot: 'Bot Système',
  aiAssistant: 'Assistant IA',
  privateMessages: 'Messages privés',
  adminPanel: 'Panneau Admin',
  personnel: 'Personnel',
  invites: 'Invitations',
  rules: 'Règles',
  settings: 'Paramètres',
  newInviteCode: 'Nouveau Code d\'Invitation',
  personName: 'Nom de la personne',
  role: 'Rôle',
  rolePersonnel: 'Personnel',
  roleAdmin: 'Admin',
  createInviteCode: 'Créer un Code d\'Invitation',
  existingCodes: 'Codes Existants',
  used: 'Utilisé',
  fireUser: 'Supprimer',
  fireConfirm: 'Êtes-vous sûr de vouloir supprimer cet utilisateur? Toutes ses données seront effacées.',
  companyRules: 'Règles de l\'Entreprise',
  companyRulesDesc: 'Ces informations sont utilisées comme contexte pour l\'assistant IA.',
  companyRulesPlaceholder: 'Règles et informations de l\'entreprise...',
  saveRules: 'Enregistrer les Règles',
  profile: 'Profil',
  statusMessage: 'Message de statut',
  updateProfile: 'Mettre à jour le Profil',
  workspaceInfo: 'Infos Workspace',
  name: 'Nom',
  totalUsers: 'Total Utilisateurs',
  photo: 'Photo',
  file: 'Fichier',
  timedMessage: 'Message temporisé',
  delete: 'Supprimer',
  messageSent: 'Message envoyé',
  messageFailed: 'Échec de l\'envoi du message',
  fileSent: 'Fichier envoyé',
  fileFailed: 'Échec de l\'envoi du fichier',
  workspaceCreated: 'Workspace créé!',
  joinedWorkspace: 'Workspace rejoint!',
  inviteCreated: 'Code d\'invitation créé',
  userFired: 'supprimé',
  rulesSaved: 'Règles enregistrées',
  profileUpdated: 'Profil mis à jour',
  fillAllFields: 'Veuillez remplir tous les champs',
  invalidInvite: 'Code d\'invitation invalide ou utilisé',
  copied: 'Copié',
  cancel: 'Annuler',
  logout: 'Déconnexion',
  messagesEncrypted: 'Vos messages sont chiffrés avec AES-256',
  securityInfo: 'Info Sécurité',
  gdprTitle: 'Confidentialité des Données',
  gdprExportData: 'Exporter mes Données',
  gdprDeleteData: 'Supprimer mes Données',
  gdprConsent: 'J\'accepte la politique de traitement des données',
  privacyPolicy: 'Politique de Confidentialité',
};

const translations: Record<Language, Translations> = { tr, en, de, ar, fr };

export function getTranslations(lang: Language): Translations {
  return translations[lang] || translations.tr;
}

export function detectLanguage(): Language {
  const stored = localStorage.getItem('sentinel_language') as Language;
  if (stored && translations[stored]) return stored;
  
  const browserLang = navigator.language.substring(0, 2) as Language;
  if (translations[browserLang]) return browserLang;
  
  return 'tr';
}

export function setLanguage(lang: Language): void {
  localStorage.setItem('sentinel_language', lang);
}

export function isRTL(lang: Language): boolean {
  return lang === 'ar';
}

export const languageNames: Record<Language, string> = {
  tr: 'Türkçe',
  en: 'English',
  de: 'Deutsch',
  ar: 'العربية',
  fr: 'Français',
};
