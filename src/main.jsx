import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './i18n/index.js'
import './styles/theme.css'
import './styles/tailwind.css'
import './styles/globals.css'
import './styles/liquid-nav.css'
// Imported last on purpose: polish.css wins source-order ties inside
// @layer components so its hover/motion/focus additions apply everywhere.
import './styles/polish.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
