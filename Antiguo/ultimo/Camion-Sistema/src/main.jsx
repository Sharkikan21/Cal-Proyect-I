// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import.meta.glob('./styles/*.css', { eager: true });

import { RouterProvider } from 'react-router-dom'
import { createAppRouter } from './router/index.jsx'
import { AuthProvider } from './context/AuthContext.jsx'

const isElectron = !!(window && window.env)
const router = createAppRouter(isElectron)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>
)
