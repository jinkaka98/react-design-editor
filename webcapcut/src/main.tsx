import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './ui/components/ErrorBoundary'
import { ToastProvider, ToastConnector } from './ui/components/Toast'

// NOTE: StrictMode disabled for WebGPU/WebCodecs compatibility
// StrictMode causes double-mounting which breaks GPU context initialization
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <ToastProvider>
      <ToastConnector />
      <App />
    </ToastProvider>
  </ErrorBoundary>,
)
