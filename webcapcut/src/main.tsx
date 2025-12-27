import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// NOTE: StrictMode disabled for WebGPU/WebCodecs compatibility
// StrictMode causes double-mounting which breaks GPU context initialization
createRoot(document.getElementById('root')!).render(
  <App />,
)
