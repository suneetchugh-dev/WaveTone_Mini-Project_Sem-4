// In dev, Vite proxy handles /api → localhost:5000
// In production, set VITE_API_URL to your Railway backend URL
const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

async function request(path, options = {}) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      const errorObj = new Error(err.error || 'Request failed');
      errorObj.field = err.field; // preserve field flag for frontend validation highlighting
      throw errorObj;
    }
    return await res.json();
  } catch (err) {
    if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
      throw new Error('WaveTone server is offline or unreachable. Please check your internet connection or try again shortly.');
    }
    throw err;
  }
}

export const getRooms = () => request('/rooms');

export const getRoomById = (id) => request(`/rooms/${id}`);

export const createRoom = (data) =>
  request('/rooms', { method: 'POST', body: JSON.stringify(data) });

export const joinRoom = (id, data) =>
  request(`/rooms/${id}/join`, { method: 'POST', body: JSON.stringify(data) });

export const leaveRoom = (id, data) =>
  request(`/rooms/${id}/leave`, { method: 'POST', body: JSON.stringify(data) });

export const getSessionSummary = (id) => request(`/sessions/${id}/summary`);

export const getAISummary = (id, data) =>
  request(`/sessions/${id}/ai-summary`, { method: 'POST', body: JSON.stringify(data) });
