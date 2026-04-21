const API_BASE = '/api';

async function request(path: string, options: RequestInit = {}) {
  const isFormData = options.body instanceof FormData;
  
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(localStorage.getItem('token') ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!response.ok) {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const error = await response.json();
      throw new Error(error.error || error.message || `Request failed with status ${response.status}`);
    } else {
      const text = await response.text();
      console.error('Server error response:', text);
      throw new Error(`Server returned error ${response.status}. This usually means the API route was not found or the server crashed.`);
    }
  }
  return response.json();
}

export const api = {
  get: (path: string) => request(path, { method: 'GET' }),
  post: (path: string, body: any) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path: string, body: any) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: (path: string) => request(path, { method: 'DELETE' }),

  auth: {
    login: (body: any) => request('/login', { method: 'POST', body: JSON.stringify(body) }),
  },
  dashboard: {
    getStats: () => request('/dashboard/stats'),
    getHealth: () => request('/health'),
  },
  services: {
    list: () => request('/services'),
    get: (id: string) => request(`/services/${id}`),
    update: (id: string, body: any) => request(`/services/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  },
  questions: {
    list: () => request('/questions'),
    create: (body: any) => request('/questions', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: any) => request(`/questions/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: string) => request(`/questions/${id}`, { method: 'DELETE' }),
  },
  scoring: {
    components: () => request('/scoring/components'),
    rules: () => request('/scoring/rules'),
    updateRule: (id: string, body: any) => request(`/scoring/rules/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    bands: () => request('/scoring/bands'),
    thresholds: () => request('/scoring/thresholds'),
    updateThreshold: (id: string, body: any) => request(`/scoring/thresholds/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  },
  playbooks: {
    list: () => request('/playbooks'),
    update: (id: string, body: any) => request(`/playbooks/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  },
  rankings: {
    list: () => request('/rankings'),
    update: (id: string, body: any) => request(`/rankings/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  },
  escalation: {
    list: () => request('/escalation'),
    update: (id: string, body: any) => request(`/escalation/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  },
  leads: {
    list: () => request('/leads'),
  },
  proposalGates: {
    list: () => request('/proposal-gates'),
    update: (id: string, body: any) => request(`/proposal-gates/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  },
  objections: {
    list: () => request('/objections'),
    update: (id: string, body: any) => request(`/objections/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  },
  versions: {
    list: () => request('/versions'),
    publish: (version_tag: string) => request('/versions/publish', { method: 'POST', body: JSON.stringify({ version_tag }) }),
  },
  overrides: {
    list: () => request('/overrides'),
  },
  caseStudies: {
    list: () => request('/case-studies'),
    update: (id: string, body: any) => request(`/case-studies/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  },
  crmFields: {
    list: () => request('/crm-fields'),
  },
  chunker: {
    process: (files: File[]) => {
      const formData = new FormData();
      files.forEach(file => formData.append('docs', file));
      return request('/chunker', { method: 'POST', body: formData });
    }
  },
  qdrant: {
    ingest: (chunks: any[]) => request('/qdrant/ingest', { method: 'POST', body: JSON.stringify({ chunks }) }),
    search: (query: string, limit?: number) => request('/qdrant/search', { method: 'POST', body: JSON.stringify({ query, limit }) }),
    getHealth: () => request('/qdrant/health'),
  },
  llm: {
    complete: (prompt: string, systemInstruction?: string) => 
      request('/llm/complete', { 
        method: 'POST', 
        body: JSON.stringify({ prompt, systemInstruction }) 
      }),
  }
};
