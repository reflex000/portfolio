// DOM overlay: splash screen, badge, hint, popup card, horn sound.

export function createUI(content, { onStart, onReset }) {
  const hud = document.getElementById('hud')
  const popup = document.getElementById('popup')
  const popupTitle = document.getElementById('popup-title')
  const popupBody = document.getElementById('popup-body')
  const popupLink = document.getElementById('popup-link')
  const hint = document.getElementById('hint')

  document.getElementById('badge-name').textContent = content.name
  document.getElementById('badge-title').textContent = content.title

  const isTouch = window.matchMedia('(pointer: coarse)').matches

  // Bruno-style: no splash screen — the world is already visible,
  // any click / tap / key starts the drive.
  hud.classList.remove('hidden')
  hint.textContent = isTouch ? 'Tap anywhere to start' : 'Click anywhere or press any key to start'
  hint.classList.add('pulse')

  let begun = false
  const begin = () => {
    if (begun) return
    begun = true
    hint.classList.remove('pulse')
    hint.textContent = isTouch
      ? 'Use the joystick to drive'
      : 'WASD / arrows to drive · Space to brake · R to reset · H for horn'
    onStart?.()
  }
  window.addEventListener('pointerdown', begin)
  window.addEventListener('keydown', begin)

  // ?autostart skips the wait — handy for shared links & screenshots
  if (new URLSearchParams(location.search).has('autostart')) {
    setTimeout(begin, 300)
  }

  document.getElementById('reset-btn').addEventListener('click', () => onReset?.())

  let currentZone = null

  function showPopup({ title, body, url, linkLabel }) {
    popupTitle.textContent = title
    popupBody.textContent = body || ''
    if (url) {
      popupLink.href = url
      popupLink.textContent = linkLabel || 'Open ↗'
      popupLink.classList.remove('hidden')
    } else {
      popupLink.classList.add('hidden')
    }
    popup.classList.remove('hidden')
  }

  function hidePopup() {
    popup.classList.add('hidden')
  }

  // ---- Horn (tiny WebAudio beep, no asset needed) ----
  let audioCtx = null
  function horn() {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)()
    const now = audioCtx.currentTime
    const gain = audioCtx.createGain()
    gain.gain.setValueAtTime(0.12, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
    gain.connect(audioCtx.destination)
    for (const freq of [392, 494]) {
      const osc = audioCtx.createOscillator()
      osc.type = 'square'
      osc.frequency.value = freq
      osc.connect(gain)
      osc.start(now)
      osc.stop(now + 0.25)
    }
  }

  return {
    showPopup,
    hidePopup,
    horn,
    get currentZone() {
      return currentZone
    },
    set currentZone(z) {
      currentZone = z
    },
  }
}
