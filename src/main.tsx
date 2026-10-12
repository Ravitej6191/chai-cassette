import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import gsap from 'gsap'
import * as THREE from 'three'
import App from './App'
import * as controller from './controller/deck'
import { engine } from './audio/AudioEngine'
import { live, anim } from './state/live'
import { useDeck } from './state/store'
import './styles.css'

// Dev-only: expose the app's singletons so behaviour can be driven from the console / automated checks.
if (import.meta.env.DEV) Object.assign(window, { __app: { gsap, THREE, controller, engine, live, anim, store: useDeck } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
