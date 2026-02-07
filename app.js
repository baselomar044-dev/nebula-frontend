// AI App - Production Ready - Mobile Responsive
const API = 'https://nebula-api-production.up.railway.app';

// State
let files = {};
let currentFile = null;
let previewErrors = [];

// Mobile detection
const isMobile = () => window.innerWidth <= 768;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  updateModelOptions();
  setupMobileHandlers();
  autoResizeTextarea();
  
  // Create default file
  files['index.html'] = '<!DOCTYPE html>\n<html>\n<head>\n  <title>My App</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>Hello World!</h1>\n  <script src="app.js"></script>\n</body>\n</html>';
  files['style.css'] = 'body {\n  font-family: system-ui, sans-serif;\n  padding: 20px;\n  background: #f5f5f5;\n}\n\nh1 {\n  color: #333;\n}';
  files['app.js'] = '// Your JavaScript here\nconsole.log("Hello!");';
  renderFiles();
  updatePreview();
});

// Mobile handlers
function setupMobileHandlers() {
  const overlay = document.getElementById('panelOverlay');
  const filesPanel = document.getElementById('filesPanel');
  const previewPanel = document.getElementById('previewPanel');
  
  // Mobile buttons
  document.getElementById('mobileFilesBtn')?.addEventListener('click', () => {
    filesPanel.classList.add('open');
    overlay.classList.add('active');
  });
  
  document.getElementById('mobilePreviewBtn')?.addEventListener('click', () => {
    previewPanel.classList.add('open');
    overlay.classList.add('active');
  });
  
  document.getElementById('mobileSettingsBtn')?.addEventListener('click', openSettings);
  
  document.getElementById('closeFilesBtn')?.addEventListener('click', () => {
    filesPanel.classList.remove('open');
    overlay.classList.remove('active');
  });
  
  document.getElementById('closePreviewBtn')?.addEventListener('click', () => {
    previewPanel.classList.remove('open');
    overlay.classList.remove('active');
  });
  
  overlay?.addEventListener('click', () => {
    filesPanel.classList.remove('open');
    previewPanel.classList.remove('open');
    overlay.classList.remove('active');
  });
}

// Toggle functions
function toggleFiles() {
  const panel = document.getElementById('filesPanel');
  const overlay = document.getElementById('panelOverlay');
  panel.classList.toggle('open');
  if (isMobile()) overlay.classList.toggle('active', panel.classList.contains('open'));
}

function togglePreview() {
  const panel = document.getElementById('previewPanel');
  const overlay = document.getElementById('panelOverlay');
  panel.classList.toggle('open');
  if (isMobile()) overlay.classList.toggle('active', panel.classList.contains('open'));
}

function toggleTerminal() {
  document.getElementById('terminalPanel').classList.toggle('open');
}

function toggleExpandPreview() {
  document.getElementById('previewPanel').classList.toggle('expanded');
}

// Auto-resize textarea
function autoResizeTextarea() {
  const textarea = document.getElementById('userInput');
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
  });
}

// Models
const MODELS = {
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
  openai: ['gpt-4o', 'gpt-4o-mini'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  gemini: ['gemini-1.5-pro', 'gemini-1.5-flash']
};

function updateModelOptions() {
  const provider = document.getElementById('providerSelect').value;
  const modelSelect = document.getElementById('modelSelect');
  modelSelect.innerHTML = '<option value="auto">Auto-select</option>';
  
  if (provider !== 'auto' && MODELS[provider]) {
    MODELS[provider].forEach(m => {
      modelSelect.innerHTML += `<option value="${m}">${m}</option>`;
    });
  }
}

document.getElementById('providerSelect')?.addEventListener('change', updateModelOptions);

// Smart model selection
function selectSmartModel(message) {
  const len = message.length;
  const isComplex = /\b(build|create|full|complete|database|api|backend|deploy|complex)\b/i.test(message);
  const isSimple = /\b(fix|change|update|small|quick|simple|color|text)\b/i.test(message);
  
  if (isComplex || len > 500) {
    return { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' };
  } else if (isSimple || len < 100) {
    return { provider: 'groq', model: 'llama-3.3-70b-versatile' };
  }
  return { provider: 'anthropic', model: 'claude-3-haiku-20240307' };
}

// Send message
async function sendMessage() {
  const input = document.getElementById('userInput');
  const message = input.value.trim();
  if (!message) return;
  
  // Add user message
  addMessage(message, 'user');
  input.value = '';
  input.style.height = 'auto';
  
  // Get model
  let provider = document.getElementById('providerSelect').value;
  let model = document.getElementById('modelSelect').value;
  
  if (provider === 'auto' || model === 'auto' || document.getElementById('autoModel').checked) {
    const smart = selectSmartModel(message);
    provider = smart.provider;
    model = smart.model;
  }
  
  // Add thinking indicator
  const thinkingId = addMessage('<span class="thinking">Thinking...</span>', 'ai');
  
  try {
    // Use streaming
    const response = await fetch(`${API}/api/ai/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: message + '\n\nCurrent files:\n' + JSON.stringify(Object.keys(files)),
        provider,
        model
      })
    });
    
    // Remove thinking
    document.getElementById(thinkingId)?.remove();
    
    const msgId = addMessage('', 'ai');
    const msgEl = document.getElementById(msgId);
    const contentEl = msgEl.querySelector('.message-content') || msgEl;
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              fullText += parsed.content;
              contentEl.innerHTML = formatMessage(fullText);
            }
          } catch (e) {}
        }
      }
    }
    
    // Extract files from response
    extractFilesFromResponse(fullText);
    
  } catch (error) {
    document.getElementById(thinkingId)?.remove();
    addMessage('Error: ' + error.message, 'ai');
  }
}

// Format message with code blocks
function formatMessage(text) {
  // Code blocks
  text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="language-${lang}">${escapeHtml(code.trim())}</code></pre>`;
  });
  // Inline code
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Line breaks
  text = text.replace(/\n/g, '<br>');
  return text;
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Add message to chat
let msgCounter = 0;
function addMessage(content, type) {
  const container = document.getElementById('chatContainer');
  const id = 'msg-' + (++msgCounter);
  const div = document.createElement('div');
  div.className = 'message ' + type;
  div.id = id;
  div.innerHTML = `<div class="message-content">${type === 'ai' ? content : escapeHtml(content)}</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return id;
}

// Extract files from AI response
function extractFilesFromResponse(text) {
  const filePatterns = [
    /```(?:html|htm)\n([\s\S]*?)```/gi,
    /```css\n([\s\S]*?)```/gi,
    /```(?:javascript|js)\n([\s\S]*?)```/gi
  ];
  
  const fileNames = ['index.html', 'style.css', 'app.js'];
  
  filePatterns.forEach((pattern, i) => {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      let code = matches[0].replace(/```\w*\n/, '').replace(/```$/, '');
      files[fileNames[i]] = code.trim();
    }
  });
  
  renderFiles();
  updatePreview();
  showToast('Files extracted from response');
}

// File management
function renderFiles() {
  const list = document.getElementById('fileList');
  list.innerHTML = '';
  
  Object.keys(files).forEach(name => {
    const div = document.createElement('div');
    div.className = 'file-item' + (name === currentFile ? ' active' : '');
    div.innerHTML = `
      <span onclick="openFile('${name}')">${getFileIcon(name)} ${name}</span>
      <button onclick="deleteFile('${name}')" class="delete-btn">×</button>
    `;
    list.appendChild(div);
  });
}

function getFileIcon(name) {
  if (name.endsWith('.html')) return '📄';
  if (name.endsWith('.css')) return '🎨';
  if (name.endsWith('.js')) return '⚡';
  if (name.endsWith('.json')) return '📋';
  return '📄';
}

function openFile(name) {
  currentFile = name;
  renderFiles();
  switchTab(name.split('.').pop());
}

function createFile() {
  const name = prompt('File name:');
  if (name && !files[name]) {
    files[name] = '';
    currentFile = name;
    renderFiles();
  }
}

function deleteFile(name) {
  if (confirm(`Delete ${name}?`)) {
    delete files[name];
    if (currentFile === name) currentFile = null;
    renderFiles();
    updatePreview();
  }
}

// Preview
function updatePreview() {
  const html = files['index.html'] || '';
  const css = files['style.css'] || '';
  const js = files['app.js'] || '';
  
  const content = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>${css}</style>
    </head>
    <body>
      ${html.replace(/<link[^>]*style\.css[^>]*>/gi, '').replace(/<script[^>]*app\.js[^>]*><\/script>/gi, '')}
      <script>
        window.onerror = function(msg, url, line) {
          parent.postMessage({type: 'error', message: msg, line: line}, '*');
          return true;
        };
        try { ${js} } catch(e) { parent.postMessage({type: 'error', message: e.message}, '*'); }
      </script>
    </body>
    </html>
  `;
  
  const iframe = document.getElementById('previewFrame');
  iframe.srcdoc = content;
}

// Listen for preview errors
window.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'error') {
    previewErrors.push(e.data.message);
    document.getElementById('autoFixBanner').classList.add('show');
  }
});

// Auto-fix errors
async function autoFixErrors() {
  if (previewErrors.length === 0) return;
  
  showToast('Fixing errors...');
  
  try {
    const response = await fetch(`${API}/api/debug/fix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: files['app.js'] || '',
        error: previewErrors.join('\n'),
        language: 'javascript'
      })
    });
    
    const data = await response.json();
    if (data.fixed) {
      files['app.js'] = data.fixed;
      previewErrors = [];
      document.getElementById('autoFixBanner').classList.remove('show');
      renderFiles();
      updatePreview();
      showToast('Errors fixed!');
    }
  } catch (e) {
    showToast('Fix failed: ' + e.message);
  }
}

// Preview tabs
function switchTab(tab) {
  document.querySelectorAll('.preview-tabs button').forEach(b => b.classList.remove('active'));
  event?.target?.classList?.add('active');
  
  const content = document.getElementById('previewContent');
  const iframe = document.getElementById('previewFrame');
  
  if (tab === 'live') {
    content.innerHTML = '';
    content.appendChild(iframe);
    iframe.style.display = 'block';
    updatePreview();
  } else if (tab === 'console') {
    content.innerHTML = `<div class="code-view"><pre>${previewErrors.length ? previewErrors.join('\n') : 'No errors'}</pre></div>`;
  } else {
    const ext = tab === 'html' ? 'index.html' : tab === 'css' ? 'style.css' : 'app.js';
    const code = files[ext] || '';
    content.innerHTML = `<div class="code-view"><textarea class="code-editor" onchange="files['${ext}']=this.value;updatePreview();">${escapeHtml(code)}</textarea></div>`;
  }
}

// Terminal
async function handleTerminalKey(e) {
  if (e.key === 'Enter') {
    const input = document.getElementById('terminalInput');
    const cmd = input.value.trim();
    if (!cmd) return;
    
    const output = document.getElementById('terminalOutput');
    output.innerHTML += `<div class="cmd">$ ${escapeHtml(cmd)}</div>`;
    input.value = '';
    
    try {
      const response = await fetch(`${API}/api/execute/shell`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd })
      });
      const data = await response.json();
      output.innerHTML += `<div class="result">${escapeHtml(data.output || data.error || 'Done')}</div>`;
    } catch (e) {
      output.innerHTML += `<div class="error">${e.message}</div>`;
    }
    output.scrollTop = output.scrollHeight;
  }
}

// Database
async function executeSQL() {
  const query = document.getElementById('sqlQuery').value.trim();
  if (!query) return;
  
  const results = document.getElementById('dbResults');
  results.innerHTML = 'Running...';
  
  try {
    const response = await fetch(`${API}/api/db/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: query })
    });
    const data = await response.json();
    
    if (data.error) {
      results.innerHTML = `<div class="error">${data.error}</div>`;
    } else if (data.rows && data.rows.length > 0) {
      let html = '<table><tr>';
      Object.keys(data.rows[0]).forEach(k => html += `<th>${k}</th>`);
      html += '</tr>';
      data.rows.forEach(row => {
        html += '<tr>';
        Object.values(row).forEach(v => html += `<td>${v}</td>`);
        html += '</tr>';
      });
      html += '</table>';
      results.innerHTML = html;
    } else {
      results.innerHTML = '<div class="success">Query executed successfully</div>';
    }
  } catch (e) {
    results.innerHTML = `<div class="error">${e.message}</div>`;
  }
}

function openDbPanel() { document.getElementById('dbPanel').classList.add('open'); }
function closeDbPanel() { document.getElementById('dbPanel').classList.remove('open'); }

// Git
async function importFromGit() {
  const repo = document.getElementById('gitRepoUrl').value.trim();
  if (!repo) return;
  
  showToast('Importing from GitHub...');
  
  try {
    const response = await fetch(`${API}/api/git/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo })
    });
    const data = await response.json();
    
    if (data.files) {
      Object.assign(files, data.files);
      renderFiles();
      updatePreview();
      closeGitModal();
      showToast('Imported successfully!');
    } else {
      showToast('Import failed: ' + (data.error || 'Unknown error'));
    }
  } catch (e) {
    showToast('Import failed: ' + e.message);
  }
}

async function pushToGit() {
  const repo = document.getElementById('gitPushRepo').value.trim();
  const message = document.getElementById('gitCommitMsg').value.trim() || 'Update from AI App';
  const token = localStorage.getItem('githubToken');
  
  if (!repo) return showToast('Enter repository name');
  if (!token) return showToast('Set GitHub token in Settings first');
  
  showToast('Pushing to GitHub...');
  
  try {
    const response = await fetch(`${API}/api/git/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo, files, message, token })
    });
    const data = await response.json();
    
    if (data.success) {
      closeGitModal();
      showToast('Pushed successfully!');
    } else {
      showToast('Push failed: ' + (data.error || 'Unknown error'));
    }
  } catch (e) {
    showToast('Push failed: ' + e.message);
  }
}

function openGitModal() { document.getElementById('gitModal').classList.add('open'); }
function closeGitModal() { document.getElementById('gitModal').classList.remove('open'); }
function switchGitTab(tab) {
  document.querySelectorAll('.git-tabs button').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('gitImportTab').style.display = tab === 'import' ? 'block' : 'none';
  document.getElementById('gitPushTab').style.display = tab === 'push' ? 'block' : 'none';
}

// Settings
function openSettings() { document.getElementById('settingsModal').classList.add('open'); }
function closeSettings() { document.getElementById('settingsModal').classList.remove('open'); }

function saveSettings() {
  localStorage.setItem('githubToken', document.getElementById('githubToken').value);
  localStorage.setItem('netlifyToken', document.getElementById('netlifyToken').value);
  localStorage.setItem('defaultProvider', document.getElementById('defaultProvider').value);
  closeSettings();
  showToast('Settings saved!');
}

function loadSettings() {
  document.getElementById('githubToken').value = localStorage.getItem('githubToken') || '';
  document.getElementById('netlifyToken').value = localStorage.getItem('netlifyToken') || '';
  document.getElementById('defaultProvider').value = localStorage.getItem('defaultProvider') || 'auto';
}

// Import/Export
function importProject() { document.getElementById('importInput').click(); }

async function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  if (file.name.endsWith('.json')) {
    const text = await file.text();
    const data = JSON.parse(text);
    files = data.files || data;
    renderFiles();
    updatePreview();
    showToast('Project imported!');
  } else {
    showToast('Use JSON file for import');
  }
}

function exportProject() {
  const data = JSON.stringify({ files, exportedAt: new Date().toISOString() }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'project.json';
  a.click();
  showToast('Project exported!');
}

// Deploy
async function deployProject() {
  const token = localStorage.getItem('netlifyToken');
  if (!token) return showToast('Set Netlify token in Settings first');
  
  showToast('Deploying...');
  
  // For now, show instructions
  showToast('Deploy feature - use Export and upload to Netlify');
}

// Attach file
function attachFile() { document.getElementById('fileInput').click(); }

async function handleFileUpload(e) {
  for (const file of e.target.files) {
    const text = await file.text();
    files[file.name] = text;
  }
  renderFiles();
  updatePreview();
  showToast('Files attached!');
}

// Handle keyboard
function handleKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

// Toast notification
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}
