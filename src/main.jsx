

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './Styles/index.css'
import 'leaflet/dist/leaflet.css'
import App from './AboutUs.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
