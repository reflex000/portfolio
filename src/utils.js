import * as THREE from 'three'

const FONT_STACK = `'Segoe UI', 'Nunito', system-ui, sans-serif`

// Draws text lines onto a canvas and returns a THREE texture + aspect ratio.
export function makeTextTexture(lines, { color = '#5b4b43', weight = 900, padding = 40 } = {}) {
  if (typeof lines === 'string') lines = [lines]
  const fontSize = 120
  const lineHeight = fontSize * 1.25

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  ctx.font = `${weight} ${fontSize}px ${FONT_STACK}`
  const maxWidth = Math.max(...lines.map((l) => ctx.measureText(l).width))

  canvas.width = Math.ceil(maxWidth + padding * 2)
  canvas.height = Math.ceil(lineHeight * lines.length + padding * 2)

  ctx.font = `${weight} ${fontSize}px ${FONT_STACK}`
  ctx.fillStyle = color
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  lines.forEach((line, i) => {
    ctx.fillText(line, canvas.width / 2, padding + lineHeight * (i + 0.5))
  })

  const texture = new THREE.CanvasTexture(canvas)
  texture.anisotropy = 8
  return { texture, aspect: canvas.width / canvas.height }
}

// Flat text lying on the ground (like Bruno's floor typography).
export function makeFloorText(text, { height = 3, color = '#5b4b43', weight = 900 } = {}) {
  const { texture, aspect } = makeTextTexture(text, { color, weight })
  const geometry = new THREE.PlaneGeometry(height * aspect, height)
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = 0.03
  return mesh
}

// Canvas texture for a sign panel: big title + small subtitle.
export function makePanelTexture(title, subtitle, { bg = '#ffffff', fg = '#5b4b43', accent = '#84a59d' } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = bg
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  ctx.fillStyle = fg
  let size = 110
  ctx.font = `900 ${size}px ${FONT_STACK}`
  while (ctx.measureText(title).width > canvas.width - 100 && size > 40) {
    size -= 6
    ctx.font = `900 ${size}px ${FONT_STACK}`
  }
  ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 50)

  ctx.fillStyle = accent
  ctx.font = `700 56px ${FONT_STACK}`
  ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 80)

  const texture = new THREE.CanvasTexture(canvas)
  texture.anisotropy = 8
  return texture
}

// Canvas texture for a small label (used on skill crates).
export function makeLabelTexture(text, { bg = '#f6bd60', fg = '#5b4b43' } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = bg
  ctx.fillRect(0, 0, 256, 256)

  ctx.fillStyle = fg
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  let size = 84
  ctx.font = `900 ${size}px ${FONT_STACK}`
  while (ctx.measureText(text).width > 220 && size > 24) {
    size -= 4
    ctx.font = `900 ${size}px ${FONT_STACK}`
  }
  ctx.fillText(text, 128, 128)

  const texture = new THREE.CanvasTexture(canvas)
  return texture
}
