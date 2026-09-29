import api from './client'

export const authApi = {
  login: (username, password) =>
    api.post('/auth/login/', { username, password }),
  refresh: (refresh) =>
    api.post('/auth/refresh/', { refresh }),
  me: () => api.get('/auth/me/'),
  logout: (refresh) =>
    api.post('/auth/logout/', { refresh }),
}

export const groupsApi = {
  list: () => api.get('/groups/'),
  create: (data) => api.post('/groups/', data),
  update: (id, data) => api.patch(`/groups/${id}/`, data),
  delete: (id) => api.delete(`/groups/${id}/`),
  getDocuments: (id) => api.get(`/groups/${id}/documents/`),
  updateDocuments: (id, documents) => api.post(`/groups/${id}/documents/`, { documents }),
}

export const usersApi = {
  list: (params) => api.get('/users/', { params }),
  create: (data) => api.post('/users/', data),
  update: (id, data) => api.patch(`/users/${id}/`, data),
  delete: (id) => api.delete(`/users/${id}/`),
  activate: (id) => api.patch(`/users/${id}/activate/`),
  resetPassword: (id, password) => api.post(`/users/${id}/reset-password/`, { password }),
}

export const documentsApi = {
  list: (params) => api.get('/documents/', { params }),
  upload: (formData) =>
    api.post('/documents/upload/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  detail: (id) => api.get(`/documents/${id}/`),
  update: (id, data) => api.patch(`/documents/${id}/`, data),
  delete: (id) => api.delete(`/documents/${id}/`),
  status: (id) => api.get(`/documents/${id}/status/`),
  serveUrl: (id) => `/api/documents/${id}/serve/`,
}

export const chatApi = {
  send: (question, conversation_id) => api.post('/chat/', { question, conversation_id }),
  history: (params) => api.get('/chat/history/', { params }),
  listConversations: () => api.get('/chat/conversations/'),
  createConversation: (title) => api.post('/chat/conversations/', { title }),
  getConversation: (id) => api.get(`/chat/conversations/${id}/`),
  deleteConversation: (id) => api.delete(`/chat/conversations/${id}/`),
}
