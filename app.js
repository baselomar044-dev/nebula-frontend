// AI App - Full Featured
const API = 'https://nebula-api-production.up.railway.app';

// State
let files = {};
let currentFile = null;
let attachments = [];
let conversationHistory = [];
let previewCode = { html: '', css: '', js: '' };
let sessionId = localStorage.getItem('sessionId') || Math.random().toString(36).substr(2, 9);
localStorage.setItem('sessionId', sessionId);

// DOM Elements
const $ = id => document.getElementById(id);
const leftPanel = $('leftPanel');
const rightPanel = $('rightPanel');
const messages = $('messages');
const input = $('input');
const fileTree = $('fileTree');
const previewFrame = $('previewFrame');
const modelSelect = $('modelSelect');

// Initialize
async function init() {
  setupEventListeners();
  loadSettings();
  await loadModels();
  loadFilesFromStorage();
  renderFileTree();
}

// Event Listeners
function setupEventListeners() {
  // Panel toggles
  $('filesBtn').onclick = () => leftPanel.classList.toggle('open');
  $('previewBtn').onclick = () => rightPanel.classList.toggle('open');
  $('settingsBtn').onclick = () => openModal('settingsModal');
  $('gitBtn').onclick = () => { openModal('gitModal'); loadRepos(); };
  $('dbBtn').onclick = () => { rightPanel.classList.add('open'); switchTab('database'); };
  $('termBtn').onclick = () => { rightPanel.classList.add('open'); switchTab('terminal'); };
  
  // Send message
  $('sendBtn').onclick = sendMessage;
  input.onkeydown = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  
  // Auto-resize input
  input.oninput = () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 200) + 'px';
  };
  
  // Attachments
  $('attachBtn').onclick = () => $('fileInput').click();
  $('fileInput').onchange = handleAttachments;
  
  // Preview tabs
  document.querySelectorAll('.preview-tab-btn').forEach(btn => {
    btn.onclick = () => switchPreviewTab(btn.dataset.view);
  });
  
  // Panel tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => switchTab(btn.dataset.tab);
  });
  
  // Git tabs
  document.querySelectorAll('.git-tab').forEach(btn => {
    btn.onclick = () => switchGitTab(btn.dataset.git);
  });
  
  // Terminal
  $('terminalInput').onkeydown = e => {
    if (e.key === 'Enter') runTerminalCommand();
  };
  
  // Expand preview
  $('expandPreview').onclick = () => rightPanel.classList.toggle('expanded');
  $('refreshPreview').onclick = updatePreview;
  
  // Keyboard shortcuts
  document.onkeydown = e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); leftPanel.classList.toggle('open'); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') { e.preventDefault(); rightPanel.classList.toggle('open'); }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveFilesToStorage(); }
  };
}

// Load available models
async function loadModels() {
  try {
    const res = await fetch(`${API}/api/config`);
    const data = await res.json();
    
    modelSelect.innerHTML = '<option value="auto">Auto Select</option>';
    $('defaultModel').innerHTML = '<option value="auto">Auto Select</option>';
    
    for (const [provider, models] of Object.entries(data.models)) {
      for (const model of models) {
        const opt = `<option value="${provider}/${model}">${provider}: ${model}</option>`;
        modelSelect.innerHTML += opt;
        $('defaultModel').innerHTML += opt;
      }
    }
  } catch (e) {
    console.error('Failed to load models:', e);
  }
}

// Send message with streaming
async function sendMessage() {
  const text = input.value.trim();
  if (!text && attachments.length === 0) return;
  
  // Build message
  let fullMessage = text;
  if (attachments.length > 0) {
    fullMessage += '\n\nAttached files:\n';
    for (const att of attachments) {
      fullMessage += `\n--- ${att.name} ---\n${att.content}\n`;
    }
  }
  
  // Add user message
  addMessage('user', text);
  conversationHistory.push({ role: 'user', content: fullMessage });
  
  // Clear input
  input.value = '';
  input.style.height = 'auto';
  attachments = [];
  $('attachments').innerHTML = '';
  
  // Add assistant placeholder
  const assistantMsg = addMessage('assistant', '');
  const useStreaming = $('streamResponses')?.checked !== false;
  
  if (useStreaming) {
    await streamResponse(fullMessage, assistantMsg);
  } else {
    await normalResponse(fullMessage, assistantMsg);
  }
}

// Streaming response
async function streamResponse(message, msgElement) {
  const model = modelSelect.value;
  
  try {
    const response = await fetch(`${API}/api/ai/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message, 
        model,
        context: conversationHistory.slice(-10)
      })
    });
    
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
          try {
            const data = JSON.parse(line.slice(6));
            if (data.text) {
              fullText += data.text;
              msgElement.innerHTML = formatMessage(fullText);
              messages.scrollTop = messages.scrollHeight;
            }
            if (data.error) {
              msgElement.innerHTML = `<span style="color:var(--red)">Error: ${data.error}</span>`;
            }
          } catch (e) {}
        }
      }
    }
    
    conversationHistory.push({ role: 'assistant', content: fullText });
    extractAndUpdateFiles(fullText);
    
  } catch (e) {
    msgElement.innerHTML = `<span style="color:var(--red)">Error: ${e.message}</span>`;
  }
}

// Normal (non-streaming) response
async function normalResponse(message, msgElement) {
  msgElement.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
  
  try {
    const res = await fetch(`${API}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, model: modelSelect.value })
    });
    
    const data = await res.json();
    
    if (data.error) {
      msgElement.innerHTML = `<span style="color:var(--red)">Error: ${data.error}</span>`;
      return;
    }
    
    const text = data.response;
    conversationHistory.push({ role: 'assistant', content: text });
    msgElement.innerHTML = formatMessage(text);
    extractAndUpdateFiles(text);
    
  } catch (e) {
    msgElement.innerHTML = `<span style="color:var(--red)">Error: ${e.message}</span>`;
  }
}

// Add message to chat
function addMessage(role, content) {
  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.innerHTML = role === 'user' ? escapeHtml(content) : formatMessage(content);
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

// Format message with code blocks
function formatMessage(text) {
  if (!text) return '';
  
  // Extract code blocks
  let html = escapeHtml(text);
  
  // Match code blocks with filename pattern: **filename.ext**\n```lang\ncode\n```
  html = html.replace(/\*\*([^*]+\.[a-z]+)\*\*\s*\n```(\w*)\n([\s\S]*?)```/gi, (match, filename, lang, code) => {
    return `<div class="code-header"><span>${filename}</span><div><button onclick="copyCode(this)">Copy</button><button onclick="addToFiles('${filename}', this)">Add</button><button onclick="previewCode('${filename}', this)">Preview</button></div></div><pre><code class="language-${lang || 'text'}">${code}</code></pre>`;
  });
  
  // Match regular code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<div class="code-header"><span>${lang || 'code'}</span><button onclick="copyCode(this)">Copy</button></div><pre><code class="language-${lang || 'text'}">${code}</code></pre>`;
  });
  
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
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

// Copy code
function copyCode(btn) {
  const code = btn.closest('.code-header').nextElementSibling.textContent;
  navigator.clipboard.writeText(code);
  btn.textContent = 'Copied!';
  setTimeout(() => btn.textContent = 'Copy', 1500);
}

// Add code to files
function addToFiles(filename, btn) {
  const code = btn.closest('.code-header').nextElementSibling.textContent;
  files[filename] = code;
  saveFilesToStorage();
  renderFileTree();
  btn.textContent = 'Added!';
  setTimeout(() => btn.textContent = 'Add', 1500);
}

// Preview code
function previewCode(filename, btn) {
  const code = btn.closest('.code-header').nextElementSibling.textContent;
  const ext = filename.split('.').pop().toLowerCase();
  
  if (ext === 'html') previewCode.html = code;
  else if (ext === 'css') previewCode.css = code;
  else if (ext === 'js') previewCode.js = code;
  
  updatePreview();
  rightPanel.classList.add('open');
  switchTab('preview');
}

// Extract files from AI response
function extractAndUpdateFiles(text) {
  const regex = /\*\*([^*]+\.[a-z]+)\*\*\s*\n```\w*\n([\s\S]*?)```/gi;
  let match;
  let hasFiles = false;
  
  while ((match = regex.exec(text)) !== null) {
    const filename = match[1];
    const code = match[2];
    files[filename] = code;
    hasFiles = true;
    
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'html') previewCode.html = code;
    else if (ext === 'css') previewCode.css = code;
    else if (ext === 'js') previewCode.js = code;
  }
  
  if (hasFiles) {
    saveFilesToStorage();
    renderFileTree();
    
    if ($('autoPreview')?.checked !== false) {
      updatePreview();
      rightPanel.classList.add('open');
    }
  }
}

// Update preview
function updatePreview() {
  const html = previewCode.html || files['index.html'] || '';
  const css = previewCode.css || files['style.css'] || files['styles.css'] || '';
  const js = previewCode.js || files['script.js'] || files['app.js'] || '';
  
  const content = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>${css}</style>
    </head>
    <body>
      ${html.replace(/<html[\s\S]*<body[^>]*>/gi, '').replace(/<\/body>[\s\S]*<\/html>/gi, '')}
      <script>
        window.onerror = (msg, url, line, col, err) => {
          parent.postMessage({ type: 'error', message: msg, line, col }, '*');
          return true;
        };
        console.log = (...args) => parent.postMessage({ type: 'log', args }, '*');
        console.error = (...args) => parent.postMessage({ type: 'error', args }, '*');
        console.warn = (...args) => parent.postMessage({ type: 'warn', args }, '*');
      <\/script>
      <script>${js}<\/script>
    </body>
    </html>
  `;
  
  previewFrame.srcdoc = content;
}

// Handle preview console messages
window.addEventListener('message', e => {
  if (e.data.type === 'log' || e.data.type === 'error' || e.data.type === 'warn') {
    const consoleView = $('consoleView');
    const div = document.createElement('div');
    div.className = `console-${e.data.type === 'warn' ? 'warn' : e.data.type === 'error' ? 'error' : 'log'}`;
    div.textContent = e.data.args ? e.data.args.join(' ') : e.data.message;
    consoleView.appendChild(div);
    
    // Auto-debug errors
    if (e.data.type === 'error') {
      autoDebugError(e.data.message || e.data.args?.join(' '));
    }
  }
});

// Auto debug errors
async function autoDebugError(error) {
  const js = previewCode.js || files['script.js'] || files['app.js'] || '';
  if (!js) return;
  
  try {
    const res = await fetch(`${API}/api/debug/fix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: js, error, language: 'javascript' })
    });
    
    const data = await res.json();
    if (data.fix) {
      // Show fix suggestion in chat
      const msg = addMessage('assistant', `🔧 **Error detected:** ${error}\n\n**Suggested fix:**\n\`\`\`javascript\n${data.fix}\n\`\`\``);
    }
  } catch (e) {
    console.error('Auto-debug failed:', e);
  }
}

// Switch tabs
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === tab + 'Tab');
  });
}

function switchPreviewTab(view) {
  document.querySelectorAll('.preview-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  
  const frame = previewFrame;
  const codeView = $('codeView');
  const consoleView = $('consoleView');
  const codeContent = $('codeContent');
  
  frame.classList.toggle('hidden', view !== 'live');
  codeView.classList.toggle('hidden', ['live', 'console'].includes(view));
  consoleView.classList.toggle('hidden', view !== 'console');
  
  if (view === 'html') codeContent.textContent = previewCode.html || files['index.html'] || '';
  else if (view === 'css') codeContent.textContent = previewCode.css || files['style.css'] || '';
  else if (view === 'js') codeContent.textContent = previewCode.js || files['script.js'] || '';
}

function switchGitTab(tab) {
  document.querySelectorAll('.git-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.git === tab);
  });
  document.querySelectorAll('.git-content').forEach(content => {
    content.classList.toggle('active', content.id === 'git' + tab.charAt(0).toUpperCase() + tab.slice(1));
  });
}

// File management
function renderFileTree() {
  fileTree.innerHTML = '';
  
  for (const [name, content] of Object.entries(files)) {
    const div = document.createElement('div');
    div.className = `file-item${currentFile === name ? ' active' : ''}`;
    div.innerHTML = `<span class="icon">${getFileIcon(name)}</span><span>${name}</span>`;
    div.onclick = () => openFile(name);
    fileTree.appendChild(div);
  }
}

function getFileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  const icons = {
    html: '🌐', css: '🎨', js: '⚡', json: '📋', md: '📝', py: '🐍'
  };
  return icons[ext] || '📄';
}

function openFile(name) {
  currentFile = name;
  renderFileTree();
  
  const ext = name.split('.').pop().toLowerCase();
  if (['html', 'css', 'js'].includes(ext)) {
    if (ext === 'html') previewCode.html = files[name];
    else if (ext === 'css') previewCode.css = files[name];
    else if (ext === 'js') previewCode.js = files[name];
    updatePreview();
    rightPanel.classList.add('open');
    switchPreviewTab(ext);
  }
}

function createFile() {
  const name = prompt('File name:');
  if (name) {
    files[name] = '';
    saveFilesToStorage();
    renderFileTree();
    openFile(name);
  }
}

function createFolder() {
  alert('Folders are coming soon!');
}

// Import/Export
async function importFiles() {
  const choice = prompt('Enter:\n1. GitHub URL (https://github.com/user/repo)\n2. Or press Cancel to upload files');
  
  if (choice && choice.includes('github.com')) {
    await gitImport(choice);
  } else if (choice === null) {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = async (e) => {
      for (const file of e.target.files) {
        const content = await file.text();
        files[file.name] = content;
      }
      saveFilesToStorage();
      renderFileTree();
    };
    input.click();
  }
}

function exportFiles() {
  const zip = {};
  for (const [name, content] of Object.entries(files)) {
    zip[name] = content;
  }
  
  const blob = new Blob([JSON.stringify(zip, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'project.json';
  a.click();
  URL.revokeObjectURL(url);
}

// Attachments
async function handleAttachments(e) {
  for (const file of e.target.files) {
    const content = await file.text();
    attachments.push({ name: file.name, content });
    
    const chip = document.createElement('div');
    chip.className = 'attachment-chip';
    chip.innerHTML = `<span>${file.name}</span><button onclick="this.parentElement.remove()">&times;</button>`;
    $('attachments').appendChild(chip);
  }
  e.target.value = '';
}

// Terminal
async function runTerminalCommand() {
  const cmd = $('terminalInput').value.trim();
  if (!cmd) return;
  
  $('terminalInput').value = '';
  const output = $('terminalOutput');
  output.innerHTML += `<div style="color:var(--green)">$ ${cmd}</div>`;
  
  try {
    const res = await fetch(`${API}/api/execute/shell`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: cmd })
    });
    
    const data = await res.json();
    
    if (data.output) output.innerHTML += `<div>${escapeHtml(data.output)}</div>`;
    if (data.errors) output.innerHTML += `<div style="color:var(--red)">${escapeHtml(data.errors)}</div>`;
    
  } catch (e) {
    output.innerHTML += `<div style="color:var(--red)">Error: ${e.message}</div>`;
  }
  
  output.scrollTop = output.scrollHeight;
}

// Database
async function dbQuery() {
  const sql = $('sqlInput').value.trim();
  if (!sql) return;
  
  try {
    const res = await fetch(`${API}/api/db/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, sql })
    });
    
    const data = await res.json();
    
    if (data.error) {
      $('dbResults').innerHTML = `<div style="color:var(--red)">${data.error}</div>`;
      return;
    }
    
    if (data.rows) {
      let html = '<table><thead><tr>';
      if (data.rows.length > 0) {
        for (const col of Object.keys(data.rows[0])) {
          html += `<th>${col}</th>`;
        }
      }
      html += '</tr></thead><tbody>';
      
      for (const row of data.rows) {
        html += '<tr>';
        for (const val of Object.values(row)) {
          html += `<td>${val === null ? 'NULL' : val}</td>`;
        }
        html += '</tr>';
      }
      html += '</tbody></table>';
      html += `<div style="margin-top:8px;color:var(--text-dim)">${data.rowCount} rows</div>`;
      
      $('dbResults').innerHTML = html;
    } else {
      $('dbResults').innerHTML = `<div style="color:var(--green)">✓ ${data.changes || 0} rows affected</div>`;
    }
    
  } catch (e) {
    $('dbResults').innerHTML = `<div style="color:var(--red)">${e.message}</div>`;
  }
}

async function dbSchema() {
  try {
    const res = await fetch(`${API}/api/db/schema?sessionId=${sessionId}`);
    const data = await res.json();
    
    let html = '';
    for (const [table, info] of Object.entries(data.schema)) {
      html += `<div style="margin-bottom:16px"><strong>${table}</strong> (${info.rowCount} rows)<table>`;
      html += '<thead><tr><th>Column</th><th>Type</th><th>Nullable</th><th>PK</th></tr></thead><tbody>';
      for (const col of info.columns) {
        html += `<tr><td>${col.name}</td><td>${col.type}</td><td>${col.nullable ? 'Yes' : 'No'}</td><td>${col.primaryKey ? '✓' : ''}</td></tr>`;
      }
      html += '</tbody></table></div>';
    }
    
    $('dbResults').innerHTML = html || '<div style="color:var(--text-dim)">No tables yet</div>';
    
  } catch (e) {
    $('dbResults').innerHTML = `<div style="color:var(--red)">${e.message}</div>`;
  }
}

async function dbExport() {
  try {
    const res = await fetch(`${API}/api/db/export?sessionId=${sessionId}`);
    const data = await res.json();
    
    const blob = new Blob([data.sql], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'database.sql';
    a.click();
    URL.revokeObjectURL(url);
    
  } catch (e) {
    alert('Export failed: ' + e.message);
  }
}

// Git
async function gitImport(url) {
  url = url || $('repoUrl').value.trim();
  if (!url) return;
  
  try {
    const res = await fetch(`${API}/api/git/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    
    const data = await res.json();
    
    if (data.error) {
      alert('Import failed: ' + data.error);
      return;
    }
    
    for (const file of data.files) {
      files[file.path] = file.content;
    }
    
    saveFilesToStorage();
    renderFileTree();
    closeModal('gitModal');
    addMessage('assistant', `✓ Imported ${data.files.length} files from ${data.repo}`);
    
  } catch (e) {
    alert('Import failed: ' + e.message);
  }
}

async function gitPush() {
  const token = $('githubToken').value || localStorage.getItem('githubToken');
  const repo = $('pushRepo').value.trim();
  const message = $('commitMsg').value.trim();
  
  if (!token) {
    alert('Please set your GitHub token in Settings first');
    return;
  }
  
  if (!repo) {
    alert('Please enter a repository name (username/repo)');
    return;
  }
  
  try {
    const filesToPush = Object.entries(files).map(([path, content]) => ({ path, content }));
    
    const res = await fetch(`${API}/api/git/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, repo, files: filesToPush, message })
    });
    
    const data = await res.json();
    
    if (data.error) {
      alert('Push failed: ' + data.error);
      return;
    }
    
    closeModal('gitModal');
    addMessage('assistant', `✓ Pushed ${filesToPush.length} files to ${repo}`);
    
  } catch (e) {
    alert('Push failed: ' + e.message);
  }
}

async function loadRepos() {
  const token = $('githubToken').value || localStorage.getItem('githubToken');
  if (!token) {
    $('repoList').innerHTML = '<div style="color:var(--text-dim)">Set GitHub token in Settings to see your repos</div>';
    return;
  }
  
  try {
    const res = await fetch(`${API}/api/git/repos?token=${token}`);
    const data = await res.json();
    
    $('repoList').innerHTML = data.repos.map(r => `
      <div class="file-item" onclick="$('pushRepo').value='${r.full_name}'; switchGitTab('push')">
        <span class="icon">📦</span>
        <span>${r.full_name}</span>
      </div>
    `).join('');
    
  } catch (e) {
    $('repoList').innerHTML = `<div style="color:var(--red)">${e.message}</div>`;
  }
}

// Settings
function loadSettings() {
  const theme = localStorage.getItem('theme') || 'dark';
  document.body.dataset.theme = theme;
  
  const githubToken = localStorage.getItem('githubToken');
  if (githubToken && $('githubToken')) $('githubToken').value = githubToken;
}

function saveSettings() {
  const theme = $('themeSelect').value;
  const githubToken = $('githubToken').value;
  
  localStorage.setItem('theme', theme);
  localStorage.setItem('githubToken', githubToken);
  document.body.dataset.theme = theme;
}

// Modals
function openModal(id) {
  $(id).classList.remove('hidden');
}

function closeModal(id) {
  $(id).classList.add('hidden');
  if (id === 'settingsModal') saveSettings();
}

// Local storage
function saveFilesToStorage() {
  localStorage.setItem('files', JSON.stringify(files));
}

function loadFilesFromStorage() {
  const saved = localStorage.getItem('files');
  if (saved) {
    try {
      files = JSON.parse(saved);
    } catch (e) {}
  }
}

// Initialize
init();
