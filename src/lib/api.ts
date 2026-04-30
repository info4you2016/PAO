const API_BASE = '/api';

export const api = {
  auth: {
    login: async (data: any) => {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    register: async (data: any) => {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
  },
  users: {
    get: async (id: string) => {
      const res = await fetch(`${API_BASE}/users/${id}`);
      return res.json();
    },
  },
  presentations: {
    getAll: async (ownerId: string) => {
      const res = await fetch(`${API_BASE}/presentations?ownerId=${ownerId}`);
      return res.json();
    },
    getOne: async (id: string) => {
      const res = await fetch(`${API_BASE}/presentations/${id}`);
      return res.json();
    },
    create: async (data: any) => {
      const res = await fetch(`${API_BASE}/presentations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    update: async (id: string, data: any) => {
      const res = await fetch(`${API_BASE}/presentations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    delete: async (id: string) => {
      const res = await fetch(`${API_BASE}/presentations/${id}`, {
        method: 'DELETE',
      });
      return res.json();
    },
    getSlides: async (presentationId: string) => {
      const res = await fetch(`${API_BASE}/presentations/${presentationId}/slides`);
      return res.json();
    },
    addSlide: async (presentationId: string, data: any) => {
      const res = await fetch(`${API_BASE}/presentations/${presentationId}/slides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    batchAddSlides: async (presentationId: string, slides: any[]) => {
      const res = await fetch(`${API_BASE}/presentations/${presentationId}/slides/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slides }),
      });
      return res.json();
    },
  },
  slides: {
    update: async (id: string, data: any) => {
      const res = await fetch(`${API_BASE}/slides/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    delete: async (id: string) => {
      const res = await fetch(`${API_BASE}/slides/${id}`, {
        method: 'DELETE',
      });
      return res.json();
    },
  },
};
