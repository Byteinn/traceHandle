import './style.css'
import { SceneManager } from './SceneManager.js'
import { GestureController } from './GestureController.js'

document.addEventListener('DOMContentLoaded', async () => {
  const canvas = document.getElementById('canvas')
  const video = document.getElementById('webcam')
  const loading = document.getElementById('loading')

  // Initialize Scene
  const sceneManager = new SceneManager(canvas)

  // Initialize Gesture Control
  const gestureController = new GestureController(video)

  try {
    await gestureController.initialize()
    loading.style.display = 'none'

    // Connect Gesture to Scene
    gestureController.on('fist', () => sceneManager.tree.form())
    gestureController.on('open', () => sceneManager.tree.disperse())
    gestureController.on('move', (x) => sceneManager.tree.rotate(x))

    // Start loop
    sceneManager.animate()
  } catch (error) {
    console.error('Failed to initialize:', error)
    loading.textContent = 'Error loading AI Model'
  }
})
