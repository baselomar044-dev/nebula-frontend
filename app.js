// AI App - Full Featured Production Ready
const API = 'https://nebula-api-production.up.railway.app';

// State
let files = {};
let currentFile = null;
let currentTab = 'live';
let consoleLogs = [];
let isStreaming = false;

// Models config
const MODELS = {
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
  openai: ['gpt-4o', 'gpt-4o-mini'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  gemini: ['gemini-1.5-pro', 'gemini-1.5-flash']
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  updateModelOptions();
  
  // Default files
  files['index.html'] = `<!DOCTYPE html>
<html>
<head>
  <title>My App</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <h1>Hello World!</h1>
  <p>Start chatting to build something amazing.</p>
  <script src="app.js"><\/script>
</body>
</html>`;
  files['style.css'] = `body {
  font-family: system-ui, sans-serif;
  padding: 40px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
}

h1 {
  font-size: 3rem;
  margin-bottom: 10px;
}

p {
  opacity: 0.8;
}`;
  files['app.js'] = `// Your JavaScript here
console.log("App loaded!");`;

  renderFiles();
  updatePreview();
  
  // Auto-resize textarea
  const input = document.getElementById('userInput');
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 150) + 'px';
  });
});

// ==================== FILES ====================
function renderFiles() {
  const list = document.getElementById('filesList');
  list.innerHTML = '';
  
  Object.keys(files).sort().forEach(name => {
    const div = document.createElement('div');
    div.className = 'file-item' + (name === currentFile ? ' active' : '');
    div.innerHTML = `
      <span onclick="selectFile('${name}')">${getFileIcon(name)} ${name}</span>
      <button class="delete-btn" onclick="deleteFile('${name}', event)">✕</button>
    `;
    list.appendChild(div);
  });
}

function getFileIcon(name) {
  const ext = name.split('.').pop();
  const icons = { html: '📄', css: '🎨', js: '⚡', json: '📋', md: '📝' };
  return icons[ext] || '📄';
}

function selectFile(name) {
  currentFile = name;
  renderFiles();
  
  // Show in code view
  const ext = name.split('.').pop();
  if (['html', 'css', 'js', 'json', 'md'].includes(ext)) {
    setPreviewTab(ext === 'html' ? 'html' : ext === 'css' ? 'css' : ext === 'js' ? 'js' : 'html');
  }
}

function createFile() {
  const name = prompt('File name (e.g., component.js):');
  if (name && !files[name]) {
    files[name] = '';
    currentFile = name;
    renderFiles();
    updatePreview();
  }
}

function deleteFile(name, e) {
  e.stopPropagation();
  if (confirm(`Delete ${name}?`)) {
    delete files[name];
    if (currentFile === name) currentFile = Object.keys(files)[0] || null;
    renderFiles();
    updatePreview();
  }
}

// ==================== PREVIEW ====================
function updatePreview() {
  const html = files['index.html'] || '<html><body><p>No index.html</p></body></html>';
  const css = files['style.css'] || '';
  const js = files['app.js'] || '';
  
  const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${css}</style>
</head>
<body>
${html.replace(/<html.*?>|<\/html>|<head>.*?<\/head>|<body.*?>|<\/body>|<!DOCTYPE.*?>/gis, '')}
<script>
  // Capture console
  const originalConsole = { log: console.log, error: console.error, warn: console.warn };
  ['log', 'error', 'warn'].forEach(method => {
    console[method] = (...args) => {
      parent.postMessage({ type: 'console', method, args: args.map(a => String(a)) }, '*');
      originalConsole[method](...args);
    };
  });
  
  // Capture errors
  window.onerror = (msg, url, line, col, error) => {
    parent.postMessage({ type: 'error', message: msg, line, col }, '*');
  };
<\/script>
<script>${js}<\/script>
</body>
</html>`;

  const frame = document.getElementById('previewFrame');
  frame.srcdoc = fullHtml;
}

function refreshPreview() {
  consoleLogs = [];
  updateConsoleView();
  updatePreview();
}

function setPreviewTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.preview-tabs .tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.preview-tabs .tab:nth-child(${['live','html','css','js','console'].indexOf(tab)+1})`).classList.add('active');
  
  const frame = document.getElementById('previewFrame');
  const code = document.getElementById('codeView');
  const cons = document.getElementById('consoleView');
  
  frame.classList.add('hidden');
  code.classList.add('hidden');
  cons.classList.add('hidden');
  
  if (tab === 'live') {
    frame.classList.remove('hidden');
  } else if (tab === 'console') {
    cons.classList.remove('hidden');
    updateConsoleView();
  } else {
    code.classList.remove('hidden');
    const fileMap = { html: 'index.html', css: 'style.css', js: 'app.js' };
    code.textContent = files[fileMap[tab]] || `// No ${fileMap[tab]} file`;
  }
}

function updateConsoleView() {
  const cons = document.getElementById('consoleView');
  cons.innerHTML = consoleLogs.length ? 
    consoleLogs.map(l => `<div class="console-${l.type}">[${l.type}] ${l.msg}</div>`).join('') :
    '<div style="color: var(--text2)">Console output will appear here...</div>';
}

// Listen for console messages from iframe
window.addEventListener('message', e => {
  if (e.data.type === 'console') {
    consoleLogs.push({ type: e.data.method, msg: e.data.args.join(' ') });
    if (currentTab === 'console') updateConsoleView();
  } else if (e.data.type === 'error') {
    consoleLogs.push({ type: 'error', msg: `Line ${e.data.line}: ${e.data.message}` });
    if (currentTab === 'console') updateConsoleView();
    showErrorBanner(e.data.message);
  }
});

function showErrorBanner(error) {
  // Remove existing
  document.querySelectorAll('.error-banner').forEach(b => b.remove());
  
  const banner = document.createElement('div');
  banner.className = 'error-banner';
  banner.innerHTML = `
    <span>⚠️ Error: ${error.substring(0, 50)}...</span>
    <button onclick="autoFixError('${error.replace(/'/g, "\\'")}')">Auto Fix</button>
  `;
  document.querySelector('.preview-content').prepend(banner);
}

async function autoFixError(error) {
  addMessage('user', `Fix this error: ${error}`);
  
  try {
    const res = await fetch(`${API}/api/debug/fix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: error,
        code: files['app.js'] || '',
        language: 'javascript'
      })
    });
    
    const data = await res.json();
    if (data.fix) {
      addMessage('ai', `Here's the fix:\n\n\`\`\`javascript\n${data.fix}\n\`\`\`\n\n${data.explanation || ''}`);
      files['app.js'] = data.fix;
      updatePreview();
      renderFiles();
      document.querySelectorAll('.error-banner').forEach(b => b.remove());
    }
  } catch (err) {
    addMessage('ai', 'Could not auto-fix. Please describe the issue.');
  }
}

function toggleExpandPreview() {
  document.getElementById('previewPanel').classList.toggle('expanded');
}

// ==================== CHAT ====================
function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

async function sendMessage() {
  const input = document.getElementById('userInput');
  const message = input.value.trim();
  if (!message || isStreaming) return;
  
  input.value = '';
  input.style.height = 'auto';
  
  // Remove welcome message
  document.querySelector('.welcome-msg')?.remove();
  
  addMessage('user', message);
  
  const aiMsg = addMessage('ai', '<div class="typing-indicator"><span></span><span></span><span></span></div>');
  
  isStreaming = true;
  document.getElementById('sendBtn').disabled = true;
  
  try {
    // Determine model
    const auto = document.getElementById('autoModel').checked;
    let provider = document.getElementById('providerSelect').value;
    let model = document.getElementById('modelSelect').value;
    
    if (auto) {
      const selected = selectBestModel(message);
      provider = selected.provider;
      model = selected.model;
    }
    
    // Try streaming first
    const response = await fetch(`${API}/api/ai/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: buildPrompt(message),
        provider,
        model
      })
    });
    
    if (!response.ok) throw new Error('Stream failed');
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    
    aiMsg.innerHTML = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') break;
          
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              fullResponse += parsed.content;
              aiMsg.innerHTML = formatMessage(fullResponse);
            }
          } catch {}
        }
      }
    }
    
    // Extract files from response
    extractFiles(fullResponse);
    
  } catch (err) {
    // Fallback to non-streaming
    try {
      const res = await fetch(`${API}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: buildPrompt(message),
          provider: document.getElementById('providerSelect').value,
          model: document.getElementById('modelSelect').value
        })
      });
      
      const data = await res.json();
      aiMsg.innerHTML = formatMessage(data.response || data.error || 'No response');
      extractFiles(data.response || '');
    } catch (e) {
      aiMsg.innerHTML = `<span style="color: var(--error)">Error: ${e.message}</span>`;
    }
  }
  
  isStreaming = false;
  document.getElementById('sendBtn').disabled = false;
  
  // Scroll to bottom
  const chatBox = document.getElementById('chatMessages');
  chatBox.scrollTop = chatBox.scrollHeight;
}

function buildPrompt(message) {
  const context = Object.entries(files).map(([name, content]) => 
    `--- ${name} ---\n${content}`
  ).join('\n\n');
  
  return `You are an expert coding assistant. Help the user build their project.

Current project files:
${context}

User request: ${message}

IMPORTANT: When providing code, use markdown code blocks with the filename like:
\`\`\`html:index.html
code here
\`\`\`

Always provide complete, working code.`;
}

function selectBestModel(message) {
  const complex = message.length > 200 || 
    /complex|difficult|advanced|algorithm|architecture|design|refactor|optimize/i.test(message);
  
  const simple = message.length < 50 && 
    /fix|change|update|add|remove|simple|quick|small/i.test(message);
  
  if (complex) {
    return { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' };
  } else if (simple) {
    return { provider: 'groq', model: 'llama-3.1-8b-instant' };
  } else {
    return { provider: 'groq', model: 'llama-3.3-70b-versatile' };
  }
}

function addMessage(role, content) {
  const chatBox = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.innerHTML = role === 'user' ? escapeHtml(content) : formatMessage(content);
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
  return div;
}

function formatMessage(text) {
  // Convert markdown code blocks
  let html = text.replace(/```(\w+)?(?::([^\n]+))?\n([\s\S]*?)```/g, (_, lang, filename, code) => {
    const header = filename ? `<div style="background:var(--bg);padding:5px 10px;font-size:12px;border-radius:6px 6px 0 0;">${filename}</div>` : '';
    return `${header}<pre style="margin-top:0;border-radius:${filename ? '0 0 6px 6px' : '6px'};"><code>${escapeHtml(code)}</code></pre>`;
  });
  
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code style="background:var(--bg);padding:2px 6px;border-radius:4px;">$1</code>');
  
  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Line breaks
  html = html.replace(/\n/g, '<br>');
  
  return html;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function extractFiles(response) {
  const regex = /```(\w+)?(?::([^\n]+))?\n([\s\S]*?)```/g;
  let match;
  let extracted = false;
  
  while ((match = regex.exec(response)) !== null) {
    let [_, lang, filename, code] = match;
    
    // Try to determine filename
    if (!filename) {
      if (lang === 'html') filename = 'index.html';
      else if (lang === 'css') filename = 'style.css';
      else if (lang === 'javascript' || lang === 'js') filename = 'app.js';
      else if (lang === 'json') filename = 'data.json';
    }
    
    if (filename) {
      files[filename] = code.trim();
      extracted = true;
    }
  }
  
  if (extracted) {
    renderFiles();
    updatePreview();
  }
}

// ==================== MODEL SELECT ====================
function updateModelOptions() {
  const provider = document.getElementById('providerSelect').value;
  const modelSelect = document.getElementById('modelSelect');
  const models = MODELS[provider] || [];
  
  modelSelect.innerHTML = models.map(m => 
    `<option value="${m}">${m.split('-').slice(-2).join('-')}</option>`
  ).join('');
}

// ==================== SETTINGS ====================
function openSettings() {
  document.getElementById('settingsModal').classList.add('active');
  document.getElementById('githubToken').value = localStorage.getItem('githubToken') || '';
  document.getElementById('defaultProvider').value = localStorage.getItem('defaultProvider') || 'groq';
}

function closeSettings() {
  document.getElementById('settingsModal').classList.remove('active');
}

function saveSettings() {
  localStorage.setItem('githubToken', document.getElementById('githubToken').value);
  localStorage.setItem('defaultProvider', document.getElementById('defaultProvider').value);
  
  // Apply default provider
  document.getElementById('providerSelect').value = document.getElementById('defaultProvider').value;
  updateModelOptions();
  
  closeSettings();
}

function loadSettings() {
  const provider = localStorage.getItem('defaultProvider');
  if (provider) {
    document.getElementById('providerSelect').value = provider;
    updateModelOptions();
  }
}

// ==================== IMPORT / EXPORT ====================
function importProject() {
  document.getElementById('importModal').classList.add('active');
}

function closeImportModal() {
  document.getElementById('importModal').classList.remove('active');
  document.getElementById('gitImportSection').classList.add('hidden');
}

function importFromFile() {
  document.getElementById('fileInput').click();
  closeImportModal();
}

function handleFileUpload(e) {
  Array.from(e.target.files).forEach(file => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      files[file.name] = ev.target.result;
      renderFiles();
      updatePreview();
    };
    reader.readAsText(file);
  });
  e.target.value = '';
}

function importFromZip() {
  document.getElementById('zipInput').click();
  closeImportModal();
}

async function handleZipUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  try {
    const JSZip = (await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm')).default;
    const zip = await JSZip.loadAsync(file);
    
    for (const [path, zipEntry] of Object.entries(zip.files)) {
      if (!zipEntry.dir) {
        const name = path.split('/').pop();
        const content = await zipEntry.async('text');
        files[name] = content;
      }
    }
    
    renderFiles();
    updatePreview();
    alert('ZIP imported successfully!');
  } catch (err) {
    alert('Failed to import ZIP: ' + err.message);
  }
  
  e.target.value = '';
}

function showGitImport() {
  document.getElementById('gitImportSection').classList.remove('hidden');
}

function importFromGit() {
  document.getElementById('importModal').classList.add('active');
  showGitImport();
}

async function doGitImport() {
  const url = document.getElementById('gitUrl').value;
  if (!url) return alert('Enter a GitHub URL');
  
  // Parse URL
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) return alert('Invalid GitHub URL');
  
  const [_, owner, repo] = match;
  
  try {
    const res = await fetch(`${API}/api/git/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner, repo: repo.replace('.git', '') })
    });
    
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    
    // Add files
    data.files.forEach(f => {
      files[f.name] = f.content;
    });
    
    renderFiles();
    updatePreview();
    closeImportModal();
    alert(`Imported ${data.files.length} files from ${owner}/${repo}`);
  } catch (err) {
    alert('Import failed: ' + err.message);
  }
}

function exportProject() {
  // Export as JSON
  const data = {
    files: files,
    exportedAt: new Date().toISOString()
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = 'project-export.json';
  a.click();
  
  URL.revokeObjectURL(url);
}

// ==================== DEPLOY ====================
function deployProject() {
  document.getElementById('deployModal').classList.add('active');
  document.getElementById('deployStatus').innerHTML = '';
}

function closeDeployModal() {
  document.getElementById('deployModal').classList.remove('active');
}

async function deployToNetlify() {
  const status = document.getElementById('deployStatus');
  status.className = 'deploy-status loading';
  status.textContent = 'Deploying to Netlify...';
  
  try {
    // Create file list for Netlify
    const fileList = Object.entries(files).map(([name, content]) => ({
      path: '/' + name,
      content: content
    }));
    
    // Deploy
    const res = await fetch(`${API}/api/deploy/netlify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: fileList })
    });
    
    const data = await res.json();
    
    if (data.url) {
      status.className = 'deploy-status success';
      status.innerHTML = `✅ Deployed! <a href="${data.url}" target="_blank">${data.url}</a>`;
    } else {
      throw new Error(data.error || 'Deploy failed');
    }
  } catch (err) {
    status.className = 'deploy-status error';
    status.textContent = '❌ ' + err.message;
  }
}

async function deployToVercel() {
  const status = document.getElementById('deployStatus');
  status.className = 'deploy-status loading';
  status.textContent = 'Deploying to Vercel...';
  
  try {
    const res = await fetch(`${API}/api/deploy/vercel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files })
    });
    
    const data = await res.json();
    
    if (data.url) {
      status.className = 'deploy-status success';
      status.innerHTML = `✅ Deployed! <a href="${data.url}" target="_blank">${data.url}</a>`;
    } else {
      throw new Error(data.error || 'Deploy failed');
    }
  } catch (err) {
    status.className = 'deploy-status error';
    status.textContent = '❌ ' + err.message;
  }
}

async function deployToGithub() {
  const token = localStorage.getItem('githubToken');
  if (!token) {
    alert('Please add your GitHub token in Settings first');
    closeDeployModal();
    openSettings();
    return;
  }
  
  const repoName = prompt('Repository name:', 'my-ai-project');
  if (!repoName) return;
  
  const status = document.getElementById('deployStatus');
  status.className = 'deploy-status loading';
  status.textContent = 'Pushing to GitHub...';
  
  try {
    const res = await fetch(`${API}/api/git/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        repo: repoName,
        files: Object.entries(files).map(([name, content]) => ({ name, content }))
      })
    });
    
    const data = await res.json();
    
    if (data.url) {
      status.className = 'deploy-status success';
      status.innerHTML = `✅ Pushed! <a href="${data.url}" target="_blank">${data.url}</a>`;
    } else {
      throw new Error(data.error || 'Push failed');
    }
  } catch (err) {
    status.className = 'deploy-status error';
    status.textContent = '❌ ' + err.message;
  }
}

// ==================== PANELS ====================
function toggleFiles() {
  const panel = document.getElementById('filesPanel');
  const overlay = document.getElementById('overlay');
  
  panel.classList.toggle('open');
  
  if (window.innerWidth <= 768) {
    overlay.classList.toggle('active', panel.classList.contains('open'));
    document.getElementById('previewPanel').classList.remove('open');
  }
}

function togglePreview() {
  const panel = document.getElementById('previewPanel');
  const overlay = document.getElementById('overlay');
  
  panel.classList.toggle('open');
  
  if (window.innerWidth <= 768) {
    overlay.classList.toggle('active', panel.classList.contains('open'));
    document.getElementById('filesPanel').classList.remove('open');
  }
}

function closeAllPanels() {
  document.getElementById('filesPanel').classList.remove('open');
  document.getElementById('previewPanel').classList.remove('open');
  document.getElementById('overlay').classList.remove('active');
}

// ==================== ATTACH ====================
function attachFile() {
  document.getElementById('fileInput').click();
}
