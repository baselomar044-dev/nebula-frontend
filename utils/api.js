// ============================================
// NEBULA AI - API Client
// ============================================

const API = {
  get baseUrl() {
    // Use CONFIG if available, otherwise fallback to relative path
    if (typeof CONFIG !== 'undefined' && CONFIG.API_URL) {
      return CONFIG.API_URL + '/api';
    }
    return '/api';
  },
  token: null,

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include'
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }
    
    return data;
  },

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('nebula_token', token);
    } else {
      localStorage.removeItem('nebula_token');
    }
  },

  loadToken() {
    this.token = localStorage.getItem('nebula_token');
    return this.token;
  },

  // Auth
  async register(email, password, name) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name })
    });
  },

  async login(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },

  async getMe() {
    return this.request('/auth/me');
  },

  async updateProfile(data) {
    return this.request('/auth/me', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async saveApiKey(provider, key) {
    return this.request('/auth/api-keys', {
      method: 'POST',
      body: JSON.stringify({ provider, key })
    });
  },

  async getApiKeys() {
    return this.request('/auth/api-keys');
  },

  // Projects
  async getProjects() {
    return this.request('/projects');
  },

  async createProject(data) {
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async getProject(id) {
    return this.request(`/projects/${id}`);
  },

  async updateProject(id, data) {
    return this.request(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteProject(id) {
    return this.request(`/projects/${id}`, {
      method: 'DELETE'
    });
  },

  async importProject(file, name) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', name);
    
    const response = await fetch(`${this.baseUrl}/projects/import`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`
      },
      body: formData,
      credentials: 'include'
    });
    
    return response.json();
  },

  getExportUrl(projectId) {
    return `${this.baseUrl}/projects/${projectId}/export?token=${this.token}`;
  },

  // Files
  async getFile(projectId, fileId) {
    return this.request(`/files/${projectId}/${fileId}`);
  },

  async saveFile(projectId, path, content, mimeType) {
    return this.request(`/files/${projectId}`, {
      method: 'POST',
      body: JSON.stringify({ path, content, mimeType })
    });
  },

  async uploadFile(projectId, file, path) {
    const formData = new FormData();
    formData.append('file', file);
    if (path) formData.append('path', path);
    
    const response = await fetch(`${this.baseUrl}/files/${projectId}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`
      },
      body: formData,
      credentials: 'include'
    });
    
    return response.json();
  },

  async deleteFile(projectId, fileId) {
    return this.request(`/files/${projectId}/${fileId}`, {
      method: 'DELETE'
    });
  },

  // AI
  async chat(projectId, message, files, model) {
    return this.request('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ projectId, message, files, model })
    });
  },

  async getModels() {
    return this.request('/ai/models');
  },

  async analyzeProject(projectId) {
    return this.request('/ai/analyze', {
      method: 'POST',
      body: JSON.stringify({ projectId })
    });
  },

  // Deploy
  async deploy(projectId, platform) {
    return this.request(`/deploy/${projectId}`, {
      method: 'POST',
      body: JSON.stringify({ platform })
    });
  },

  async getDeploymentStatus(deploymentId) {
    return this.request(`/deploy/status/${deploymentId}`);
  }
};

// Export for modules
if (typeof module !== 'undefined') {
  module.exports = API;
}
