

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './Styles/index.css'
import 'leaflet/dist/leaflet.css'
import MainLayout from './Header.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MainLayout />
  </StrictMode>,
)