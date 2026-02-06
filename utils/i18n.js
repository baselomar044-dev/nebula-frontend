// ============================================
// NEBULA AI - Internationalization (EN/AR)
// ============================================

const I18N = {
  currentLang: 'en',
  
  translations: {
    en: {
      // General
      loading: 'Loading Nebula...',
      ready: 'Ready',
      save: 'Save',
      cancel: 'Cancel',
      create: 'Create',
      delete: 'Delete',
      close: 'Close',
      
      // Auth
      login: 'Login',
      logout: 'Logout',
      createAccount: 'Create account',
      authSubtitle: 'Your AI coding companion',
      loginToAccount: 'Login to your account',
      
      // Projects
      projects: 'Projects',
      newProject: 'New Project',
      noProject: 'No project',
      projectName: 'Project Name',
      description: 'Description',
      framework: 'Framework',
      importProject: 'Import Project',
      
      // Files
      files: 'Files',
      import: 'Import',
      export: 'Export',
      upload: 'Upload',
      newFile: 'New File',
      newFolder: 'New Folder',
      
      // Editor
      preview: 'Preview',
      livePreview: 'Live Preview',
      
      // Chat
      aiAssistant: 'AI Assistant',
      chatWelcome: "Hi! I'm Nebula AI. Tell me what you want to build or fix.",
      sendMessage: 'Send message',
      attachFile: 'Attach file',
      attachImage: 'Attach image',
      
      // Deploy
      deploy: 'Deploy',
      deployProject: 'Deploy Project',
      deploying: 'Deploying...',
      deploySuccess: 'Deployed successfully!',
      deployFailed: 'Deployment failed',
      viewSite: 'View Site',
      
      // Settings
      settings: 'Settings',
      apiKeys: 'API Keys',
      deployTokens: 'Deploy Tokens',
      preferences: 'Preferences',
      language: 'Language',
      theme: 'Theme',
      aiModel: 'Default AI Model',
      
      // Welcome
      welcomeTitle: 'Welcome to Nebula',
      welcomeText: 'Create a project or import one to get started',
      
      // Status
      saving: 'Saving...',
      saved: 'Saved',
      error: 'Error',
      connecting: 'Connecting...',
      processing: 'Processing...'
    },
    
    ar: {
      // General
      loading: 'جاري تحميل نيبولا...',
      ready: 'جاهز',
      save: 'حفظ',
      cancel: 'إلغاء',
      create: 'إنشاء',
      delete: 'حذف',
      close: 'إغلاق',
      
      // Auth
      login: 'تسجيل الدخول',
      logout: 'تسجيل الخروج',
      createAccount: 'إنشاء حساب',
      authSubtitle: 'مساعد البرمجة الذكي',
      loginToAccount: 'تسجيل الدخول إلى حسابك',
      
      // Projects
      projects: 'المشاريع',
      newProject: 'مشروع جديد',
      noProject: 'لا يوجد مشروع',
      projectName: 'اسم المشروع',
      description: 'الوصف',
      framework: 'الإطار',
      importProject: 'استيراد مشروع',
      
      // Files
      files: 'الملفات',
      import: 'استيراد',
      export: 'تصدير',
      upload: 'رفع',
      newFile: 'ملف جديد',
      newFolder: 'مجلد جديد',
      
      // Editor
      preview: 'معاينة',
      livePreview: 'معاينة مباشرة',
      
      // Chat
      aiAssistant: 'مساعد الذكاء الاصطناعي',
      chatWelcome: 'مرحباً! أنا نيبولا. أخبرني ماذا تريد بناءه أو إصلاحه.',
      sendMessage: 'إرسال رسالة',
      attachFile: 'إرفاق ملف',
      attachImage: 'إرفاق صورة',
      
      // Deploy
      deploy: 'نشر',
      deployProject: 'نشر المشروع',
      deploying: 'جاري النشر...',
      deploySuccess: 'تم النشر بنجاح!',
      deployFailed: 'فشل النشر',
      viewSite: 'عرض الموقع',
      
      // Settings
      settings: 'الإعدادات',
      apiKeys: 'مفاتيح API',
      deployTokens: 'رموز النشر',
      preferences: 'التفضيلات',
      language: 'اللغة',
      theme: 'المظهر',
      aiModel: 'نموذج الذكاء الافتراضي',
      
      // Welcome
      welcomeTitle: 'مرحباً بك في نيبولا',
      welcomeText: 'أنشئ مشروعاً أو استورد واحداً للبدء',
      
      // Status
      saving: 'جاري الحفظ...',
      saved: 'تم الحفظ',
      error: 'خطأ',
      connecting: 'جاري الاتصال...',
      processing: 'جاري المعالجة...'
    }
  },
  
  init() {
    const saved = localStorage.getItem('nebula_lang');
    if (saved && this.translations[saved]) {
      this.currentLang = saved;
    }
    this.applyLanguage();
  },
  
  setLanguage(lang) {
    if (!this.translations[lang]) return;
    this.currentLang = lang;
    localStorage.setItem('nebula_lang', lang);
    this.applyLanguage();
  },
  
  toggleLanguage() {
    this.setLanguage(this.currentLang === 'en' ? 'ar' : 'en');
  },
  
  applyLanguage() {
    // Set direction
    document.documentElement.lang = this.currentLang;
    document.documentElement.dir = this.currentLang === 'ar' ? 'rtl' : 'ltr';
    
    // Translate all elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (this.translations[this.currentLang][key]) {
        el.textContent = this.translations[this.currentLang][key];
      }
    });
    
    // Update placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (this.translations[this.currentLang][key]) {
        el.placeholder = this.translations[this.currentLang][key];
      }
    });
  },
  
  t(key) {
    return this.translations[this.currentLang][key] || key;
  }
};

// Auto-init if DOM is ready
if (document.readyState !== 'loading') {
  I18N.init();
} else {
  document.addEventListener('DOMContentLoaded', () => I18N.init());
}
