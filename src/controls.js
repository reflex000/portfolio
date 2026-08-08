// Keyboard (WASD / arrows) + touch joystick input.
// Exposes state.throttle and state.steer in [-1, 1], state.brake as bool.

export function createControls({ onReset, onHorn, onArrow }) {
  const state = { throttle: 0, steer: 0, brake: false }
  const keys = new Set()

  const update = () => {
    let throttle = 0
    let steer = 0
    if (keys.has('KeyW') || keys.has('ArrowUp')) throttle += 1
    if (keys.has('KeyS') || keys.has('ArrowDown')) throttle -= 1
    if (keys.has('KeyA') || keys.has('ArrowLeft')) steer += 1
    if (keys.has('KeyD') || keys.has('ArrowRight')) steer -= 1
    state.throttle = throttle
    state.steer = steer
    state.brake = keys.has('Space')
  }

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault()
    }
    if (e.code === 'KeyR') onReset?.()
    if (e.code === 'KeyH') onHorn?.()
    if (!e.repeat && e.code === 'ArrowLeft') onArrow?.(-1)
    if (!e.repeat && e.code === 'ArrowRight') onArrow?.(1)
    keys.add(e.code)
    update()
  })

  window.addEventListener('keyup', (e) => {
    keys.delete(e.code)
    update()
  })

  window.addEventListener('blur', () => {
    keys.clear()
    update()
  })

  // ---- Touch joystick ----
  const joystick = document.getElementById('joystick')
  const stick = document.getElementById('joystick-stick')
  const isTouch = window.matchMedia('(pointer: coarse)').matches

  if (isTouch && joystick && stick) {
    joystick.classList.remove('hidden')
    let activeTouch = null

    const setStick = (dx, dy) => {
      stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`
    }

    const handleMove = (touch) => {
      const rect = joystick.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      let dx = touch.clientX - cx
      let dy = touch.clientY - cy
      const max = rect.width / 2 - 10
      const len = Math.hypot(dx, dy)
      if (len > max) {
        dx = (dx / len) * max
        dy = (dy / len) * max
      }
      setStick(dx, dy)
      state.throttle = -dy / max // up = forward
      state.steer = -dx / max // left = steer left
    }

    joystick.addEventListener('touchstart', (e) => {
      activeTouch = e.changedTouches[0].identifier
      handleMove(e.changedTouches[0])
      e.preventDefault()
    })

    window.addEventListener(
      'touchmove',
      (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier === activeTouch) handleMove(t)
        }
      },
      { passive: false }
    )

    const endTouch = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === activeTouch) {
          activeTouch = null
          state.throttle = 0
          state.steer = 0
          setStick(0, 0)
        }
      }
    }
    window.addEventListener('touchend', endTouch)
    window.addEventListener('touchcancel', endTouch)
  }

  return state
}
