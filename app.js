// AI App - Fast & Powerful (No Auth Required)
const API = 'https://nebula-api-production.up.railway.app';
let currentProject = 'default';
let files = {};
let chat = [];
let settings = { model: 'auto', temp: 0.7, autoPreview: true };

// DOM
const $ = id => document.getElementById(id);
const leftPanel = $('leftPanel');
const rightPanel = $('rightPanel');
const chatMessages = $('chatMessages');
const chatInput = $('chatInput');
const previewFrame = $('previewFrame');
const fileTree = $('fileTree');

// Panel toggles
function toggleLeft() { leftPanel.classList.toggle('open'); }
function toggleRight() { rightPanel.classList.toggle('open'); }
function expandPreview() { rightPanel.classList.toggle('expanded'); }

// Settings
function openSettings() { $('settingsModal').classList.add('open'); }
function closeSettings() { $('settingsModal').classList.remove('open'); }
function saveSettings() {
  settings.model = $('modelSelect').value;
  settings.temp = parseFloat($('tempSlider').value);
  settings.autoPreview = $('autoPreview').checked;
  localStorage.setItem('ai-settings', JSON.stringify(settings));
  closeSettings();
}

// Import
function openImport() { $('importModal').classList.add('open'); }
function closeImport() { $('importModal').classList.remove('open'); }
async function importFiles(input) {
  const fileList = input.files;
  for (const file of fileList) {
    if (file.name.endsWith('.zip')) {
      // Handle ZIP
      const zip = await JSZip.loadAsync(file);
      for (const [path, zipFile] of Object.entries(zip.files)) {
        if (!zipFile.dir) {
          files[path] = await zipFile.async('string');
        }
      }
    } else {
      files[file.name] = await file.text();
    }
  }
  renderFiles();
  closeImport();
  addMessage('system', `Imported ${Object.keys(files).length} files`);
}

async function importFromGithub() {
  const url = $('githubUrl').value.trim();
  if (!url) return;
  addMessage('system', 'Importing from GitHub...');
  // Parse GitHub URL and fetch
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (match) {
    try {
      const [, owner, repo] = match;
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents`);
      const contents = await res.json();
      for (const item of contents) {
        if (item.type === 'file') {
          const fileRes = await fetch(item.download_url);
          files[item.name] = await fileRes.text();
        }
      }
      renderFiles();
      addMessage('system', `Imported ${Object.keys(files).length} files from ${repo}`);
    } catch (e) {
      addMessage('system', 'Failed to import from GitHub');
    }
  }
  closeImport();
}

// Export
function exportProject() {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
  }
  zip.generateAsync({ type: 'blob' }).then(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${currentProject}.zip`;
    a.click();
  });
}

// Deploy
function openDeploy() { $('deployModal').classList.add('open'); }
function closeDeploy() { $('deployModal').classList.remove('open'); }
async function deployTo(platform) {
  addMessage('system', `Deploying to ${platform}...`);
  closeDeploy();
  
  try {
    const res = await fetch(`${API}/api/deploy/${platform}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files, projectName: currentProject })
    });
    const data = await res.json();
    if (data.url) {
      addMessage('system', `✅ Deployed! ${data.url}`);
    } else {
      addMessage('system', `Deploy failed: ${data.error || 'Unknown error'}`);
    }
  } catch (e) {
    addMessage('system', `Deploy error: ${e.message}`);
  }
}

// Files
function renderFiles() {
  fileTree.innerHTML = Object.keys(files).map(name => `
    <div class="file-item" onclick="openFile('${name}')">
      <span class="file-icon">${getIcon(name)}</span>
      <span class="file-name">${name}</span>
      <span class="file-delete" onclick="event.stopPropagation();deleteFile('${name}')">×</span>
    </div>
  `).join('');
}

function getIcon(name) {
  if (name.endsWith('.html')) return '📄';
  if (name.endsWith('.css')) return '🎨';
  if (name.endsWith('.js')) return '⚡';
  if (name.endsWith('.json')) return '📋';
  if (name.endsWith('.md')) return '📝';
  return '📄';
}

function openFile(name) {
  const content = files[name];
  addMessage('system', `**${name}**\n\`\`\`${name.split('.').pop()}\n${content}\n\`\`\``);
}

function deleteFile(name) {
  delete files[name];
  renderFiles();
}

function newFile() {
  const name = prompt('File name:');
  if (name) {
    files[name] = '';
    renderFiles();
  }
}

// Chat
function addMessage(role, content) {
  chat.push({ role, content });
  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.innerHTML = formatMessage(content);
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  // Extract code blocks to files
  if (role === 'assistant' && settings.autoPreview) {
    extractAndPreview(content);
  }
}

function formatMessage(text) {
  // Code blocks
  text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="lang-${lang || 'text'}">${escapeHtml(code.trim())}</code></pre>`;
  });
  // Inline code
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Links
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  // Line breaks
  text = text.replace(/\n/g, '<br>');
  return text;
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function extractAndPreview(content) {
  const codeBlocks = content.matchAll(/```(\w+)?\n([\s\S]*?)```/g);
  let html = '', css = '', js = '';
  
  for (const [, lang, code] of codeBlocks) {
    if (lang === 'html' || lang === 'HTML') {
      html = code.trim();
      files['index.html'] = html;
    } else if (lang === 'css' || lang === 'CSS') {
      css = code.trim();
      files['style.css'] = css;
    } else if (lang === 'javascript' || lang === 'js' || lang === 'JS') {
      js = code.trim();
      files['script.js'] = js;
    }
  }
  
  if (html || css || js) {
    renderFiles();
    updatePreview();
    if (!rightPanel.classList.contains('open')) {
      toggleRight();
    }
  }
}

function updatePreview() {
  const html = files['index.html'] || '';
  const css = files['style.css'] || '';
  const js = files['script.js'] || '';
  
  const doc = `<!DOCTYPE html>
<html>
<head><style>${css}</style></head>
<body>${html}<script>${js}<\/script></body>
</html>`;
  
  previewFrame.srcdoc = doc;
}

// Preview tabs
function showPreviewTab(tab) {
  document.querySelectorAll('.preview-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`[onclick="showPreviewTab('${tab}')"]`).classList.add('active');
  
  if (tab === 'live') {
    previewFrame.style.display = 'block';
    $('codePreview').style.display = 'none';
  } else {
    previewFrame.style.display = 'none';
    $('codePreview').style.display = 'block';
    const ext = { html: 'index.html', css: 'style.css', js: 'script.js' }[tab];
    $('codePreview').textContent = files[ext] || `// No ${tab} file`;
  }
}

// Send message
async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;
  
  addMessage('user', text);
  chatInput.value = '';
  
  // Show typing indicator
  const typing = document.createElement('div');
  typing.className = 'message assistant typing';
  typing.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
  chatMessages.appendChild(typing);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  try {
    const res = await fetch(`${API}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        context: Object.entries(files).map(([n, c]) => `File: ${n}\n${c}`).join('\n\n'),
        model: settings.model,
        temperature: settings.temp
      })
    });
    
    typing.remove();
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Request failed');
    }
    
    const data = await res.json();
    addMessage('assistant', data.response || data.message || 'No response');
  } catch (e) {
    typing.remove();
    addMessage('system', `Error: ${e.message}`);
  }
}

// Attachments
function attachFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.onchange = async (e) => {
    for (const file of e.target.files) {
      const content = await file.text();
      files[file.name] = content;
      addMessage('system', `Attached: ${file.name}`);
    }
    renderFiles();
  };
  input.click();
}

// Keyboard shortcuts
chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); toggleLeft(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'p') { e.preventDefault(); toggleRight(); }
});

// Init
window.onload = () => {
  const saved = localStorage.getItem('ai-settings');
  if (saved) settings = JSON.parse(saved);
  addMessage('system', '**Welcome to AI** — Your intelligent coding assistant. Ask me to build anything!');
};
