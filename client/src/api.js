import axios from 'axios'

// In dev, Vite proxies /api to localhost:4000 (see vite.config.js), so a
// relative baseURL works with no env var. In production the frontend and
// backend are separate deployed services, so VITE_API_URL must point at the
// backend's real URL (set at build time — Vite bakes it into the bundle).
const rawApiUrl = import.meta.env.VITE_API_URL
const baseURL = rawApiUrl
  ? `${rawApiUrl.startsWith('http') ? rawApiUrl : `https://${rawApiUrl}`}`.replace(/\/$/, '') + '/api'
  : '/api'

const api = axios.create({ baseURL })

api.interceptors.request.use(config => {
  const token = localStorage.getItem('pos_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('pos_token')
      localStorage.removeItem('pos_user')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api
