// AI App - Production Ready with Model Selection
const API = 'https://nebula-api-production.up.railway.app';

// State
let files = {};
let currentFile = null;
let currentTab = 'live';
let consoleLogs = [];
let isStreaming = false;
let lastError = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  
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

function setPreviewTab(ext) {
  switchTab(ext);
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

// ==================== CHAT ====================
function addToChat(role, content) {
  const chat = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.innerHTML = `
    <div class="message-icon">${role === 'user' ? '👤' : '🤖'}</div>
    <div class="message-content">${content}</div>
  `;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  return div;
}

function formatResponse(text) {
  // Format code blocks
  return text.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="language-${lang || 'text'}">${escapeHtml(code.trim())}</code></pre>`;
  }).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ==================== AI COMMUNICATION ====================
function getSelectedModel() {
  const selector = document.getElementById('modelSelect');
  return selector ? selector.value : 'auto';
}

async function sendMessage() {
  const input = document.getElementById('userInput');
  const msg = input.value.trim();
  if (!msg || isStreaming) return;
  
  input.value = '';
  input.style.height = 'auto';
  addToChat('user', msg);
  
  await streamResponse(msg);
}

async function streamResponse(msg) {
  const model = getSelectedModel();
  
  isStreaming = true;
  const assistantDiv = addToChat('assistant', '');
  const contentDiv = assistantDiv.querySelector('.message-content');
  contentDiv.innerHTML = '<span class="typing">Thinking...</span>';
  
  let fullText = '';
  
  try {
    const res = await fetch(`${API}/api/ai/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, model: model })
    });
    
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.text) {
              fullText += data.text;
              contentDiv.innerHTML = formatResponse(fullText);
              document.getElementById('chatMessages').scrollTop = 
                document.getElementById('chatMessages').scrollHeight;
            }
            if (data.done) {
              extractAndApplyCode(fullText);
            }
            if (data.error) {
              contentDiv.innerHTML += `<br><span class="error">Error: ${data.error}</span>`;
            }
          } catch (e) {}
        }
      }
    }
    
    // Final extraction
    if (fullText) {
      extractAndApplyCode(fullText);
    }
  } catch (err) {
    contentDiv.innerHTML = `<span class="error">Error: ${err.message}</span>`;
  }
  
  isStreaming = false;
}

// ==================== CODE EXTRACTION ====================
function extractAndApplyCode(text) {
  // Pattern: **filename.ext** followed by code block
  const filePattern = /\*\*([^*]+\.[a-z]+)\*\*\s*```[\w]*\n([\s\S]*?)```/gi;
  let match;
  let foundAny = false;
  
  while ((match = filePattern.exec(text)) !== null) {
    const [, filename, code] = match;
    const cleanName = filename.trim().toLowerCase();
    files[cleanName] = code.trim();
    foundAny = true;
  }
  
  // Also try: filename.ext:\n```
  const altPattern = /([a-zA-Z0-9_-]+\.[a-z]+):\s*```[\w]*\n([\s\S]*?)```/gi;
  while ((match = altPattern.exec(text)) !== null) {
    const [, filename, code] = match;
    files[filename.trim().toLowerCase()] = code.trim();
    foundAny = true;
  }
  
  if (foundAny) {
    renderFiles();
    updatePreview();
  }
}

// ==================== PREVIEW ====================
function updatePreview() {
  const frame = document.getElementById('previewFrame');
  const html = files['index.html'] || '<html><body><p>No HTML file</p></body></html>';
  const css = files['style.css'] || files['styles.css'] || '';
  const js = files['app.js'] || files['script.js'] || files['main.js'] || '';
  
  const fullHtml = html
    .replace('</head>', `<style>${css}</style></head>`)
    .replace('</body>', `<script>
      window.onerror = function(msg, url, line, col, error) {
        parent.postMessage({ type: 'error', message: msg, line: line }, '*');
        return false;
      };
      try {
        ${js}
      } catch(e) {
        parent.postMessage({ type: 'error', message: e.message }, '*');
      }
    <\/script></body>`);
  
  frame.srcdoc = fullHtml;
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.preview-tabs .tab').forEach(t => {
    t.classList.toggle('active', t.textContent.toLowerCase() === tab);
  });
  
  const frame = document.getElementById('previewFrame');
  const codeView = document.getElementById('codeView');
  const consoleView = document.getElementById('consoleView');
  
  if (tab === 'live') {
    frame.style.display = 'block';
    codeView.style.display = 'none';
    consoleView.style.display = 'none';
  } else if (tab === 'console') {
    frame.style.display = 'none';
    codeView.style.display = 'none';
    consoleView.style.display = 'block';
    consoleView.innerHTML = consoleLogs.map(l => `<div class="${l.type}">${l.text}</div>`).join('') || 'No logs yet';
  } else {
    frame.style.display = 'none';
    codeView.style.display = 'block';
    consoleView.style.display = 'none';
    
    const fileMap = { html: 'index.html', css: 'style.css', js: 'app.js' };
    codeView.textContent = files[fileMap[tab]] || `// No ${tab} file`;
  }
}

function refreshPreview() {
  updatePreview();
}

function expandPreview() {
  const modal = document.getElementById('expandedModal');
  const frame = document.getElementById('expandedFrame');
  modal.style.display = 'flex';
  
  const html = files['index.html'] || '';
  const css = files['style.css'] || '';
  const js = files['app.js'] || '';
  
  frame.srcdoc = html
    .replace('</head>', `<style>${css}</style></head>`)
    .replace('</body>', `<script>${js}<\/script></body>`);
}

function closeExpanded() {
  document.getElementById('expandedModal').style.display = 'none';
}

// ==================== PANELS ====================
function toggleFiles() {
  document.getElementById('filesPanel').classList.toggle('open');
}

function togglePreview() {
  document.getElementById('previewPanel').classList.toggle('open');
}

function toggleSettings() {
  const modal = document.getElementById('settingsModal');
  modal.style.display = modal.style.display === 'none' ? 'flex' : 'none';
}

// ==================== ACTIONS ====================
function handleKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 150) + 'px';
}

async function gitImport() {
  const url = prompt('GitHub repo URL (e.g., https://github.com/user/repo):');
  if (!url) return;
  
  try {
    addToChat('assistant', '⏳ Importing from GitHub...');
    const res = await fetch(`${API}/api/git/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await res.json();
    
    if (data.files) {
      Object.assign(files, data.files);
      renderFiles();
      updatePreview();
      addToChat('assistant', `✅ Imported ${Object.keys(data.files).length} files!`);
    } else {
      addToChat('assistant', `❌ Import failed: ${data.error}`);
    }
  } catch (err) {
    addToChat('assistant', `❌ Error: ${err.message}`);
  }
}

async function runSQL() {
  const query = prompt('SQL Query (e.g., SELECT * FROM users):');
  if (!query) return;
  
  try {
    const res = await fetch(`${API}/api/db/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: query })
    });
    const data = await res.json();
    addToChat('assistant', `📊 Result:\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``);
  } catch (err) {
    addToChat('assistant', `❌ SQL Error: ${err.message}`);
  }
}

function importProject() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,.zip';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.files) {
        Object.assign(files, data.files);
        renderFiles();
        updatePreview();
        addToChat('assistant', `✅ Imported ${Object.keys(data.files).length} files!`);
      }
    } catch (err) {
      addToChat('assistant', '❌ Invalid project file');
    }
  };
  input.click();
}

function exportProject() {
  const data = { files, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'project.json';
  a.click();
  URL.revokeObjectURL(url);
  addToChat('assistant', '✅ Project exported!');
}

async function deployProject() {
  addToChat('assistant', '🚀 Deploying to Vercel...');
  
  try {
    const res = await fetch(`${API}/api/deploy/vercel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files })
    });
    const data = await res.json();
    
    if (data.url) {
      addToChat('assistant', `✅ Deployed! <a href="${data.url}" target="_blank">${data.url}</a>`);
    } else {
      addToChat('assistant', `❌ Deploy failed: ${data.error}`);
    }
  } catch (err) {
    addToChat('assistant', `❌ Error: ${err.message}`);
  }
}

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

async function autoFix() {
  if (!lastError) return;
  
  addToChat('assistant', '🔧 Analyzing error...');
  
  try {
    const res = await fetch(`${API}/api/debug/fix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: lastError,
        files: files
      })
    });
    const data = await res.json();
    
    if (data.fix) {
      addToChat('assistant', data.fix);
      extractAndApplyCode(data.fix);
    }
  } catch (err) {
    addToChat('assistant', `❌ Error: ${err.message}`);
  }
  
  lastError = null;
  document.getElementById('errorBar').style.display = 'none';
}

// Error listener
window.addEventListener('message', (e) => {
  if (e.data?.type === 'error') {
    lastError = e.data.message;
    const errorBar = document.getElementById('errorBar');
    const errorText = document.getElementById('errorText');
    errorText.textContent = `⚠️ Error: ${e.data.message}`;
    errorBar.style.display = 'flex';
    consoleLogs.push({ type: 'error', text: e.data.message });
  }
});

// Settings
function loadSettings() {
  const saved = localStorage.getItem('aiAppSettings');
  if (saved) {
    try {
      const settings = JSON.parse(saved);
      if (settings.model) {
        const selector = document.getElementById('modelSelect');
        if (selector) selector.value = settings.model;
      }
    } catch (e) {}
  }
}

function saveSettings() {
  const settings = {
    model: getSelectedModel()
  };
  localStorage.setItem('aiAppSettings', JSON.stringify(settings));
}

// Save model selection when changed
document.addEventListener('change', (e) => {
  if (e.target.id === 'modelSelect') {
    saveSettings();
  }
});
