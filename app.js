// ============================================
// NEBULA AI - Main Application
// ============================================

class NebulaApp {
  constructor() {
    this.currentProject = null;
    this.currentFile = null;
    this.messages = [];
    this.isStreaming = false;
    this.previewContent = '';
    
    this.init();
  }

  init() {
    this.cacheElements();
    this.bindEvents();
    this.loadProjects();
    this.autoResize();
  }

  cacheElements() {
    // Panels
    this.leftPanel = document.getElementById('leftPanel');
    this.rightPanel = document.getElementById('rightPanel');
    this.leftToggle = document.getElementById('leftToggle');
    this.rightToggle = document.getElementById('rightToggle');
    
    // Chat
    this.messagesContainer = document.getElementById('messagesContainer');
    this.messageInput = document.getElementById('messageInput');
    this.sendBtn = document.getElementById('sendBtn');
    this.modelSelect = document.getElementById('modelSelect');
    
    // Files
    this.projectSelect = document.getElementById('projectSelect');
    this.fileTree = document.getElementById('fileTree');
    
    // Preview
    this.previewFrame = document.getElementById('previewFrame');
    this.previewEmpty = document.getElementById('previewEmpty');
    this.previewContainer = document.getElementById('previewContainer');
    
    // Modals
    this.codeModal = document.getElementById('codeModal');
    this.projectModal = document.getElementById('projectModal');
  }

  bindEvents() {
    // Panel toggles
    this.leftToggle.addEventListener('click', () => this.togglePanel('left'));
    this.rightToggle.addEventListener('click', () => this.togglePanel('right'));
    document.getElementById('leftClose').addEventListener('click', () => this.togglePanel('left'));
    document.getElementById('rightClose').addEventListener('click', () => this.togglePanel('right'));

    // Chat
    this.sendBtn.addEventListener('click', () => this.sendMessage());
    this.messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    this.messageInput.addEventListener('input', () => this.autoResize());

    // Quick actions
    document.querySelectorAll('.quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.messageInput.value = btn.dataset.prompt;
        this.messageInput.focus();
      });
    });

    // Projects
    document.getElementById('newProjectBtn').addEventListener('click', () => {
      this.projectModal.classList.add('open');
    });
    document.getElementById('projectModalClose').addEventListener('click', () => {
      this.projectModal.classList.remove('open');
    });
    document.getElementById('createProjectBtn').addEventListener('click', () => this.createProject());
    this.projectSelect.addEventListener('change', () => this.loadProjectFiles());

    // Files
    document.getElementById('newFileBtn').addEventListener('click', () => this.createFile());
    document.getElementById('newFolderBtn').addEventListener('click', () => this.createFolder());

    // Preview
    document.getElementById('refreshPreview').addEventListener('click', () => this.refreshPreview());
    document.getElementById('openExternal').addEventListener('click', () => this.openPreviewExternal());
    document.querySelectorAll('.device-btn').forEach(btn => {
      btn.addEventListener('click', () => this.setPreviewDevice(btn));
    });

    // Code modal
    document.getElementById('codeModalClose').addEventListener('click', () => {
      this.codeModal.classList.remove('open');
    });
    document.getElementById('copyCodeBtn').addEventListener('click', () => this.copyCode());
    document.getElementById('previewCodeBtn').addEventListener('click', () => this.previewModalCode());

    // Close modals on backdrop click
    [this.codeModal, this.projectModal].forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('open');
      });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.codeModal.classList.remove('open');
        this.projectModal.classList.remove('open');
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        this.togglePanel('left');
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        this.togglePanel('right');
      }
    });
  }

  // ============================================
  // PANEL MANAGEMENT
  // ============================================

  togglePanel(side) {
    const panel = side === 'left' ? this.leftPanel : this.rightPanel;
    const toggle = side === 'left' ? this.leftToggle : this.rightToggle;
    
    panel.classList.toggle('open');
    toggle.classList.toggle('hidden', panel.classList.contains('open'));
  }

  // ============================================
  // CHAT FUNCTIONALITY
  // ============================================

  autoResize() {
    this.messageInput.style.height = 'auto';
    this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 150) + 'px';
  }

  async sendMessage() {
    const message = this.messageInput.value.trim();
    if (!message || this.isStreaming) return;

    // Clear input
    this.messageInput.value = '';
    this.autoResize();

    // Hide welcome message
    const welcome = this.messagesContainer.querySelector('.welcome-message');
    if (welcome) welcome.remove();

    // Add user message
    this.addMessage('user', message);

    // Add AI typing indicator
    const typingId = this.addTypingIndicator();

    // Get selected model
    const model = this.modelSelect.value;

    try {
      this.isStreaming = true;
      this.sendBtn.disabled = true;

      const response = await fetch(`${window.NEBULA_CONFIG.API_URL}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getToken()}`
        },
        body: JSON.stringify({
          message,
          model: model === 'auto' ? null : model,
          projectId: this.currentProject?.id
        })
      });

      // Remove typing indicator
      this.removeTypingIndicator(typingId);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to get response');
      }

      const data = await response.json();
      this.addMessage('assistant', data.response);

      // Check for code in response and update preview
      this.extractAndPreviewCode(data.response);

    } catch (error) {
      this.removeTypingIndicator(typingId);
      this.addMessage('assistant', `❌ Error: ${error.message}`);
    } finally {
      this.isStreaming = false;
      this.sendBtn.disabled = false;
    }
  }

  addMessage(role, content) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${role}`;
    
    const avatar = role === 'user' ? '👤' : '✨';
    const formattedContent = this.formatMessage(content);
    
    messageEl.innerHTML = `
      <div class="message-avatar">${avatar}</div>
      <div class="message-content">${formattedContent}</div>
    `;
    
    this.messagesContainer.appendChild(messageEl);
    this.scrollToBottom();
    
    // Add click handlers for code blocks
    messageEl.querySelectorAll('.code-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        const code = e.target.closest('pre').querySelector('code').textContent;
        const lang = e.target.dataset.lang || '';
        
        if (action === 'copy') {
          navigator.clipboard.writeText(code);
          e.target.textContent = '✓ Copied';
          setTimeout(() => e.target.textContent = 'Copy', 2000);
        } else if (action === 'preview') {
          this.updatePreview(code, lang);
          this.togglePanel('right');
          if (!this.rightPanel.classList.contains('open')) {
            this.togglePanel('right');
          }
        } else if (action === 'expand') {
          this.showCodeModal(code, lang);
        }
      });
    });
    
    this.messages.push({ role, content });
  }

  formatMessage(content) {
    // Escape HTML
    let formatted = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Format code blocks
    formatted = formatted.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
      const language = lang || 'code';
      const isPreviewable = ['html', 'css', 'javascript', 'js'].includes(lang.toLowerCase());
      return `
        <pre data-lang="${language}">
          <div class="code-actions">
            <button class="code-action-btn" data-action="copy" data-lang="${lang}">Copy</button>
            ${isPreviewable ? `<button class="code-action-btn" data-action="preview" data-lang="${lang}">Preview</button>` : ''}
            <button class="code-action-btn" data-action="expand" data-lang="${lang}">Expand</button>
          </div>
          <code>${code.trim()}</code>
        </pre>
      `;
    });
    
    // Format inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Format bold
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Format italic
    formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Format line breaks
    formatted = formatted.replace(/\n/g, '<br>');
    
    return formatted;
  }

  addTypingIndicator() {
    const id = 'typing-' + Date.now();
    const typingEl = document.createElement('div');
    typingEl.className = 'message assistant';
    typingEl.id = id;
    typingEl.innerHTML = `
      <div class="message-avatar">✨</div>
      <div class="message-content">
        <div class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
    this.messagesContainer.appendChild(typingEl);
    this.scrollToBottom();
    return id;
  }

  removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  scrollToBottom() {
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  // ============================================
  // PREVIEW FUNCTIONALITY
  // ============================================

  extractAndPreviewCode(response) {
    // Find HTML, CSS, or JS code blocks
    const htmlMatch = response.match(/```html\n?([\s\S]*?)```/i);
    const cssMatch = response.match(/```css\n?([\s\S]*?)```/i);
    const jsMatch = response.match(/```(?:javascript|js)\n?([\s\S]*?)```/i);
    
    if (htmlMatch || cssMatch || jsMatch) {
      let html = htmlMatch ? htmlMatch[1] : '';
      const css = cssMatch ? `<style>${cssMatch[1]}</style>` : '';
      const js = jsMatch ? `<script>${jsMatch[1]}</script>` : '';
      
      // If no HTML but has CSS/JS, create wrapper
      if (!html && (css || js)) {
        html = '<div id="app"></div>';
      }
      
      // Check if HTML is a full document
      if (!html.includes('<!DOCTYPE') && !html.includes('<html')) {
        html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            ${css}
          </head>
          <body>
            ${html}
            ${js}
          </body>
          </html>
        `;
      } else {
        // Insert CSS and JS into existing document
        if (css) html = html.replace('</head>', `${css}</head>`);
        if (js) html = html.replace('</body>', `${js}</body>`);
      }
      
      this.updatePreview(html, 'html');
    }
  }

  updatePreview(code, lang) {
    this.previewContent = code;
    
    if (lang === 'html' || code.includes('<!DOCTYPE') || code.includes('<html')) {
      this.previewFrame.srcdoc = code;
    } else if (lang === 'css') {
      this.previewFrame.srcdoc = `
        <!DOCTYPE html>
        <html>
        <head><style>${code}</style></head>
        <body><div class="preview-demo">CSS Preview</div></body>
        </html>
      `;
    } else if (lang === 'javascript' || lang === 'js') {
      this.previewFrame.srcdoc = `
        <!DOCTYPE html>
        <html>
        <head></head>
        <body>
          <div id="output"></div>
          <script>
            const output = document.getElementById('output');
            const log = console.log;
            console.log = (...args) => {
              output.innerHTML += args.join(' ') + '<br>';
              log(...args);
            };
            ${code}
          </script>
        </body>
        </html>
      `;
    }
    
    this.previewEmpty.classList.add('hidden');
    
    // Open preview panel if not open
    if (!this.rightPanel.classList.contains('open')) {
      this.togglePanel('right');
    }
  }

  refreshPreview() {
    if (this.previewContent) {
      this.previewFrame.srcdoc = this.previewContent;
    }
  }

  openPreviewExternal() {
    if (this.previewContent) {
      const blob = new Blob([this.previewContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    }
  }

  setPreviewDevice(btn) {
    document.querySelectorAll('.device-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    this.previewContainer.style.maxWidth = btn.dataset.width;
    this.previewContainer.style.margin = btn.dataset.width === '100%' ? '16px' : '16px auto';
  }

  // ============================================
  // CODE MODAL
  // ============================================

  showCodeModal(code, lang) {
    document.getElementById('codeModalTitle').textContent = lang || 'Code';
    document.getElementById('codeContent').querySelector('code').textContent = code;
    this.codeModal.dataset.code = code;
    this.codeModal.dataset.lang = lang;
    this.codeModal.classList.add('open');
  }

  copyCode() {
    const code = this.codeModal.dataset.code;
    navigator.clipboard.writeText(code);
    document.getElementById('copyCodeBtn').textContent = '✓ Copied!';
    setTimeout(() => {
      document.getElementById('copyCodeBtn').textContent = '📋 Copy';
    }, 2000);
  }

  previewModalCode() {
    const code = this.codeModal.dataset.code;
    const lang = this.codeModal.dataset.lang;
    this.updatePreview(code, lang);
    this.codeModal.classList.remove('open');
  }

  // ============================================
  // PROJECT & FILE MANAGEMENT
  // ============================================

  async loadProjects() {
    try {
      const response = await fetch(`${window.NEBULA_CONFIG.API_URL}/api/projects`, {
        headers: { 'Authorization': `Bearer ${this.getToken()}` }
      });
      
      if (response.ok) {
        const projects = await response.json();
        this.projectSelect.innerHTML = '<option value="">Select Project...</option>';
        projects.forEach(project => {
          const option = document.createElement('option');
          option.value = project.id;
          option.textContent = project.name;
          this.projectSelect.appendChild(option);
        });
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  }

  async createProject() {
    const name = document.getElementById('projectNameInput').value.trim();
    if (!name) return;
    
    try {
      const response = await fetch(`${window.NEBULA_CONFIG.API_URL}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getToken()}`
        },
        body: JSON.stringify({ name })
      });
      
      if (response.ok) {
        const project = await response.json();
        this.projectModal.classList.remove('open');
        document.getElementById('projectNameInput').value = '';
        await this.loadProjects();
        this.projectSelect.value = project.id;
        this.loadProjectFiles();
      }
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  }

  async loadProjectFiles() {
    const projectId = this.projectSelect.value;
    if (!projectId) {
      this.fileTree.innerHTML = '<div class="empty-state">No project selected</div>';
      this.currentProject = null;
      return;
    }
    
    try {
      const response = await fetch(`${window.NEBULA_CONFIG.API_URL}/api/projects/${projectId}/files`, {
        headers: { 'Authorization': `Bearer ${this.getToken()}` }
      });
      
      if (response.ok) {
        const files = await response.json();
        this.currentProject = { id: projectId };
        this.renderFileTree(files);
      }
    } catch (error) {
      console.error('Failed to load files:', error);
    }
  }

  renderFileTree(files) {
    if (!files || files.length === 0) {
      this.fileTree.innerHTML = '<div class="empty-state">No files yet</div>';
      return;
    }
    
    this.fileTree.innerHTML = files.map(file => `
      <div class="file-item" data-id="${file.id}" data-path="${file.path}">
        <span class="icon">${file.type === 'folder' ? '📁' : this.getFileIcon(file.name)}</span>
        <span class="name">${file.name}</span>
      </div>
    `).join('');
    
    this.fileTree.querySelectorAll('.file-item').forEach(item => {
      item.addEventListener('click', () => this.openFile(item.dataset.id));
    });
  }

  getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
      js: '📜', ts: '📘', jsx: '⚛️', tsx: '⚛️',
      html: '🌐', css: '🎨', scss: '🎨',
      json: '📋', md: '📝', txt: '📄',
      py: '🐍', rb: '💎', go: '🔷',
      jpg: '🖼️', png: '🖼️', svg: '🎭',
      default: '📄'
    };
    return icons[ext] || icons.default;
  }

  async openFile(fileId) {
    try {
      const response = await fetch(`${window.NEBULA_CONFIG.API_URL}/api/files/${fileId}`, {
        headers: { 'Authorization': `Bearer ${this.getToken()}` }
      });
      
      if (response.ok) {
        const file = await response.json();
        this.currentFile = file;
        
        // Highlight in tree
        this.fileTree.querySelectorAll('.file-item').forEach(item => {
          item.classList.toggle('active', item.dataset.id === fileId);
        });
        
        // If it's previewable, show in preview
        const ext = file.name.split('.').pop().toLowerCase();
        if (['html', 'htm'].includes(ext)) {
          this.updatePreview(file.content, 'html');
        }
      }
    } catch (error) {
      console.error('Failed to open file:', error);
    }
  }

  createFile() {
    const name = prompt('File name:');
    if (name && this.currentProject) {
      this.saveFile(name, '');
    }
  }

  createFolder() {
    const name = prompt('Folder name:');
    if (name && this.currentProject) {
      // TODO: Implement folder creation
      console.log('Create folder:', name);
    }
  }

  async saveFile(name, content) {
    try {
      const response = await fetch(`${window.NEBULA_CONFIG.API_URL}/api/projects/${this.currentProject.id}/files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getToken()}`
        },
        body: JSON.stringify({ name, content, path: '/' + name })
      });
      
      if (response.ok) {
        this.loadProjectFiles();
      }
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  }

  // ============================================
  // AUTH
  // ============================================

  getToken() {
    return localStorage.getItem('nebula_token') || 'guest';
  }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  window.app = new NebulaApp();
});
