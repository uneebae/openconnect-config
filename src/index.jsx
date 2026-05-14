import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Dismiss loading splash
const splash = document.getElementById('oc-splash');
if (splash) splash.classList.add('hide');
setTimeout(() => splash?.remove(), 500);

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
