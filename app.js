// AI App - Fast & Powerful
const API = 'https://nebula-api-production.up.railway.app';
let token = localStorage.getItem('token');
let files = {};
let currentFile = null;
let attachments = [];
let settings = JSON.parse(localStorage.getItem('settings')||'{"model":"claude","temp":0.7,"autoRun":true}');
let projects = JSON.parse(localStorage.getItem('projects')||'{}');
let currentProject = localStorage.getItem('currentProject')||'default';

// Initialize
document.addEventListener('DOMContentLoaded', init);

function init() {
  loadSettings();
  loadProjects();
  loadFiles();
  setupInput();
  showWelcome();
  // Auto-show panels on desktop
  if(window.innerWidth > 900) {
    document.getElementById('preview').classList.remove('hide');
  }
}

// Panel toggle
function toggle(id) {
  document.getElementById(id==='files'?'files':'preview').classList.toggle('hide');
}

// Modal
function modal(id) {
  document.getElementById(id).classList.toggle('show');
}

// Settings
function loadSettings() {
  document.getElementById('model').value = settings.model;
  document.getElementById('temp').value = settings.temp;
  document.getElementById('autoRun').checked = settings.autoRun;
}

function saveSettings() {
  settings = {
    model: document.getElementById('model').value,
    temp: parseFloat(document.getElementById('temp').value),
    autoRun: document.getElementById('autoRun').checked
  };
  localStorage.setItem('settings', JSON.stringify(settings));
  modal('settings');
}

// Projects
function loadProjects() {
  const sel = document.getElementById('projectSelect');
  sel.innerHTML = '<option value="new">+ New Project</option>';
  Object.keys(projects).forEach(p => {
    sel.innerHTML += `<option value="${p}" ${p===currentProject?'selected':''}>${p}</option>`;
  });
}

function loadProject(name) {
  if(name === 'new') {
    const n = prompt('Project name:');
    if(n) {
      currentProject = n;
      projects[n] = {};
      files = {};
      localStorage.setItem('projects', JSON.stringify(projects));
      localStorage.setItem('currentProject', n);
      loadProjects();
      loadFiles();
    }
    return;
  }
  currentProject = name;
  files = projects[name] || {};
  localStorage.setItem('currentProject', name);
  renderTree();
  runPreview();
}

function saveProject() {
  projects[currentProject] = files;
  localStorage.setItem('projects', JSON.stringify(projects));
}

// Files
function loadFiles() {
  files = projects[currentProject] || {};
  renderTree();
}

function renderTree() {
  const tree = document.getElementById('tree');
  tree.innerHTML = '';
  const sorted = Object.keys(files).sort();
  sorted.forEach(name => {
    const div = document.createElement('div');
    div.className = 'file' + (name === currentFile ? ' active' : '');
    div.innerHTML = `<span>${getIcon(name)}</span><span>${name}</span>`;
    div.onclick = () => openFile(name);
    div.oncontextmenu = (e) => { e.preventDefault(); deleteFile(name); };
    tree.appendChild(div);
  });
}

function getIcon(name) {
  if(name.endsWith('.html')) return '🌐';
  if(name.endsWith('.css')) return '🎨';
  if(name.endsWith('.js')) return '⚡';
  if(name.endsWith('.json')) return '📋';
  if(name.endsWith('.md')) return '📝';
  return '📄';
}

function newFile() {
  const name = prompt('File name (e.g., index.html):');
  if(name) {
    files[name] = '';
    saveProject();
    renderTree();
    openFile(name);
  }
}

function newFolder() {
  alert('Create files with paths like: folder/file.html');
}

function openFile(name) {
  currentFile = name;
  document.getElementById('editName').textContent = name;
  document.getElementById('code').value = files[name];
  renderTree();
  modal('editor');
}

function saveFile() {
  if(currentFile) {
    files[currentFile] = document.getElementById('code').value;
    saveProject();
    modal('editor');
    if(settings.autoRun) runPreview();
  }
}

function deleteFile(name) {
  if(confirm(`Delete ${name}?`)) {
    delete files[name];
    saveProject();
    renderTree();
    runPreview();
  }
}

// Input handling
function setupInput() {
  const input = document.getElementById('input');
  input.addEventListener('keydown', e => {
    if(e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 150) + 'px';
  });
}

// Attachments
function attach(fileList) {
  Array.from(fileList).forEach(f => {
    const reader = new FileReader();
    reader.onload = e => {
      attachments.push({ name: f.name, data: e.target.result });
      renderAttachments();
    };
    reader.readAsDataURL(f);
  });
}

function renderAttachments() {
  const list = document.getElementById('attachList');
  list.innerHTML = attachments.map((a, i) => 
    `<div class="att">${a.name}<button onclick="removeAttach(${i})">×</button></div>`
  ).join('');
}

function removeAttach(i) {
  attachments.splice(i, 1);
  renderAttachments();
}

// Messages
function showWelcome() {
  const msgs = document.getElementById('msgs');
  msgs.innerHTML = `
    <div class="welcome">
      <h2>What do you want to build?</h2>
      <p>Describe your project and I'll code it for you.</p>
      <div class="prompts">
        <button onclick="setPrompt('Build a modern landing page with hero, features, and contact form')">Landing Page</button>
        <button onclick="setPrompt('Create a todo app with add, edit, delete, and localStorage')">Todo App</button>
        <button onclick="setPrompt('Build a calculator with all basic operations')">Calculator</button>
        <button onclick="setPrompt('Create a weather app that fetches real data')">Weather App</button>
      </div>
    </div>
  `;
}

function setPrompt(text) {
  document.getElementById('input').value = text;
  document.getElementById('input').focus();
}

function addMessage(role, content) {
  const msgs = document.getElementById('msgs');
  if(msgs.querySelector('.welcome')) msgs.innerHTML = '';
  
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  
  if(role === 'ai') {
    div.innerHTML = parseContent(content);
    div.querySelectorAll('pre').forEach(pre => {
      const code = pre.querySelector('code');
      if(code) {
        const lang = code.className.replace('language-', '');
        pre.innerHTML = `<span class="lang">${lang}</span><button class="copy" onclick="copyCode(this)">Copy</button>` + pre.innerHTML;
      }
    });
  } else {
    div.textContent = content;
  }
  
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

function parseContent(text) {
  // Parse code blocks
  text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="language-${lang||'text'}">${escapeHtml(code.trim())}</code></pre>`;
  });
  // Parse inline code
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Parse bold
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Parse links
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  // Parse newlines
  text = text.replace(/\n/g, '<br>');
  return text;
}

function escapeHtml(text) {
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function copyCode(btn) {
  const code = btn.parentElement.querySelector('code').textContent;
  navigator.clipboard.writeText(code);
  btn.textContent = 'Copied!';
  setTimeout(() => btn.textContent = 'Copy', 1500);
}

// Send message
async function send() {
  const input = document.getElementById('input');
  const text = input.value.trim();
  if(!text) return;
  
  input.value = '';
  input.style.height = 'auto';
  addMessage('user', text);
  
  const typing = addMessage('ai', 'Thinking...');
  typing.classList.add('typing');
  
  try {
    const res = await fetch(`${API}/api/ai/chat`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        message: text,
        model: settings.model,
        temperature: settings.temp,
        files: Object.keys(files).length ? files : undefined,
        attachments: attachments.length ? attachments : undefined
      })
    });
    
    const data = await res.json();
    typing.remove();
    
    if(data.error) {
      addMessage('ai', `Error: ${data.error}`);
      return;
    }
    
    addMessage('ai', data.response || data.message);
    
    // Extract and save files from response
    extractFiles(data.response || data.message);
    
    // Clear attachments
    attachments = [];
    renderAttachments();
    
  } catch(err) {
    typing.remove();
    addMessage('ai', `Connection error: ${err.message}`);
  }
}

// Extract code files from AI response
function extractFiles(response) {
  const codeBlocks = response.matchAll(/```(\w+)\n([\s\S]*?)```/g);
  let hasHtml = false, hasCss = false, hasJs = false;
  
  for(const match of codeBlocks) {
    const lang = match[1].toLowerCase();
    const code = match[2].trim();
    
    if(lang === 'html' && !hasHtml) {
      files['index.html'] = code;
      hasHtml = true;
    } else if(lang === 'css' && !hasCss) {
      files['style.css'] = code;
      hasCss = true;
    } else if((lang === 'javascript' || lang === 'js') && !hasJs) {
      files['script.js'] = code;
      hasJs = true;
    }
  }
  
  if(hasHtml || hasCss || hasJs) {
    saveProject();
    renderTree();
    if(settings.autoRun) runPreview();
  }
}

// Preview
function runPreview() {
  const html = files['index.html'] || '';
  const css = files['style.css'] || '';
  const js = files['script.js'] || '';
  
  let content = html;
  
  // Inject CSS if not linked
  if(css && !html.includes('style.css')) {
    content = content.replace('</head>', `<style>${css}</style></head>`);
  }
  
  // Inject JS if not linked
  if(js && !html.includes('script.js')) {
    content = content.replace('</body>', `<script>${js}<\/script></body>`);
  }
  
  // Console capture
  const consoleCapture = `<script>
    const log=console.log,err=console.error;
    console.log=(...a)=>{log(...a);parent.postMessage({type:'log',data:a.join(' ')},'*')};
    console.error=(...a)=>{err(...a);parent.postMessage({type:'error',data:a.join(' ')},'*')};
    window.onerror=(m)=>parent.postMessage({type:'error',data:m},'*');
  <\/script>`;
  
  content = content.replace('<head>', '<head>' + consoleCapture);
  
  const frame = document.getElementById('frame');
  frame.srcdoc = content;
  
  // Show preview panel
  document.getElementById('preview').classList.remove('hide');
}

// Preview tabs
function showTab(tab) {
  document.querySelectorAll('.preview-tabs button').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  
  document.getElementById('frame').style.display = tab === 'frame' ? 'block' : 'none';
  document.getElementById('codeView').style.display = ['html','css','js'].includes(tab) ? 'block' : 'none';
  document.getElementById('log').style.display = tab === 'log' ? 'block' : 'none';
  
  if(tab === 'html') document.getElementById('codeView').textContent = files['index.html'] || '';
  if(tab === 'css') document.getElementById('codeView').textContent = files['style.css'] || '';
  if(tab === 'js') document.getElementById('codeView').textContent = files['script.js'] || '';
}

// Console log capture
window.addEventListener('message', e => {
  if(e.data.type === 'log' || e.data.type === 'error') {
    const log = document.getElementById('log');
    const color = e.data.type === 'error' ? '#f66' : '#0f0';
    log.innerHTML += `<div style="color:${color}">${escapeHtml(e.data.data)}</div>`;
  }
});

// Expand preview
function expand() {
  document.getElementById('preview').classList.toggle('expanded');
}

// Fullscreen preview
function toggleFullscreen() {
  const html = files['index.html'] || '';
  const css = files['style.css'] || '';
  const js = files['script.js'] || '';
  
  let content = html;
  if(css && !html.includes('style.css')) content = content.replace('</head>', `<style>${css}</style></head>`);
  if(js && !html.includes('script.js')) content = content.replace('</body>', `<script>${js}<\/script></body>`);
  
  document.getElementById('fullFrame').srcdoc = content;
  modal('full');
}

// Alias for expand button
window.expand = function() {
  document.getElementById('preview').classList.toggle('expanded');
};

// Export
async function exportAll() {
  const zip = new JSZip();
  Object.entries(files).forEach(([name, content]) => {
    zip.file(name, content);
  });
  const blob = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${currentProject}.zip`;
  a.click();
}

// Import ZIP
async function importZip(file) {
  const zip = await JSZip.loadAsync(file);
  for(const [name, entry] of Object.entries(zip.files)) {
    if(!entry.dir) {
      files[name] = await entry.async('string');
    }
  }
  saveProject();
  renderTree();
  runPreview();
  modal('import');
}

// Import files
function importFiles(fileList) {
  Array.from(fileList).forEach(f => {
    const reader = new FileReader();
    reader.onload = e => {
      files[f.name] = e.target.result;
      saveProject();
      renderTree();
      if(settings.autoRun) runPreview();
    };
    reader.readAsText(f);
  });
  modal('import');
}

// Import GitHub
async function importGH() {
  const url = document.getElementById('ghUrl').value.trim();
  if(!url) return;
  
  try {
    // Parse GitHub URL
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if(!match) throw new Error('Invalid GitHub URL');
    
    const [_, owner, repo] = match;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents`;
    
    const res = await fetch(apiUrl);
    const items = await res.json();
    
    for(const item of items) {
      if(item.type === 'file' && /\.(html|css|js|json|md)$/.test(item.name)) {
        const fileRes = await fetch(item.download_url);
        files[item.name] = await fileRes.text();
      }
    }
    
    saveProject();
    renderTree();
    runPreview();
    modal('import');
  } catch(err) {
    alert('Import failed: ' + err.message);
  }
}

// Deploy
async function doDeploy() {
  const platform = document.getElementById('platform').value;
  const name = document.getElementById('deployName').value.trim() || currentProject;
  const out = document.getElementById('deployOut');
  
  out.innerHTML = 'Deploying...';
  
  try {
    const res = await fetch(`${API}/api/deploy`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ platform, name, files })
    });
    
    const data = await res.json();
    
    if(data.error) {
      out.innerHTML = `<span style="color:#f66">Error: ${data.error}</span>`;
    } else if(data.url) {
      out.innerHTML = `✅ Deployed! <a href="${data.url}" target="_blank">${data.url}</a>`;
    } else {
      out.innerHTML = `✅ ${data.message || 'Deploy initiated'}`;
    }
  } catch(err) {
    out.innerHTML = `<span style="color:#f66">Error: ${err.message}</span>`;
  }
}

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if((e.ctrlKey || e.metaKey) && e.key === 'b') {
    e.preventDefault();
    toggle('files');
  }
  if((e.ctrlKey || e.metaKey) && e.key === 'p') {
    e.preventDefault();
    toggle('preview');
  }
  if((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    if(document.getElementById('editor').classList.contains('show')) {
      saveFile();
    }
  }
});
