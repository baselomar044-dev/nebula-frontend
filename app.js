// AI App - Production Ready with Real Error Handling
const API = 'https://nebula-api-production.up.railway.app';

// State
let files = {};
let currentFile = null;
let currentTab = 'live';
let consoleLogs = [];
let isStreaming = false;
let lastError = null;

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
  const ext = name.split('.').pop();
  if (['html', 'css', 'js'].includes(ext)) {
    setPreviewTab(ext);
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
    if (currentFile === name) currentFile = null;
    renderFiles();
    updatePreview();
  }
}

// ==================== PREVIEW ====================
function updatePreview() {
  const preview = document.getElementById('preview');
  const html = files['index.html'] || '';
  const css = files['style.css'] || '';
  const js = files['app.js'] || '';
  
  // Build full HTML with error catching
  const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${css}</style>
</head>
<body>
${html.replace(/<html>|<\/html>|<head>[\s\S]*<\/head>|<!DOCTYPE html>/gi, '').replace(/<link[^>]*>/gi, '').replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')}
<script>
// Console capture
const _log = console.log;
const _error = console.error;
const _warn = console.warn;
console.log = (...args) => { _log(...args); parent.postMessage({type:'console',level:'log',args:args.map(a=>String(a))},'*'); };
console.error = (...args) => { _error(...args); parent.postMessage({type:'console',level:'error',args:args.map(a=>String(a))},'*'); };
console.warn = (...args) => { _warn(...args); parent.postMessage({type:'console',level:'warn',args:args.map(a=>String(a))},'*'); };

// Error capture
window.onerror = function(msg, url, line, col, error) {
  const errorInfo = {
    message: msg,
    line: line,
    column: col,
    stack: error ? error.stack : null
  };
  parent.postMessage({type:'error', error: errorInfo},'*');
  return false;
};

// Syntax check and run
try {
  ${js}
} catch(e) {
  parent.postMessage({type:'error', error: {message: e.message, line: e.lineNumber || 0, stack: e.stack}},'*');
}
<\/script>
</body>
</html>`;

  preview.srcdoc = fullHtml;
  
  // Update code views
  document.getElementById('htmlCode').textContent = files['index.html'] || '';
  document.getElementById('cssCode').textContent = files['style.css'] || '';
  document.getElementById('jsCode').textContent = files['app.js'] || '';
  
  // Clear previous errors
  clearError();
}

// Listen for messages from iframe
window.addEventListener('message', (e) => {
  if (e.data.type === 'console') {
    addConsoleLog(e.data.level, e.data.args.join(' '));
  } else if (e.data.type === 'error') {
    showError(e.data.error);
  }
});

function addConsoleLog(level, msg) {
  consoleLogs.push({ level, msg, time: new Date().toLocaleTimeString() });
  updateConsole();
}

function updateConsole() {
  const el = document.getElementById('consoleOutput');
  el.innerHTML = consoleLogs.map(log => 
    `<div class="console-${log.level}">[${log.time}] ${log.msg}</div>`
  ).join('');
  el.scrollTop = el.scrollHeight;
}

function clearConsole() {
  consoleLogs = [];
  updateConsole();
}

function showError(error) {
  lastError = error;
  const el = document.getElementById('errorBanner');
  const msg = error.message || 'Unknown error';
  const line = error.line ? ` (line ${error.line})` : '';
  el.innerHTML = `⚠️ Error: ${msg}${line} <button class="auto-fix-btn" onclick="autoFixError()">Auto Fix</button>`;
  el.style.display = 'flex';
  addConsoleLog('error', `${msg}${line}`);
}

function clearError() {
  lastError = null;
  document.getElementById('errorBanner').style.display = 'none';
}

async function autoFixError() {
  if (!lastError) return;
  
  const btn = document.querySelector('.auto-fix-btn');
  btn.textContent = 'Fixing...';
  btn.disabled = true;
  
  // Gather all code context
  const codeContext = `
HTML (index.html):
\`\`\`html
${files['index.html'] || ''}
\`\`\`

CSS (style.css):
\`\`\`css
${files['style.css'] || ''}
\`\`\`

JavaScript (app.js):
\`\`\`javascript
${files['app.js'] || ''}
\`\`\`

ERROR: ${lastError.message}
${lastError.line ? `Line: ${lastError.line}` : ''}
${lastError.stack ? `Stack: ${lastError.stack}` : ''}
`;

  try {
    const res = await fetch(`${API}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Fix this JavaScript error. Return ONLY the corrected code files, no explanations. Format your response with code blocks like:

\`\`\`html
// corrected html
\`\`\`

\`\`\`css  
// corrected css
\`\`\`

\`\`\`javascript
// corrected js
\`\`\`

Here's the code and error:
${codeContext}`,
        model: 'groq'
      })
    });
    
    const data = await res.json();
    if (data.response) {
      // Extract fixed code
      const extracted = extractCodeBlocks(data.response);
      if (extracted.html) files['index.html'] = extracted.html;
      if (extracted.css) files['style.css'] = extracted.css;
      if (extracted.js) files['app.js'] = extracted.js;
      
      renderFiles();
      updatePreview();
      addToChat('assistant', '✅ Fixed! Check the preview.');
    }
  } catch (err) {
    addToChat('assistant', `❌ Fix failed: ${err.message}`);
  }
  
  btn.textContent = 'Auto Fix';
  btn.disabled = false;
}

function setPreviewTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[onclick="setPreviewTab('${tab}')"]`)?.classList.add('active');
  
  document.getElementById('livePreview').style.display = tab === 'live' ? 'block' : 'none';
  document.getElementById('htmlCode').style.display = tab === 'html' ? 'block' : 'none';
  document.getElementById('cssCode').style.display = tab === 'css' ? 'block' : 'none';
  document.getElementById('jsCode').style.display = tab === 'js' ? 'block' : 'none';
  document.getElementById('consoleView').style.display = tab === 'console' ? 'block' : 'none';
}

function refreshPreview() {
  updatePreview();
}

function toggleExpandPreview() {
  document.getElementById('previewPanel').classList.toggle('expanded');
}

// ==================== PANELS ====================
function toggleFiles() {
  document.getElementById('filesPanel').classList.toggle('open');
}

function togglePreview() {
  document.getElementById('previewPanel').classList.toggle('open');
}

function toggleSettings() {
  document.getElementById('settingsModal').classList.toggle('open');
}

function closeSettings() {
  document.getElementById('settingsModal').classList.remove('open');
}

// ==================== CHAT ====================
async function sendMessage() {
  const input = document.getElementById('userInput');
  const msg = input.value.trim();
  if (!msg || isStreaming) return;
  
  input.value = '';
  input.style.height = 'auto';
  addToChat('user', msg);
  
  const streamEnabled = document.getElementById('streamToggle')?.checked !== false;
  
  if (streamEnabled) {
    await streamResponse(msg);
  } else {
    await regularResponse(msg);
  }
}

async function regularResponse(msg) {
  const provider = document.getElementById('providerSelect').value;
  const model = document.getElementById('modelSelect').value;
  
  isStreaming = true;
  const assistantDiv = addToChat('assistant', '');
  const contentDiv = assistantDiv.querySelector('.message-content');
  contentDiv.innerHTML = '<span class="typing">Thinking...</span>';
  
  try {
    const res = await fetch(`${API}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, model: provider, specificModel: model })
    });
    
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    
    contentDiv.innerHTML = formatResponse(data.response);
    extractAndApplyCode(data.response);
  } catch (err) {
    contentDiv.innerHTML = `<span class="error">Error: ${err.message}</span>`;
  }
  
  isStreaming = false;
}

async function streamResponse(msg) {
  const provider = document.getElementById('providerSelect').value;
  const model = document.getElementById('modelSelect').value;
  
  isStreaming = true;
  const assistantDiv = addToChat('assistant', '');
  const contentDiv = assistantDiv.querySelector('.message-content');
  let fullResponse = '';
  
  try {
    const res = await fetch(`${API}/api/ai/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, model: provider, specificModel: model })
    });
    
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.token) {
              fullResponse += data.token;
              contentDiv.innerHTML = formatResponse(fullResponse) + '<span class="cursor">▊</span>';
              scrollChat();
            } else if (data.error) {
              throw new Error(data.error);
            }
          } catch (e) {}
        }
      }
    }
    
    contentDiv.innerHTML = formatResponse(fullResponse);
    extractAndApplyCode(fullResponse);
  } catch (err) {
    contentDiv.innerHTML = `<span class="error">Error: ${err.message}</span>`;
  }
  
  isStreaming = false;
}

function addToChat(role, content) {
  const chat = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.innerHTML = `
    <div class="message-icon">${role === 'user' ? '👤' : '🤖'}</div>
    <div class="message-content">${formatResponse(content)}</div>
  `;
  chat.appendChild(div);
  scrollChat();
  return div;
}

function scrollChat() {
  const chat = document.getElementById('chatMessages');
  chat.scrollTop = chat.scrollHeight;
}

function formatResponse(text) {
  if (!text) return '';
  // Basic markdown
  return text
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="lang-$1">$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

function extractCodeBlocks(text) {
  const result = { html: null, css: null, js: null };
  
  // HTML
  const htmlMatch = text.match(/```html\n([\s\S]*?)```/);
  if (htmlMatch) result.html = htmlMatch[1].trim();
  
  // CSS
  const cssMatch = text.match(/```css\n([\s\S]*?)```/);
  if (cssMatch) result.css = cssMatch[1].trim();
  
  // JavaScript
  const jsMatch = text.match(/```(?:javascript|js)\n([\s\S]*?)```/);
  if (jsMatch) result.js = jsMatch[1].trim();
  
  return result;
}

function extractAndApplyCode(text) {
  const extracted = extractCodeBlocks(text);
  let updated = false;
  
  if (extracted.html) {
    files['index.html'] = extracted.html;
    updated = true;
  }
  if (extracted.css) {
    files['style.css'] = extracted.css;
    updated = true;
  }
  if (extracted.js) {
    files['app.js'] = extracted.js;
    updated = true;
  }
  
  if (updated) {
    renderFiles();
    updatePreview();
  }
}

function handleKeyPress(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

// ==================== SETTINGS ====================
function loadSettings() {
  const settings = JSON.parse(localStorage.getItem('ai-settings') || '{}');
  if (settings.provider) {
    document.getElementById('providerSelect').value = settings.provider;
  }
  if (settings.githubToken) {
    document.getElementById('githubToken').value = settings.githubToken;
  }
}

function saveSettings() {
  const settings = {
    provider: document.getElementById('providerSelect').value,
    githubToken: document.getElementById('githubToken').value
  };
  localStorage.setItem('ai-settings', JSON.stringify(settings));
  updateModelOptions();
  closeSettings();
}

function updateModelOptions() {
  const provider = document.getElementById('providerSelect').value;
  const modelSelect = document.getElementById('modelSelect');
  const models = MODELS[provider] || [];
  modelSelect.innerHTML = models.map(m => `<option value="${m}">${m}</option>`).join('');
}

// ==================== IMPORT/EXPORT ====================
function importProject() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.zip,.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.name.endsWith('.json')) {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.files) {
        files = data.files;
        renderFiles();
        updatePreview();
        addToChat('assistant', '✅ Project imported!');
      }
    } else {
      addToChat('assistant', '📦 ZIP import coming soon. Use JSON for now.');
    }
  };
  input.click();
}

function exportProject() {
  const data = {
    name: 'AI Project',
    version: '1.0',
    files: files,
    exportedAt: new Date().toISOString()
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'project.json';
  a.click();
  URL.revokeObjectURL(url);
}

// ==================== DEPLOY ====================
async function deployProject() {
  addToChat('assistant', '🚀 Deploying to Vercel...');
  
  try {
    const res = await fetch(`${API}/api/deploy/vercel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files })
    });
    
    const data = await res.json();
    
    if (data.success && data.url) {
      addToChat('assistant', `✅ Deployed!\n\n🔗 **URL:** [${data.url}](${data.url})\n\nYour app is live!`);
    } else {
      throw new Error(data.error || 'Deploy failed');
    }
  } catch (err) {
    addToChat('assistant', `❌ Deploy failed: ${err.message}`);
  }
}

// ==================== GIT ====================
async function gitImport() {
  const url = prompt('GitHub repo URL (e.g., https://github.com/user/repo):');
  if (!url) return;
  
  addToChat('assistant', '📥 Importing from GitHub...');
  
  try {
    const res = await fetch(`${API}/api/git/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl: url })
    });
    
    const data = await res.json();
    
    if (data.files) {
      // Merge imported files
      Object.assign(files, data.files);
      renderFiles();
      updatePreview();
      addToChat('assistant', `✅ Imported ${Object.keys(data.files).length} files from GitHub!`);
    } else {
      throw new Error(data.error || 'Import failed');
    }
  } catch (err) {
    addToChat('assistant', `❌ Import failed: ${err.message}`);
  }
}

// ==================== DATABASE ====================
async function runSQL() {
  const sql = prompt('Enter SQL query:');
  if (!sql) return;
  
  addToChat('user', `SQL: ${sql}`);
  
  try {
    const res = await fetch(`${API}/api/db/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql })
    });
    
    const data = await res.json();
    
    if (data.error) throw new Error(data.error);
    
    if (data.rows) {
      addToChat('assistant', `✅ Query returned ${data.rows.length} rows:\n\`\`\`json\n${JSON.stringify(data.rows, null, 2)}\n\`\`\``);
    } else {
      addToChat('assistant', `✅ Query executed successfully.`);
    }
  } catch (err) {
    addToChat('assistant', `❌ SQL Error: ${err.message}`);
  }
}

// ==================== ATTACHMENTS ====================
function attachFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.onchange = async (e) => {
    for (const file of e.target.files) {
      const text = await file.text();
      files[file.name] = text;
    }
    renderFiles();
    updatePreview();
    addToChat('assistant', `📎 Added ${e.target.files.length} file(s)`);
  };
  input.click();
}

// Clear chat
function clearChat() {
  document.getElementById('chatMessages').innerHTML = `
    <div class="message assistant">
      <div class="message-icon">🤖</div>
      <div class="message-content">Ready to build! Describe what you want to create.</div>
    </div>
  `;
}
