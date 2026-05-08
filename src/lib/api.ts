const API_BASE = (typeof window !== 'undefined' ? window.location.origin : '') + '/api';

async function handleResponse(res: Response) {
  if (!res.ok) {
    let errorMessage = `Error: ${res.status}`;
    try {
      const errorData = await res.json();
      errorMessage = errorData.error || errorMessage;
    } catch (e) {
      // Fallback for non-JSON error responses
    }
    throw new Error(errorMessage);
  }
  
  // Handle empty successful responses (e.g. 204 No Content)
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return res.json();
  }
  return null;
}

export const api = {
  fetch: async (path: string, options: any = {}) => {
    const API_URL = `${API_BASE}${path}`;
    console.log(`Fetching: ${API_URL}`);
    const res = await fetch(API_URL, options);
    return handleResponse(res);
  },
  auth: {
    login: async (data: any) => {
      return api.fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
    register: async (data: any) => {
      return api.fetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
  },
  users: {
    get: async (id: string) => {
      return api.fetch(`/users/${id}`);
    },
  },
  presentations: {
    getAll: async (ownerId: string) => {
      return api.fetch(`/presentations?ownerId=${ownerId}`);
    },
    getOne: async (id: string) => {
      return api.fetch(`/presentations/${id}`);
    },
    create: async (data: any) => {
      return api.fetch('/presentations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
    update: async (id: string, data: any) => {
      return api.fetch(`/presentations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
    delete: async (id: string) => {
      return api.fetch(`/presentations/${id}`, {
        method: 'DELETE',
      });
    },
    getSlides: async (presentationId: string) => {
      return api.fetch(`/presentations/${presentationId}/slides`);
    },
    addSlide: async (presentationId: string, data: any) => {
      return api.fetch(`/presentations/${presentationId}/slides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
    batchAddSlides: async (presentationId: string, slides: any[]) => {
      return api.fetch(`/presentations/${presentationId}/slides/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slides }),
      });
    },
  },
  slides: {
    update: async (id: string, data: any) => {
      return api.fetch(`/slides/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
    delete: async (id: string) => {
      return api.fetch(`/slides/${id}`, {
        method: 'DELETE',
      });
    },
    reorder: async (orders: { id: string, order: number }[]) => {
      return api.fetch('/slides/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders }),
      });
    },
  },
  qa: {
    get: async (slideId: string) => {
      return api.fetch(`/slides/${slideId}/qa`);
    },
    post: async (slideId: string, data: any) => {
      return api.fetch(`/slides/${slideId}/qa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
    vote: async (id: string) => {
      return api.fetch(`/qa/${id}/vote`, {
        method: 'POST',
      });
    },
    answer: async (id: string) => {
      return api.fetch(`/qa/${id}/answer`, {
        method: 'POST',
      });
    },
    clear: async (slideId: string) => {
      return api.fetch(`/slides/${slideId}/qa`, {
        method: 'DELETE',
      });
    },
  },
  themes: {
    getAll: async () => {
      return api.fetch('/themes');
    },
    create: async (data: any) => {
      return api.fetch('/themes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
    update: async (id: string, data: any) => {
      return api.fetch(`/themes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },
    delete: async (id: string) => {
      return api.fetch(`/themes/${id}`, {
        method: 'DELETE',
      });
    },
  },
};
