// ============================================
// NEBULA AI - Main Application
// ============================================

class NebulaApp {
  constructor() {
    this.user = null;
    this.currentProject = null;
    this.currentFile = null;
    this.projects = [];
    this.files = [];
    this.conversations = [];
    this.currentConversation = null;
    this.attachments = [];
    this.ws = null;
    
    this.init();
  }
  
  async init() {
    // Initialize i18n
    I18N.init();
    
    // Check auth
    API.loadToken();
    if (API.token) {
      try {
        const { user } = await API.getMe();
        this.user = user;
        this.showMainApp();
        await this.loadProjects();
      } catch (e) {
        API.setToken(null);
        this.showAuth();
      }
    } else {
      this.showAuth();
    }
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Hide loading
    document.getElementById('loading').classList.add('hidden');
  }
  
  setupEventListeners() {
    // Auth
    document.getElementById('auth-form').addEventListener('submit', (e) => this.handleAuth(e));
    document.getElementById('auth-toggle').addEventListener('click', () => this.toggleAuthMode());
    document.getElementById('auth-lang-toggle').addEventListener('click', () => I18N.toggleLanguage());
    document.getElementById('auth-theme-toggle').addEventListener('click', () => this.toggleTheme());
    
    // Header
    document.getElementById('sidebar-toggle').addEventListener('click', () => this.toggleSidebar());
    document.getElementById('lang-toggle').addEventListener('click', () => I18N.toggleLanguage());
    document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());
    document.getElementById('settings-btn').addEventListener('click', () => this.openModal('settings-modal'));
    
    // Projects
    document.getElementById('new-project-btn').addEventListener('click', () => this.openModal('new-project-modal'));
    document.getElementById('welcome-new-project').addEventListener('click', () => this.openModal('new-project-modal'));
    document.getElementById('welcome-import').addEventListener('click', () => document.getElementById('import-input').click());
    document.getElementById('create-project').addEventListener('click', () => this.createProject());
    
    // Files
    document.getElementById('import-btn').addEventListener('click', () => document.getElementById('import-input').click());
    document.getElementById('export-btn').addEventListener('click', () => this.exportProject());
    document.getElementById('upload-btn').addEventListener('click', () => document.getElementById('upload-input').click());
    document.getElementById('import-input').addEventListener('change', (e) => this.importProject(e));
    document.getElementById('upload-input').addEventListener('change', (e) => this.uploadFiles(e));
    
    // Preview
    document.getElementById('preview-toggle').addEventListener('click', () => this.togglePreview());
    document.getElementById('preview-refresh').addEventListener('click', () => this.refreshPreview());
    document.getElementById('preview-close').addEventListener('click', () => this.togglePreview());
    
    // Chat
    document.getElementById('chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    document.getElementById('send-btn').addEventListener('click', () => this.sendMessage());
    document.getElementById('attach-file-btn').addEventListener('click', () => this.attachFile());
    document.getElementById('attach-image-btn').addEventListener('click', () => document.getElementById('image-input').click());
    document.getElementById('image-input').addEventListener('change', (e) => this.attachImage(e));
    
    // Deploy
    document.getElementById('deploy-btn').addEventListener('click', () => this.openModal('deploy-modal'));
    document.querySelectorAll('.deploy-option').forEach(btn => {
      btn.addEventListener('click', () => this.deploy(btn.dataset.platform));
    });
    
    // Settings
    document.getElementById('save-settings').addEventListener('click', () => this.saveSettings());
    document.querySelectorAll('.settings-tabs .tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchSettingsTab(tab.dataset.tab));
    });
    
    // Modals
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => this.closeModals());
    });
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeModals();
      });
    });
    
    // Editor
    document.getElementById('code-editor').addEventListener('input', () => this.handleEditorChange());
    
    // Auto-resize chat input
    const chatInput = document.getElementById('chat-input');
    chatInput.addEventListener('input', () => {
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
    });
  }
  
  // ============ AUTH ============
  showAuth() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('main-app').classList.add('hidden');
  }
  
  showMainApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    this.connectWebSocket();
  }
  
  isRegistering = false;
  
  toggleAuthMode() {
    this.isRegistering = !this.isRegistering;
    document.getElementById('auth-name-group').classList.toggle('hidden', !this.isRegistering);
    document.getElementById('auth-submit').querySelector('span').textContent = 
      I18N.t(this.isRegistering ? 'createAccount' : 'login');
    document.getElementById('auth-toggle').querySelector('span').textContent = 
      I18N.t(this.isRegistering ? 'login' : 'createAccount');
  }
  
  async handleAuth(e) {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const name = document.getElementById('auth-name').value;
    
    try {
      this.setStatus('loading', I18N.t('connecting'));
      
      let result;
      if (this.isRegistering) {
        result = await API.register(email, password, name);
      } else {
        result = await API.login(email, password);
      }
      
      API.setToken(result.token);
      this.user = result.user;
      this.showMainApp();
      await this.loadProjects();
      this.setStatus('success', I18N.t('ready'));
    } catch (error) {
      this.setStatus('error', error.message);
      alert(error.message);
    }
  }
  
  // ============ PROJECTS ============
  async loadProjects() {
    try {
      const { projects } = await API.getProjects();
      this.projects = projects;
      this.renderProjects();
      
      if (projects.length > 0) {
        await this.selectProject(projects[0].id);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  }
  
  renderProjects() {
    const list = document.getElementById('project-list');
    list.innerHTML = this.projects.map(p => `
      <div class="project-item ${p.id === this.currentProject?.id ? 'active' : ''}" data-id="${p.id}">
        <span>📁</span>
        <span>${p.name}</span>
      </div>
    `).join('');
    
    list.querySelectorAll('.project-item').forEach(item => {
      item.addEventListener('click', () => this.selectProject(item.dataset.id));
    });
  }
  
  async selectProject(id) {
    try {
      const { project, files } = await API.getProject(id);
      this.currentProject = project;
      this.files = files;
      
      document.getElementById('current-project-name').textContent = project.name;
      document.getElementById('welcome-state').classList.add('hidden');
      document.getElementById('editor-area').classList.remove('hidden');
      
      this.renderProjects();
      this.renderFileTree();
      
      // Auto-select first file
      const firstFile = files.find(f => !f.is_directory);
      if (firstFile) {
        await this.selectFile(firstFile.id);
      }
    } catch (error) {
      console.error('Failed to select project:', error);
    }
  }
  
  async createProject() {
    const name = document.getElementById('new-project-name').value;
    const description = document.getElementById('new-project-desc').value;
    const framework = document.getElementById('new-project-framework').value;
    
    if (!name) return;
    
    try {
      const { project } = await API.createProject({ name, description, framework });
      this.projects.unshift(project);
      this.renderProjects();
      await this.selectProject(project.id);
      this.closeModals();
      
      // Clear form
      document.getElementById('new-project-name').value = '';
      document.getElementById('new-project-desc').value = '';
    } catch (error) {
      alert(error.message);
    }
  }
  
  async importProject(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      this.setStatus('loading', I18N.t('processing'));
      const name = file.name.replace('.zip', '');
      const { project, files } = await API.importProject(file, name);
      
      this.projects.unshift(project);
      this.currentProject = project;
      this.files = files;
      
      this.renderProjects();
      this.renderFileTree();
      
      document.getElementById('welcome-state').classList.add('hidden');
      document.getElementById('editor-area').classList.remove('hidden');
      document.getElementById('current-project-name').textContent = project.name;
      
      this.setStatus('success', I18N.t('ready'));
    } catch (error) {
      this.setStatus('error', error.message);
      alert(error.message);
    }
    
    e.target.value = '';
  }
  
  exportProject() {
    if (!this.currentProject) return;
    window.open(API.getExportUrl(this.currentProject.id), '_blank');
  }
  
  // ============ FILES ============
  renderFileTree() {
    const tree = document.getElementById('file-tree');
    const buildTree = (files, parentPath = '') => {
      return files
        .filter(f => {
          const dir = f.path.substring(0, f.path.lastIndexOf('/')) || '/';
          return dir === parentPath || (parentPath === '' && dir === '/');
        })
        .map(f => {
          const isDir = f.is_directory;
          const depth = (f.path.match(/\//g) || []).length - 1;
          const children = isDir ? buildTree(files, f.path) : '';
          
          return `
            <div class="file-tree-item ${f.id === this.currentFile?.id ? 'active' : ''}" 
                 data-id="${f.id}" 
                 data-path="${f.path}"
                 style="--depth: ${depth}">
              <span>${isDir ? '📁' : this.getFileIcon(f.name)}</span>
              <span>${f.name}</span>
            </div>
            ${children}
          `;
        }).join('');
    };
    
    tree.innerHTML = buildTree(this.files);
    
    tree.querySelectorAll('.file-tree-item').forEach(item => {
      item.addEventListener('click', () => {
        const file = this.files.find(f => f.id === item.dataset.id);
        if (file && !file.is_directory) {
          this.selectFile(file.id);
        }
      });
    });
  }
  
  getFileIcon(name) {
    const ext = name.split('.').pop().toLowerCase();
    const icons = {
      js: '📜', ts: '📘', jsx: '⚛️', tsx: '⚛️',
      html: '🌐', css: '🎨', scss: '🎨',
      json: '📋', md: '📝', txt: '📄',
      png: '🖼️', jpg: '🖼️', svg: '🎭',
      py: '🐍', rb: '💎', go: '🔵',
    };
    return icons[ext] || '📄';
  }
  
  async selectFile(id) {
    try {
      const { file } = await API.getFile(this.currentProject.id, id);
      this.currentFile = file;
      
      document.getElementById('code-editor').value = file.content || '';
      this.renderFileTree();
      this.updateEditorTabs();
    } catch (error) {
      console.error('Failed to select file:', error);
    }
  }
  
  updateEditorTabs() {
    const tabs = document.getElementById('editor-tabs');
    if (!this.currentFile) {
      tabs.innerHTML = '';
      return;
    }
    
    tabs.innerHTML = `
      <div class="editor-tab active">
        <span>${this.getFileIcon(this.currentFile.name)}</span>
        <span>${this.currentFile.name}</span>
        <span class="close">×</span>
      </div>
    `;
  }
  
  async uploadFiles(e) {
    const files = Array.from(e.target.files);
    if (!files.length || !this.currentProject) return;
    
    try {
      this.setStatus('loading', I18N.t('processing'));
      
      for (const file of files) {
        await API.uploadFile(this.currentProject.id, file);
      }
      
      // Reload project files
      const { files: newFiles } = await API.getProject(this.currentProject.id);
      this.files = newFiles;
      this.renderFileTree();
      
      this.setStatus('success', I18N.t('ready'));
    } catch (error) {
      this.setStatus('error', error.message);
    }
    
    e.target.value = '';
  }
  
  handleEditorChange() {
    // Auto-save after 1 second of no typing
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => this.saveCurrentFile(), 1000);
  }
  
  async saveCurrentFile() {
    if (!this.currentFile || !this.currentProject) return;
    
    const content = document.getElementById('code-editor').value;
    
    try {
      await API.saveFile(this.currentProject.id, this.currentFile.path, content);
      this.setStatus('success', I18N.t('saved'));
    } catch (error) {
      this.setStatus('error', I18N.t('error'));
    }
  }
  
  // ============ PREVIEW ============
  togglePreview() {
    const preview = document.getElementById('preview-area');
    preview.classList.toggle('hidden');
    if (!preview.classList.contains('hidden')) {
      this.refreshPreview();
    }
  }
  
  refreshPreview() {
    if (!this.currentProject) return;
    
    const iframe = document.getElementById('preview-frame');
    const html = this.files.find(f => f.name === 'index.html');
    
    if (html) {
      // Build preview with inline styles and scripts
      let content = html.content || '';
      
      // Inject CSS
      const css = this.files.find(f => f.name.endsWith('.css'));
      if (css) {
        content = content.replace('</head>', `<style>${css.content}</style></head>`);
      }
      
      // Inject JS
      const js = this.files.find(f => f.name.endsWith('.js') && f.name !== 'sw.js');
      if (js) {
        content = content.replace('</body>', `<script>${js.content}</script></body>`);
      }
      
      iframe.srcdoc = content;
    }
  }
  
  // ============ CHAT / AI ============
  async sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (!message || !this.currentProject) return;
    
    // Add user message to UI
    this.addChatMessage('user', message);
    input.value = '';
    input.style.height = 'auto';
    
    try {
      this.setStatus('loading', I18N.t('processing'));
      
      const result = await API.chat(
        this.currentProject.id,
        message,
        this.attachments.map(a => a.path),
        'auto'
      );
      
      // Add AI response
      this.addChatMessage('assistant', result.message.content);
      
      // Auto-apply code changes
      if (result.codeBlocks && result.codeBlocks.length > 0) {
        for (const block of result.codeBlocks) {
          if (block.path) {
            await API.saveFile(this.currentProject.id, block.path, block.code);
          }
        }
        
        // Reload files
        const { files } = await API.getProject(this.currentProject.id);
        this.files = files;
        this.renderFileTree();
        this.refreshPreview();
      }
      
      // Update usage
      document.getElementById('usage-info').textContent = `$${result.cost}`;
      
      this.setStatus('success', I18N.t('ready'));
      this.clearAttachments();
    } catch (error) {
      this.addChatMessage('assistant', `Error: ${error.message}`);
      this.setStatus('error', error.message);
    }
  }
  
  addChatMessage(role, content) {
    const messages = document.getElementById('chat-messages');
    
    // Remove welcome message
    const welcome = messages.querySelector('.chat-welcome');
    if (welcome) welcome.remove();
    
    // Format code blocks
    const formatted = content.replace(/```(\w+)?(?::([^\n]+))?\n([\s\S]*?)```/g, 
      (match, lang, path, code) => {
        return `<pre><code class="language-${lang || 'text'}">${this.escapeHtml(code)}</code></pre>`;
      }
    );
    
    const div = document.createElement('div');
    div.className = `chat-message ${role}`;
    div.innerHTML = formatted;
    
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  attachFile() {
    const files = this.files.filter(f => !f.is_directory);
    const menu = files.map(f => `<div class="attach-option" data-path="${f.path}">${f.name}</div>`).join('');
    // Show picker - simplified for now
    const path = prompt('Enter file path to attach:');
    if (path) {
      this.attachments.push({ path, name: path.split('/').pop() });
      this.renderAttachments();
    }
  }
  
  attachImage(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Upload and attach
    // For now, just note it
    this.attachments.push({ name: file.name, type: 'image', file });
    this.renderAttachments();
    e.target.value = '';
  }
  
  renderAttachments() {
    const container = document.getElementById('chat-attachments');
    container.innerHTML = this.attachments.map((a, i) => `
      <div class="chat-attachment">
        <span>${a.name}</span>
        <button onclick="app.removeAttachment(${i})">×</button>
      </div>
    `).join('');
  }
  
  removeAttachment(index) {
    this.attachments.splice(index, 1);
    this.renderAttachments();
  }
  
  clearAttachments() {
    this.attachments = [];
    this.renderAttachments();
  }
  
  // ============ DEPLOY ============
  async deploy(platform) {
    if (!this.currentProject) return;
    
    const statusDiv = document.getElementById('deploy-status');
    const messageEl = document.getElementById('deploy-message');
    const urlEl = document.getElementById('deploy-url');
    
    statusDiv.classList.remove('hidden');
    urlEl.classList.add('hidden');
    messageEl.textContent = I18N.t('deploying');
    
    try {
      const result = await API.deploy(this.currentProject.id, platform);
      
      if (result.success && result.url) {
        messageEl.textContent = I18N.t('deploySuccess');
        urlEl.href = result.url;
        urlEl.textContent = result.url;
        urlEl.classList.remove('hidden');
      } else {
        throw new Error('No URL returned');
      }
    } catch (error) {
      messageEl.textContent = `${I18N.t('deployFailed')}: ${error.message}`;
    }
  }
  
  // ============ SETTINGS ============
  openModal(id) {
    document.getElementById(id).classList.remove('hidden');
  }
  
  closeModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  }
  
  switchSettingsTab(tab) {
    document.querySelectorAll('.settings-tabs .tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    document.querySelectorAll('.settings-content').forEach(c => {
      c.classList.add('hidden');
    });
    document.getElementById(`settings-${tab}`).classList.remove('hidden');
  }
  
  async saveSettings() {
    // Save API keys
    const providers = ['anthropic', 'openai', 'google', 'groq', 'deepseek'];
    for (const provider of providers) {
      const key = document.getElementById(`key-${provider}`).value;
      if (key) {
        await API.saveApiKey(provider, key);
      }
    }
    
    // Save deploy tokens
    const tokens = ['vercel', 'netlify', 'railway'];
    for (const token of tokens) {
      const value = document.getElementById(`token-${token}`).value;
      if (value) {
        await API.saveApiKey(token, value);
      }
    }
    
    // Save preferences
    const lang = document.getElementById('pref-language').value;
    const theme = document.getElementById('pref-theme').value;
    
    I18N.setLanguage(lang);
    this.setTheme(theme);
    
    await API.updateProfile({ language: lang, theme });
    
    this.closeModals();
    this.setStatus('success', I18N.t('saved'));
  }
  
  // ============ THEME ============
  toggleTheme() {
    const current = document.body.classList.contains('theme-dark') ? 'dark' : 'light';
    this.setTheme(current === 'dark' ? 'light' : 'dark');
  }
  
  setTheme(theme) {
    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(`theme-${theme}`);
    localStorage.setItem('nebula_theme', theme);
    
    const themeColor = theme === 'dark' ? '#0a0a1a' : '#f5f0e8';
    document.querySelector('meta[name="theme-color"]').setAttribute('content', themeColor);
  }
  
  // ============ UI HELPERS ============
  toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
  }
  
  setStatus(type, text) {
    const indicator = document.getElementById('status-indicator');
    const textEl = document.getElementById('status-text');
    
    indicator.className = 'status-indicator';
    if (type === 'loading') indicator.classList.add('loading');
    if (type === 'error') indicator.classList.add('error');
    
    textEl.textContent = text;
  }
  
  // ============ WEBSOCKET ============
  connectWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${protocol}//${location.host}/ws`);
    
    this.ws.onopen = () => {
      if (this.currentProject) {
        this.ws.send(JSON.stringify({ type: 'subscribe', projectId: this.currentProject.id }));
      }
    };
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // Handle real-time updates
      if (data.type === 'file-updated') {
        this.renderFileTree();
      }
    };
    
    this.ws.onclose = () => {
      setTimeout(() => this.connectWebSocket(), 3000);
    };
  }
}

// Initialize app
const app = new NebulaApp();
