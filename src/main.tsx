import '@fontsource/teko/600.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './App.css'
import './themes.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)