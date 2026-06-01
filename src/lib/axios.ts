import axios from 'axios'

// Create a pre-configured Axios instance
export const api = axios.create({
  baseURL: 'https://jsonplaceholder.typicode.com',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Optional: Add request/response interceptors
api.interceptors.request.use(
  (config) => {
    // You can add headers here, e.g., auth tokens
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Global API error handler
    console.error('API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

export default api
