// AI App - Production Ready with Auto-Fix, Smart Models, Database
const API = 'https://nebula-api-production.up.railway.app';

// State
let files = {};
let currentFile = null;
let chatHistory = [];
let settings = JSON.parse(localStorage.getItem('ai-settings') || '{}');
let dbTables = [];

// DOM Elements
const $ = id => document.getElementById(id);
const leftPanel = $('leftPanel');
const rightPanel = $('rightPanel');
const chatMessages = $('chatMessages');
const chatInput = $('chatInput');
const previewFrame = $('previewFrame');
const fileList = $('fileList');
const terminalOutput = $('terminalOutput');
const dbOutput = $('dbOutput');

// Model Configuration - Smart Selection
const MODELS = {
  'auto': { name: 'Auto (Smart Select)', provider: 'auto' },
  'claude-sonnet': { name: 'Claude 3.5 Sonnet', provider: 'anthropic', id: 'claude-3-5-sonnet-20241022', complexity: 'high' },
  'claude-haiku': { name: 'Claude 3 Haiku', provider: 'anthropic', id: 'claude-3-haiku-20240307', complexity: 'low' },
  'gpt-4o': { name: 'GPT-4o', provider: 'openai', id: 'gpt-4o', complexity: 'high' },
  'gpt-4o-mini': { name: 'GPT-4o Mini', provider: 'openai', id: 'gpt-4o-mini', complexity: 'low' },
  'groq-llama': { name: 'Llama 3.3 70B', provider: 'groq', id: 'llama-3.3-70b-versatile', complexity: 'medium' },
  'gemini-pro': { name: 'Gemini 1.5 Pro', provider: 'google', id: 'gemini-1.5-pro', complexity: 'high' },
  'gemini-flash': { name: 'Gemini 1.5 Flash', provider: 'google', id: 'gemini-1.5-flash', complexity: 'low' }
};

// Smart model selection based on task complexity
function selectSmartModel(message) {
  const msg = message.toLowerCase();
  
  // Complex tasks -> Claude Sonnet
  const complexPatterns = [
    /build.*app/i, /create.*project/i, /full.*stack/i, /complex/i,
    /refactor/i, /architect/i, /design.*system/i, /multiple.*file/i,
    /dashboard/i, /authentication/i, /database.*design/i
  ];
  
  // Medium tasks -> Groq Llama (fast + good)
  const mediumPatterns = [
    /explain/i, /how.*work/i, /debug/i, /fix.*bug/i,
    /add.*feature/i, /update/i, /modify/i, /improve/i
  ];
  
  // Simple tasks -> Haiku/Mini (cheap + fast)
  const simplePatterns = [
    /hello/i, /hi/i, /thanks/i, /what.*is/i, /define/i,
    /simple/i, /quick/i, /short/i, /one.*line/i
  ];
  
  if (complexPatterns.some(p => p.test(msg)) || msg.length > 500) {
    return 'anthropic/claude-3-5-sonnet-20241022';
  } else if (simplePatterns.some(p => p.test(msg)) || msg.length < 50) {
    return 'groq/llama-3.1-8b-instant';
  } else {
    return 'groq/llama-3.3-70b-versatile';
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadFiles();
  setupEventListeners();
  addWelcomeMessage();
});

function loadSettings() {
  if (settings.githubToken) $('githubToken').value = settings.githubToken;
  if (settings.model) $('modelSelect').value = settings.model;
  if (settings.autoPreview !== undefined) $('autoPreview').checked = settings.autoPreview;
  if (settings.autoFix !== undefined) $('autoFix').checked = settings.autoFix;
  else settings.autoFix = true; // Default on
}

function saveSettings() {
  settings.githubToken = $('githubToken').value;
  settings.model = $('modelSelect').value;
  settings.autoPreview = $('autoPreview').checked;
  settings.autoFix = $('autoFix').checked;
  localStorage.setItem('ai-settings', JSON.stringify(settings));
  closeModal('settingsModal');
  showToast('Settings saved');
}

function setupEventListeners() {
  // Chat input
  chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault();
      togglePanel('left');
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
      e.preventDefault();
      togglePanel('right');
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      saveCurrentFile();
    }
  });
  
  // Auto-resize textarea
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 150) + 'px';
  });
}

function addWelcomeMessage() {
  addMessage('assistant', `**Welcome to AI** 🚀

I can help you build anything:
- "Build a landing page with hero and features"
- "Create a todo app with local storage"
- "Make a dashboard with charts"

**Features:**
- 🔄 Smart model selection (auto-picks best AI)
- 🛠️ Auto-fix errors in preview
- 📁 Full file management
- 🗄️ SQL database support
- ⎇ Git import/export

What would you like to build?`);
}

// Panel Controls
function togglePanel(side) {
  const panel = side === 'left' ? leftPanel : rightPanel;
  panel.classList.toggle('open');
}

function expandPreview() {
  rightPanel.classList.toggle('expanded');
}

// Chat Functions
function addMessage(role, content, isStreaming = false) {
  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.innerHTML = `<div class="message-content">${formatMessage(content)}</div>`;
  
  if (role === 'assistant' && !isStreaming) {
    // Extract files from code blocks
    extractFiles(content);
    
    // Add action buttons
    const actions = document.createElement('div');
    actions.className = 'message-actions';
    actions.innerHTML = `
      <button onclick="copyMessage(this)">Copy</button>
      <button onclick="previewCode(this)">Preview</button>
      <button onclick="insertToFiles(this)">Add to Files</button>
    `;
    div.appendChild(actions);
  }
  
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

function formatMessage(content) {
  // Convert markdown code blocks
  content = content.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="language-${lang || 'text'}">${escapeHtml(code.trim())}</code></pre>`;
  });
  
  // Convert inline code
  content = content.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Convert bold
  content = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Convert line breaks
  content = content.replace(/\n/g, '<br>');
  
  return content;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function sendMessage() {
  const message = chatInput.value.trim();
  if (!message) return;
  
  chatInput.value = '';
  chatInput.style.height = 'auto';
  
  // Add user message
  addMessage('user', message);
  chatHistory.push({ role: 'user', content: message });
  
  // Show typing indicator
  const typingDiv = addMessage('assistant', '<span class="typing">Thinking...</span>', true);
  
  try {
    // Determine model
    let model = settings.model || 'auto';
    if (model === 'auto') {
      model = selectSmartModel(message);
    }
    
    // Build context with current files
    let context = message;
    if (Object.keys(files).length > 0) {
      context = `Current project files:\n${Object.entries(files).map(([name, content]) => 
        `**${name}**:\n\`\`\`\n${content.substring(0, 1000)}\n\`\`\``
      ).join('\n\n')}\n\nUser request: ${message}`;
    }
    
    // Check if streaming is supported
    const useStreaming = settings.streaming !== false;
    
    if (useStreaming) {
      await streamResponse(context, model, typingDiv);
    } else {
      const response = await fetch(`${API}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: context, model })
      });
      
      const data = await response.json();
      typingDiv.remove();
      addMessage('assistant', data.response || data.error || 'No response');
      chatHistory.push({ role: 'assistant', content: data.response });
    }
    
    // Auto preview if enabled
    if (settings.autoPreview !== false) {
      setTimeout(() => updatePreview(), 500);
    }
    
  } catch (error) {
    typingDiv.remove();
    addMessage('assistant', `Error: ${error.message}`);
  }
}

async function streamResponse(message, model, typingDiv) {
  const response = await fetch(`${API}/api/ai/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, model })
  });
  
  typingDiv.remove();
  const streamDiv = addMessage('assistant', '', true);
  const contentDiv = streamDiv.querySelector('.message-content');
  let fullContent = '';
  
  const reader = response.body.getReader();
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
          if (data.text) {
            fullContent += data.text;
            contentDiv.innerHTML = formatMessage(fullContent);
            chatMessages.scrollTop = chatMessages.scrollHeight;
          }
          if (data.done) {
            // Add action buttons
            const actions = document.createElement('div');
            actions.className = 'message-actions';
            actions.innerHTML = `
              <button onclick="copyMessage(this)">Copy</button>
              <button onclick="previewCode(this)">Preview</button>
              <button onclick="insertToFiles(this)">Add to Files</button>
            `;
            streamDiv.appendChild(actions);
            
            // Extract files
            extractFiles(fullContent);
            chatHistory.push({ role: 'assistant', content: fullContent });
          }
        } catch (e) {}
      }
    }
  }
}

// File extraction from AI responses
function extractFiles(content) {
  const filePattern = /\*\*([^*]+\.(html|css|js|json|py|md))\*\*\s*[\n\r]*```[\w]*\n([\s\S]*?)```/gi;
  let match;
  
  while ((match = filePattern.exec(content)) !== null) {
    const filename = match[1].trim();
    const code = match[3].trim();
    files[filename] = code;
  }
  
  // Also extract unnamed code blocks
  const codePattern = /```(html|css|javascript|js)\n([\s\S]*?)```/gi;
  while ((match = codePattern.exec(content)) !== null) {
    const lang = match[1].toLowerCase();
    const code = match[2].trim();
    const ext = lang === 'javascript' ? 'js' : lang;
    const filename = `main.${ext}`;
    if (!files[filename]) {
      files[filename] = code;
    }
  }
  
  renderFileList();
  saveFiles();
}

// File Management
function renderFileList() {
  fileList.innerHTML = '';
  
  Object.keys(files).sort().forEach(name => {
    const div = document.createElement('div');
    div.className = `file-item ${currentFile === name ? 'active' : ''}`;
    div.innerHTML = `
      <span class="file-icon">${getFileIcon(name)}</span>
      <span class="file-name">${name}</span>
      <button class="file-delete" onclick="deleteFile('${name}')">×</button>
    `;
    div.onclick = (e) => {
      if (!e.target.classList.contains('file-delete')) {
        openFile(name);
      }
    };
    fileList.appendChild(div);
  });
}

function getFileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  const icons = {
    html: '📄', css: '🎨', js: '⚡', json: '📋',
    py: '🐍', md: '📝', txt: '📃', sql: '🗄️'
  };
  return icons[ext] || '📄';
}

function openFile(name) {
  currentFile = name;
  renderFileList();
  
  // Show in editor modal or preview
  showToast(`Opened ${name}`);
  
  // Update preview if it's a viewable file
  if (['html', 'css', 'js'].includes(name.split('.').pop())) {
    updatePreview();
  }
}

function deleteFile(name) {
  if (confirm(`Delete ${name}?`)) {
    delete files[name];
    if (currentFile === name) currentFile = null;
    renderFileList();
    saveFiles();
    showToast(`Deleted ${name}`);
  }
}

function createFile() {
  const name = prompt('File name (e.g., script.js):');
  if (name) {
    files[name] = '';
    currentFile = name;
    renderFileList();
    saveFiles();
    showModal('editorModal');
    $('editorFileName').textContent = name;
    $('codeEditor').value = '';
  }
}

function saveCurrentFile() {
  if (currentFile && $('codeEditor')) {
    files[currentFile] = $('codeEditor').value;
    saveFiles();
    updatePreview();
    showToast('Saved');
  }
}

function saveFiles() {
  localStorage.setItem('ai-files', JSON.stringify(files));
}

function loadFiles() {
  const saved = localStorage.getItem('ai-files');
  if (saved) {
    files = JSON.parse(saved);
    renderFileList();
  }
}

// Preview
function updatePreview() {
  const html = files['index.html'] || files['main.html'] || '';
  const css = files['style.css'] || files['main.css'] || files['styles.css'] || '';
  const js = files['script.js'] || files['main.js'] || files['app.js'] || '';
  
  const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>${css}</style>
    </head>
    <body>
      ${html.includes('<body') ? html.replace(/.*<body[^>]*>/is, '').replace(/<\/body>.*/is, '') : html}
      <script>
        window.onerror = function(msg, url, line) {
          parent.postMessage({type: 'error', message: msg, line: line}, '*');
          return false;
        };
        ${js}
      </script>
    </body>
    </html>
  `;
  
  previewFrame.srcdoc = fullHtml;
  
  // Open preview panel if content exists
  if (html || css || js) {
    rightPanel.classList.add('open');
  }
}

// Listen for preview errors (Auto-Fix)
window.addEventListener('message', async (e) => {
  if (e.data && e.data.type === 'error') {
    const error = e.data;
    console.error('Preview error:', error);
    
    // Add error to terminal
    addTerminalOutput(`Error at line ${error.line}: ${error.message}`, 'error');
    
    // Auto-fix if enabled
    if (settings.autoFix !== false) {
      await autoFixError(error);
    }
  }
});

async function autoFixError(error) {
  showToast('Auto-fixing error...', 'info');
  
  const jsCode = files['script.js'] || files['main.js'] || files['app.js'] || '';
  
  const fixPrompt = `Fix this JavaScript error:
Error: ${error.message} at line ${error.line}

Code:
\`\`\`javascript
${jsCode}
\`\`\`

Provide ONLY the corrected code, no explanations.`;

  try {
    const response = await fetch(`${API}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message: fixPrompt, 
        model: 'groq/llama-3.3-70b-versatile' // Fast model for fixes
      })
    });
    
    const data = await response.json();
    
    // Extract fixed code
    const codeMatch = data.response.match(/```(?:javascript|js)?\n([\s\S]*?)```/);
    if (codeMatch) {
      const fixedCode = codeMatch[1].trim();
      const jsFile = Object.keys(files).find(f => f.endsWith('.js'));
      if (jsFile) {
        files[jsFile] = fixedCode;
        saveFiles();
        updatePreview();
        showToast('Error fixed!', 'success');
        addTerminalOutput('Auto-fix applied successfully', 'success');
      }
    }
  } catch (err) {
    showToast('Auto-fix failed', 'error');
  }
}

// Terminal
function addTerminalOutput(text, type = 'log') {
  const line = document.createElement('div');
  line.className = `terminal-line ${type}`;
  line.textContent = `> ${text}`;
  terminalOutput.appendChild(line);
  terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

async function runTerminalCommand() {
  const input = $('terminalInput');
  const cmd = input.value.trim();
  if (!cmd) return;
  
  input.value = '';
  addTerminalOutput(cmd, 'command');
  
  try {
    const response = await fetch(`${API}/api/execute/shell`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: cmd })
    });
    
    const data = await response.json();
    if (data.output) addTerminalOutput(data.output);
    if (data.error) addTerminalOutput(data.error, 'error');
  } catch (err) {
    addTerminalOutput(err.message, 'error');
  }
}

// Database
async function runQuery() {
  const sql = $('sqlInput').value.trim();
  if (!sql) return;
  
  try {
    const response = await fetch(`${API}/api/db/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql })
    });
    
    const data = await response.json();
    
    if (data.error) {
      dbOutput.innerHTML = `<div class="db-error">${data.error}</div>`;
    } else if (data.rows) {
      renderTable(data.rows);
    } else {
      dbOutput.innerHTML = `<div class="db-success">Query executed. ${data.changes || 0} rows affected.</div>`;
    }
    
    // Refresh table list
    await loadTables();
  } catch (err) {
    dbOutput.innerHTML = `<div class="db-error">${err.message}</div>`;
  }
}

async function loadTables() {
  try {
    const response = await fetch(`${API}/api/db/tables`);
    const data = await response.json();
    dbTables = data.tables || [];
    
    const tablesDiv = $('tableList');
    if (tablesDiv) {
      tablesDiv.innerHTML = dbTables.map(t => 
        `<div class="table-item" onclick="queryTable('${t}')">${t}</div>`
      ).join('') || '<div class="no-tables">No tables yet</div>';
    }
  } catch (err) {}
}

async function queryTable(name) {
  $('sqlInput').value = `SELECT * FROM ${name} LIMIT 100`;
  await runQuery();
}

function renderTable(rows) {
  if (!rows || rows.length === 0) {
    dbOutput.innerHTML = '<div class="db-empty">No results</div>';
    return;
  }
  
  const cols = Object.keys(rows[0]);
  let html = '<table class="db-table"><thead><tr>';
  html += cols.map(c => `<th>${c}</th>`).join('');
  html += '</tr></thead><tbody>';
  
  rows.forEach(row => {
    html += '<tr>';
    html += cols.map(c => `<td>${row[c] ?? ''}</td>`).join('');
    html += '</tr>';
  });
  
  html += '</tbody></table>';
  dbOutput.innerHTML = html;
}

// Git Operations
async function importFromGit() {
  const url = prompt('GitHub repository URL:');
  if (!url) return;
  
  showToast('Importing from GitHub...');
  
  try {
    const response = await fetch(`${API}/api/git/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    
    const data = await response.json();
    
    if (data.files) {
      Object.assign(files, data.files);
      saveFiles();
      renderFileList();
      updatePreview();
      showToast(`Imported ${Object.keys(data.files).length} files!`, 'success');
    } else {
      showToast(data.error || 'Import failed', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function pushToGit() {
  const repo = prompt('Repository name (will create if not exists):');
  if (!repo) return;
  
  const token = settings.githubToken;
  if (!token) {
    showToast('Set GitHub token in Settings first', 'error');
    return;
  }
  
  showToast('Pushing to GitHub...');
  
  try {
    const response = await fetch(`${API}/api/git/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo, token, files })
    });
    
    const data = await response.json();
    
    if (data.success) {
      showToast(`Pushed to github.com/${data.owner}/${repo}`, 'success');
    } else {
      showToast(data.error || 'Push failed', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Import/Export
function importProject() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.zip,.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.name.endsWith('.json')) {
      const text = await file.text();
      const imported = JSON.parse(text);
      Object.assign(files, imported);
      saveFiles();
      renderFileList();
      showToast('Project imported!', 'success');
    } else if (file.name.endsWith('.zip')) {
      showToast('Extracting ZIP...');
      // Handle ZIP import
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const response = await fetch(`${API}/api/git/import-zip`, {
          method: 'POST',
          body: formData
        });
        const data = await response.json();
        if (data.files) {
          Object.assign(files, data.files);
          saveFiles();
          renderFileList();
          showToast('ZIP imported!', 'success');
        }
      } catch (err) {
        // Fallback: just import as JSON
        showToast('Use JSON format for now', 'info');
      }
    }
  };
  input.click();
}

function exportProject() {
  const data = JSON.stringify(files, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'project.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Project exported!');
}

// Deploy
async function deployProject() {
  showModal('deployModal');
}

async function deployToNetlify() {
  showToast('Deploying to Netlify...');
  closeModal('deployModal');
  
  try {
    const response = await fetch(`${API}/api/deploy/netlify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files })
    });
    
    const data = await response.json();
    
    if (data.url) {
      showToast(`Deployed! ${data.url}`, 'success');
      window.open(data.url, '_blank');
    } else {
      showToast(data.error || 'Deploy failed', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deployToVercel() {
  showToast('Deploying to Vercel...');
  closeModal('deployModal');
  
  try {
    const response = await fetch(`${API}/api/deploy/vercel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files })
    });
    
    const data = await response.json();
    
    if (data.url) {
      showToast(`Deployed! ${data.url}`, 'success');
      window.open(data.url, '_blank');
    } else {
      showToast(data.error || 'Deploy failed', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Attachments
function attachFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.onchange = async (e) => {
    for (const file of e.target.files) {
      const text = await file.text();
      files[file.name] = text;
    }
    saveFiles();
    renderFileList();
    showToast(`Added ${e.target.files.length} file(s)`);
  };
  input.click();
}

// Helper functions
function copyMessage(btn) {
  const content = btn.closest('.message').querySelector('.message-content').innerText;
  navigator.clipboard.writeText(content);
  showToast('Copied!');
}

function previewCode(btn) {
  const content = btn.closest('.message').querySelector('.message-content').innerText;
  extractFiles(content);
  updatePreview();
  rightPanel.classList.add('open');
}

function insertToFiles(btn) {
  const content = btn.closest('.message').querySelector('.message-content').innerText;
  extractFiles(content);
  showToast('Added to files');
}

// Modal functions
function showModal(id) {
  $(id).classList.add('show');
  if (id === 'dbModal') loadTables();
}

function closeModal(id) {
  $(id).classList.remove('show');
}

// Toast notifications
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Preview tab switching
function switchPreviewTab(tab) {
  document.querySelectorAll('.preview-tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  
  const content = $('previewContent');
  
  switch(tab) {
    case 'live':
      content.innerHTML = '<iframe id="previewFrame" sandbox="allow-scripts allow-modals"></iframe>';
      updatePreview();
      break;
    case 'html':
      content.innerHTML = `<pre class="code-view">${escapeHtml(files['index.html'] || files['main.html'] || '')}</pre>`;
      break;
    case 'css':
      content.innerHTML = `<pre class="code-view">${escapeHtml(files['style.css'] || files['main.css'] || '')}</pre>`;
      break;
    case 'js':
      content.innerHTML = `<pre class="code-view">${escapeHtml(files['script.js'] || files['main.js'] || '')}</pre>`;
      break;
    case 'console':
      content.innerHTML = '<div id="consoleOutput" class="console-view"></div>';
      break;
  }
}

// Clear project
function clearProject() {
  if (confirm('Clear all files?')) {
    files = {};
    currentFile = null;
    localStorage.removeItem('ai-files');
    renderFileList();
    showToast('Project cleared');
  }
}
