import * as THREE from 'three'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import fontData from './fonts/helvetiker_bold.typeface.json'
import { makeFloorText, makeTextTexture, makeLabelTexture } from './utils.js'
import { addStaticBox, addDynamicBox, addDynamicCylinder, addDynamicSphere } from './physics.js'

// Night palette — deep indigo world, glowing water rim, warm lanterns
export const palette = {
  bg: '#100e28',
  water: '#1c2cae',
  shore: '#7fe8ff',
  ground: '#403a68',
  path: '#8d81ab',
  ink: '#d8d3f2',
  letters: '#5b64f0',
  coral: '#f28482',
  sage: '#84a59d',
  peach: '#f6bd60',
  blush: '#f5cac3',
  cream: '#fffaf2',
  lamp: '#ff9d3c',
  spark: '#ff5fd7',
}

// Builds the whole world. Returns { syncList, zones, animated, startDecor }.
export function buildWorld(scene, world, content) {
  const syncList = []
  const zones = []
  const animated = []

  // ---------- Water all around the island ----------
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(420, 64),
    new THREE.MeshStandardMaterial({
      color: palette.water,
      emissive: '#2333cc',
      emissiveIntensity: 0.5,
      roughness: 0.45,
    })
  )
  water.rotation.x = -Math.PI / 2
  water.position.y = -0.35
  scene.add(water)

  const shore = new THREE.Mesh(
    new THREE.RingGeometry(129.5, 133.5, 96),
    new THREE.MeshBasicMaterial({ color: palette.shore, transparent: true, opacity: 0.85 })
  )
  shore.rotation.x = -Math.PI / 2
  shore.position.y = -0.18
  scene.add(shore)

  // ---------- Island ground ----------
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(130, 64),
    new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness: 1 })
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  // ---------- Tile paths + plaza ----------
  buildRoads(scene)

  // ---------- Grass tufts (instanced) ----------
  buildGrass(scene)

  // ---------- Lampposts with warm glow ----------
  const lampSpots = [
    [8.5, 8.5], [-8.5, 8.5], [8.5, -8.5], [-8.5, -8.5],
    [14, -40], [-14, -40], [14, 46], [-14, 46],
  ]
  lampSpots.forEach(([x, z], i) => {
    const lamp = buildLamppost(scene, world, x, z)
    animated.push((t) => {
      lamp.light.intensity = 11 + Math.sin(t * 6.5 + i * 1.7) * 1.4
    })
  })

  // ---------- Pink sparkles drifting around ----------
  const sparkMat = new THREE.SpriteMaterial({ color: palette.spark, transparent: true })
  for (let i = 0; i < 42; i++) {
    const s = new THREE.Sprite(sparkMat.clone())
    const angle = Math.random() * Math.PI * 2
    const dist = 12 + Math.random() * 105
    const baseY = 0.7 + Math.random() * 2.2
    s.position.set(Math.cos(angle) * dist, baseY, Math.sin(angle) * dist)
    s.scale.setScalar(0.22 + Math.random() * 0.18)
    scene.add(s)
    const phase = Math.random() * Math.PI * 2
    animated.push((t) => {
      s.position.y = baseY + Math.sin(t * 1.4 + phase) * 0.35
      s.material.opacity = 0.55 + Math.sin(t * 2.2 + phase) * 0.4
    })
  }

  // ---------- Perimeter fence ----------
  const fenceMat = new THREE.MeshStandardMaterial({ color: '#4e4380', roughness: 0.9 })
  const half = 80
  const fenceDefs = [
    { size: [half, 0.8, 0.5], pos: [0, 0.8, -half] },
    { size: [half, 0.8, 0.5], pos: [0, 0.8, half] },
    { size: [0.5, 0.8, half], pos: [-half, 0.8, 0] },
    { size: [0.5, 0.8, half], pos: [half, 0.8, 0] },
  ]
  for (const f of fenceDefs) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(f.size[0] * 2, f.size[1] * 2, f.size[2] * 2), fenceMat)
    mesh.position.set(...f.pos)
    mesh.castShadow = true
    scene.add(mesh)
    addStaticBox(world, f.size, f.pos)
  }

  // ---------- Start area ----------
  const font = new FontLoader().parse(fontData)

  // Bruno-style smashable name: each letter is its own physics body
  buildPhysicsName(scene, world, syncList, font, content.name.toUpperCase())

  const titleText = makeFloorText(content.title, { height: 1.5, color: '#b7aed6' })
  titleText.position.set(0, 0.04, 4.2)
  scene.add(titleText)

  const tagText = makeFloorText(content.tagline, { height: 1.3, color: '#8f86b8' })
  tagText.position.set(12.5, 0.04, 17)
  tagText.rotation.z = -0.22
  scene.add(tagText)

  // Glowing spawn ring (removed when driving starts)
  const startDecor = new THREE.Group()
  const startRing = new THREE.Mesh(
    new THREE.RingGeometry(7.1, 7.5, 64),
    new THREE.MeshBasicMaterial({ color: '#e8e4ff', transparent: true, opacity: 0.9 })
  )
  startRing.rotation.x = -Math.PI / 2
  startRing.position.set(0, 0.05, 8)
  startDecor.add(startRing)
  scene.add(startDecor)
  animated.push((t) => {
    startRing.material.opacity = 0.6 + Math.sin(t * 2.4) * 0.3
  })

  // Direction labels — beside the roads, never on them
  const dirs = [
    { text: '↑ PROJECTS', pos: [9.5, -18], rot: 0 },
    { text: '← ABOUT', pos: [-18, 9.5], rot: 0 },
    { text: 'PLAYGROUND →', pos: [18, 9.5], rot: 0 },
    { text: '↓ CONTACT', pos: [-9.5, 18], rot: 0 },
  ]
  for (const d of dirs) {
    const t = makeFloorText(d.text, { height: 1.5, color: '#7d74a4' })
    t.position.set(d.pos[0], 0.04, d.pos[1])
    t.rotation.z = d.rot
    scene.add(t)
  }

  // A cozy bench near the spawn, Bruno style
  buildBench(scene, world, 7.5, -6, 0.6)

  // ============================================================
  // PROJECTS — north: one arcade screen + prev/next/open pads
  // ============================================================
  const projTitle = makeFloorText('PROJECTS', { height: 3.6, color: '#7fd4b5' })
  projTitle.position.set(15, 0.04, -32)
  scene.add(projTitle)

  const projectNav = buildProjectScreen(scene, world, zones, content.projects, animated)

  // ============================================================
  // ABOUT — west: bio floor text + skill crates
  // ============================================================
  const aboutTitle = makeFloorText('ABOUT', { height: 3.6, color: '#ffcf86' })
  aboutTitle.position.set(-32, 0.04, -9)
  scene.add(aboutTitle)

  const bio = makeFloorText(content.about.lines, { height: 1.7 * content.about.lines.length, color: '#a89fce' })
  bio.position.set(-50, 0.04, 2)
  scene.add(bio)

  content.about.skills.forEach((skill, i) => {
    const col = i % 4
    const row = Math.floor(i / 4)
    const x = -44 + col * 4
    const z = -16 - row * 4
    const size = 1.1
    const crateColors = [palette.peach, palette.coral, palette.sage, palette.blush]
    const tex = makeLabelTexture(skill, { bg: crateColors[i % 4], fg: '#463a30' })
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size * 2, size * 2, size * 2),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })
    )
    mesh.castShadow = true
    scene.add(mesh)
    const body = addDynamicBox(world, [size, size, size], [x, size + 0.05, z], 0.8)
    syncList.push({ mesh, body })
  })

  const skillsLabel = makeFloorText('my skills — smash them!', { height: 1.2, color: '#8f86b8' })
  skillsLabel.position.set(-40, 0.04, -10.5)
  scene.add(skillsLabel)

  // ============================================================
  // PLAYGROUND — east: proper bowling alley + brick wall + ball
  // ============================================================
  const playTitle = makeFloorText('PLAYGROUND', { height: 3.6, color: '#ff9d9b' })
  playTitle.position.set(34, 0.04, -9)
  scene.add(playTitle)

  buildBowlingAlley(scene, world, syncList)

  // Big beach ball
  const ballMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 24, 16),
    new THREE.MeshStandardMaterial({ color: palette.peach, roughness: 0.6 })
  )
  ballMesh.castShadow = true
  scene.add(ballMesh)
  const ballBody = addDynamicSphere(world, 1.4, [38, 1.5, 6], 1.5)
  syncList.push({ mesh: ballMesh, body: ballBody })

  // Brick wall
  const brickColors = [palette.coral, palette.peach, palette.sage, palette.blush]
  const brick = { hx: 0.9, hy: 0.45, hz: 0.45 }
  const wallX = 52
  const wallZ = 16
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      const offset = row % 2 === 0 ? 0 : brick.hx
      const x = wallX + (col - 2) * brick.hx * 2 + offset
      const y = brick.hy + row * brick.hy * 2 + 0.02
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(brick.hx * 2, brick.hy * 2, brick.hz * 2),
        new THREE.MeshStandardMaterial({ color: brickColors[(row + col) % 4], roughness: 0.85 })
      )
      mesh.castShadow = true
      scene.add(mesh)
      const body = addDynamicBox(world, [brick.hx, brick.hy, brick.hz], [x, y, wallZ], 0.6)
      syncList.push({ mesh, body })
    }
  }

  const wallLabel = makeFloorText('CRASH ME', { height: 1.4, color: '#8f86b8' })
  wallLabel.position.set(wallX, 0.04, wallZ + 6)
  scene.add(wallLabel)

  // ============================================================
  // CONTACT — south: trigger pads for socials
  // ============================================================
  const contactTitle = makeFloorText('CONTACT', { height: 3.6, color: palette.ink })
  contactTitle.position.set(15, 0.04, 32)
  scene.add(contactTitle)

  const socialDefs = [
    {
      label: 'GITHUB',
      url: content.socials.github,
      popup: { title: 'GitHub', body: 'Check out my code & repos.', linkLabel: 'Open GitHub ↗' },
    },
    {
      label: 'LINKEDIN',
      url: content.socials.linkedin,
      popup: { title: 'LinkedIn', body: "Let's connect professionally.", linkLabel: 'Open LinkedIn ↗' },
    },
    {
      label: 'EMAIL',
      url: `mailto:${content.socials.email}`,
      popup: { title: 'Email', body: content.socials.email, linkLabel: 'Say hello ✉' },
    },
  ]
  if (content.socials.resume) {
    socialDefs.push({
      label: 'RESUME',
      url: content.socials.resume,
      popup: { title: 'Resume', body: 'Grab a copy of my resume.', linkLabel: 'Download ⬇' },
    })
  }

  socialDefs.forEach((s, i) => {
    const x = (i - (socialDefs.length - 1) / 2) * 14
    const z = 48
    buildTriggerPad(scene, zones, {
      x,
      z,
      radius: 4,
      color: '#ffcf86',
      popup: { ...s.popup, url: s.url },
    })
    const label = makeFloorText(s.label, { height: 1.5, color: palette.ink })
    label.position.set(x, 0.05, z + 6)
    scene.add(label)
  })

  // ---------- Leafy trees + rocks ----------
  const treeSpots = [
    [-20, -25], [20, -25], [-25, 22], [25, 22], [-60, -30], [60, -35],
    [-30, -55], [30, -60], [-62, 30], [65, 32], [-15, 55], [15, 58],
    [40, -40], [-40, 40], [68, -10], [-68, 12], [5, -12], [-6, -13],
  ]
  treeSpots.forEach(([x, z], i) => buildTree(scene, world, x, z, i, animated))

  const rockSpots = [[11, 12], [-12, -11], [24, -14], [-24, 14], [58, 6], [-58, -8]]
  const rockMat = new THREE.MeshStandardMaterial({ color: '#4a4080', roughness: 0.95, flatShading: true })
  rockSpots.forEach(([x, z], i) => {
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + (i % 3) * 0.3, 0), rockMat)
    rock.position.set(x, 0.35, z)
    rock.rotation.set(i, i * 1.7, 0)
    rock.castShadow = true
    scene.add(rock)
  })

  return { syncList, zones, animated, startDecor, projectNav }
}

// ------------------------------------------------------------------
// Name letters as individual physics bodies — smash them like Bruno's.
function buildPhysicsName(scene, world, syncList, font, name) {
  const letterMat = new THREE.MeshStandardMaterial({ color: palette.letters, roughness: 0.5 })
  const specs = []
  let total = 0
  for (const ch of name) {
    const geo = new TextGeometry(ch, {
      font,
      size: 2.3,
      depth: 0.9,
      curveSegments: 5,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.05,
      bevelSegments: 2,
    })
    geo.computeBoundingBox()
    const bb = geo.boundingBox
    const w = bb.max.x - bb.min.x
    const h = bb.max.y - bb.min.y
    // center the glyph, then lay it flat (extrusion pointing up)
    geo.translate(-(bb.min.x + w / 2), -(bb.min.y + h / 2), -0.45)
    geo.rotateX(-Math.PI / 2)
    specs.push({ geo, w, h })
    total += w
  }
  const gap = 0.4
  total += gap * (specs.length - 1)
  let cursor = -total / 2
  for (const { geo, w, h } of specs) {
    const mesh = new THREE.Mesh(geo, letterMat)
    mesh.castShadow = true
    scene.add(mesh)
    const body = addDynamicBox(world, [w / 2, 0.5, h / 2], [cursor + w / 2, 0.55, -2.5], 3)
    syncList.push({ mesh, body })
    cursor += w + gap
  }
}

// ------------------------------------------------------------------
// One big arcade screen with prev / next / open pads.
function buildProjectScreen(scene, world, zones, projects, animated) {
  const group = new THREE.Group()
  const frameMat = new THREE.MeshStandardMaterial({ color: '#332c52', roughness: 0.8 })

  // Side pillars
  for (const px of [-10, 10]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 9.5, 1.3), frameMat)
    pillar.position.set(px, 4.75, 0)
    pillar.castShadow = true
    group.add(pillar)
    addStaticBox(world, [0.65, 4.75, 0.65], [px, 4.75, -56])
  }

  // Marquee
  const marquee = new THREE.Mesh(new THREE.BoxGeometry(21.4, 1.7, 1.5), frameMat)
  marquee.position.set(0, 10, 0)
  group.add(marquee)
  const { texture: marqueeTex, aspect } = makeTextTexture('PROJECTS', { color: '#e8e4ff' })
  const marqueeLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1 * aspect, 1.1),
    new THREE.MeshBasicMaterial({ map: marqueeTex, transparent: true })
  )
  marqueeLabel.position.set(0, 10, 0.78)
  group.add(marqueeLabel)

  // The screen itself — canvas texture, redrawn on prev/next
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4

  let index = 0
  const draw = () => {
    const p = projects[index]
    ctx.fillStyle = '#191734'
    ctx.fillRect(0, 0, 1024, 512)
    ctx.strokeStyle = '#5b64f0'
    ctx.lineWidth = 10
    ctx.strokeRect(10, 10, 1004, 492)

    ctx.textAlign = 'center'
    ctx.fillStyle = '#fffaf2'
    let size = 64
    ctx.font = `900 ${size}px 'Segoe UI', system-ui, sans-serif`
    while (ctx.measureText(p.title).width > 920 && size > 34) {
      size -= 4
      ctx.font = `900 ${size}px 'Segoe UI', system-ui, sans-serif`
    }
    ctx.fillText(p.title, 512, 106)

    ctx.fillStyle = '#7fd4b5'
    ctx.font = `700 36px 'Segoe UI', system-ui, sans-serif`
    ctx.fillText(p.tech, 512, 168)

    ctx.fillStyle = '#b7aed6'
    ctx.font = `500 32px 'Segoe UI', system-ui, sans-serif`
    const words = p.description.split(' ')
    let line = ''
    let y = 236
    for (const word of words) {
      const attempt = line ? `${line} ${word}` : word
      if (ctx.measureText(attempt).width > 900) {
        ctx.fillText(line, 512, y)
        y += 46
        line = word
        if (y > 400) { line += '…'; break }
      } else {
        line = attempt
      }
    }
    if (line) ctx.fillText(line, 512, y)

    // Index dots
    for (let i = 0; i < projects.length; i++) {
      ctx.beginPath()
      ctx.arc(512 + (i - (projects.length - 1) / 2) * 44, 448, 10, 0, Math.PI * 2)
      ctx.fillStyle = i === index ? '#7fd4b5' : '#3a3564'
      ctx.fill()
    }
    ctx.fillStyle = '#8f86b8'
    ctx.font = `600 26px 'Segoe UI', system-ui, sans-serif`
    ctx.textAlign = 'left'
    ctx.fillText('◀ prev pad', 40, 470)
    ctx.textAlign = 'right'
    ctx.fillText('next pad ▶', 984, 470)
    ctx.textAlign = 'center'
    tex.needsUpdate = true
  }
  draw()

  const sideMat = new THREE.MeshStandardMaterial({ color: '#241f45' })
  const screen = new THREE.Mesh(new THREE.BoxGeometry(19.4, 9.7, 0.6), [
    sideMat, sideMat, sideMat, sideMat,
    new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.55 }),
    sideMat,
  ])
  screen.position.set(0, 4.85, 0)
  group.add(screen)

  group.position.set(0, 0, -56)
  scene.add(group)

  const setIndex = (next) => {
    index = (next + projects.length) % projects.length
    draw()
  }
  const getPopup = (withBody) => {
    const p = projects[index]
    return {
      title: `${index + 1}/${projects.length} · ${p.title}`,
      body: withBody ? `${p.tech} — ${p.description}` : p.tech,
      url: p.url,
      linkLabel: 'View project ↗',
    }
  }

  // Pads: prev / open / next in front of the screen
  buildTriggerPad(scene, zones, {
    x: -9, z: -44, radius: 3.6, color: '#ff9d9b', isNav: true,
    onEnter: () => setIndex(index - 1),
    getPopup: () => getPopup(false),
  })
  buildTriggerPad(scene, zones, {
    x: 0, z: -46.5, radius: 4, color: '#ffcf86', isNav: true,
    getPopup: () => getPopup(true),
  })
  buildTriggerPad(scene, zones, {
    x: 9, z: -44, radius: 3.6, color: '#7fd4b5', isNav: true,
    onEnter: () => setIndex(index + 1),
    getPopup: () => getPopup(false),
  })
  const prevLabel = makeFloorText('◀ PREV', { height: 1.3, color: '#ff9d9b' })
  prevLabel.position.set(-9, 0.05, -38.5)
  scene.add(prevLabel)
  const openLabel = makeFloorText('OPEN', { height: 1.3, color: '#ffcf86' })
  openLabel.position.set(0, 0.05, -40)
  scene.add(openLabel)
  const nextLabel = makeFloorText('NEXT ▶', { height: 1.3, color: '#7fd4b5' })
  nextLabel.position.set(9, 0.05, -38.5)
  scene.add(nextLabel)

  // Whole viewing area: inside it, ← → arrow keys flip projects
  zones.push({
    x: 0, z: -46, radius: 13, isNav: true,
    getPopup: () => ({
      ...getPopup(false),
      body: '← → arrow keys to flip projects · drive onto OPEN to visit',
    }),
  })

  return {
    prev: () => setIndex(index - 1),
    next: () => setIndex(index + 1),
  }
}

// ------------------------------------------------------------------
// A proper bowling alley: wooden lane, rails, ten pins and a ball.
function buildBowlingAlley(scene, world, syncList) {
  const laneX = 46
  const laneNearZ = -6
  const laneFarZ = -24
  const laneLen = laneNearZ - laneFarZ
  const laneMidZ = (laneNearZ + laneFarZ) / 2

  // Wooden lane with plank stripes
  const laneCanvas = document.createElement('canvas')
  laneCanvas.width = 256
  laneCanvas.height = 1024
  const lctx = laneCanvas.getContext('2d')
  lctx.fillStyle = '#8f7a55'
  lctx.fillRect(0, 0, 256, 1024)
  for (let i = 0; i < 8; i++) {
    lctx.fillStyle = i % 2 ? 'rgba(60, 45, 25, 0.18)' : 'rgba(255, 235, 200, 0.08)'
    lctx.fillRect(i * 32, 0, 32, 1024)
  }
  const laneTex = new THREE.CanvasTexture(laneCanvas)
  laneTex.colorSpace = THREE.SRGBColorSpace
  const lane = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, laneLen),
    new THREE.MeshStandardMaterial({ map: laneTex, roughness: 0.55 })
  )
  lane.rotation.x = -Math.PI / 2
  lane.position.set(laneX, 0.02, laneMidZ)
  lane.receiveShadow = true
  scene.add(lane)

  // Side rails + backstop
  const railMat = new THREE.MeshStandardMaterial({ color: '#332c52', roughness: 0.85 })
  for (const rx of [laneX - 2.6, laneX + 2.6]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, laneLen), railMat)
    rail.position.set(rx, 0.35, laneMidZ)
    rail.castShadow = true
    scene.add(rail)
    addStaticBox(world, [0.25, 0.35, laneLen / 2], [rx, 0.35, laneMidZ])
  }
  const backstop = new THREE.Mesh(new THREE.BoxGeometry(5.7, 1.3, 0.5), railMat)
  backstop.position.set(laneX, 0.65, laneFarZ - 0.4)
  scene.add(backstop)
  addStaticBox(world, [2.85, 0.65, 0.25], [laneX, 0.65, laneFarZ - 0.4])

  // Ten pins in the classic triangle
  const pinMat = new THREE.MeshStandardMaterial({ color: '#f4eee2', roughness: 0.5 })
  const stripeMat = new THREE.MeshStandardMaterial({ color: palette.coral, roughness: 0.5 })
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i <= row; i++) {
      const x = laneX + (i - row / 2) * 1.15
      const z = laneFarZ + 4 - row * 1.1
      const pin = new THREE.Group()
      const bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, 1.4, 12), pinMat)
      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.275, 0.275, 0.16, 12), stripeMat)
      stripe.position.y = 0.38
      bodyMesh.castShadow = true
      pin.add(bodyMesh, stripe)
      scene.add(pin)
      const body = addDynamicCylinder(world, 0.26, 0.34, 1.4, [x, 0.75, z], 0.4)
      syncList.push({ mesh: pin, body })
    }
  }

  // Bowling ball waiting at the head of the lane
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 24, 16),
    new THREE.MeshStandardMaterial({ color: '#463a80', roughness: 0.25, metalness: 0.3 })
  )
  ball.castShadow = true
  scene.add(ball)
  const ballBody = addDynamicSphere(world, 0.85, [laneX, 0.95, laneNearZ + 1.6], 3)
  syncList.push({ mesh: ball, body: ballBody })

  const label = makeFloorText('BOWLING — push the ball, STRIKE!', { height: 1.2, color: '#8f86b8' })
  label.position.set(laneX + 1, 0.04, laneNearZ + 5)
  scene.add(label)
}

// ------------------------------------------------------------------
function buildBench(scene, world, x, z, rotY = 0) {
  const group = new THREE.Group()
  const wood = new THREE.MeshStandardMaterial({ color: '#5a4470', roughness: 0.85 })
  const seat = new THREE.Mesh(new THREE.BoxGeometry(3, 0.22, 1), wood)
  seat.position.y = 0.85
  seat.castShadow = true
  const back = new THREE.Mesh(new THREE.BoxGeometry(3, 0.9, 0.18), wood)
  back.position.set(0, 1.5, -0.42)
  back.castShadow = true
  group.add(seat, back)
  for (const [lx, lz] of [[-1.3, 0.3], [1.3, 0.3], [-1.3, -0.35], [1.3, -0.35]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.85, 0.16), wood)
    leg.position.set(lx, 0.42, lz)
    group.add(leg)
  }
  group.position.set(x, 0, z)
  group.rotation.y = rotY
  scene.add(group)
  addStaticBox(world, [1.5, 0.9, 0.55], [x, 0.9, z])
}

// ------------------------------------------------------------------
function buildTree(scene, world, x, z, i, animated) {
  const tree = new THREE.Group()
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#6b5470', roughness: 0.9 })
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 2, 8), trunkMat)
  trunk.position.y = 1
  trunk.castShadow = true
  tree.add(trunk)

  // Leafy crown: a cluster of blobs. The two spawn trees (last indices) are
  // big pink ones, like Bruno's foliage over the start ring.
  const isSpawnTree = i >= 16
  const crownSets = [
    ['#7a5fa8', '#8a6fb8', '#6b4f9e'],
    ['#3f7259', '#4a8266', '#35604d'],
    ['#c77fd8', '#d98fd8', '#b06fc8'],
  ]
  const colors = isSpawnTree ? crownSets[2] : crownSets[i % 3]
  const crown = new THREE.Group()
  const blobs = [
    [0, 3, 0, 1.5],
    [0.9, 2.55, 0.3, 1.0],
    [-0.85, 2.6, -0.2, 1.05],
    [0.1, 2.4, 0.85, 0.9],
  ]
  blobs.forEach(([bx, by, bz, r], bi) => {
    const blob = new THREE.Mesh(
      new THREE.IcosahedronGeometry(r, 1),
      new THREE.MeshStandardMaterial({ color: colors[bi % 3], roughness: 0.9, flatShading: true })
    )
    blob.position.set(bx, by, bz)
    blob.castShadow = true
    crown.add(blob)
  })
  tree.add(crown)

  // Wind sway — the crown breathes and rocks gently
  const phase = i * 1.37
  animated.push((t) => {
    crown.rotation.z = Math.sin(t * 1.1 + phase) * 0.05
    crown.rotation.x = Math.cos(t * 0.8 + phase) * 0.04
    crown.position.x = Math.sin(t * 1.3 + phase) * 0.06
  })

  const s = (isSpawnTree ? 1.35 : 0.8 + (i % 4) * 0.16)
  tree.scale.setScalar(s)
  tree.position.set(x, 0, z)
  scene.add(tree)
  addStaticBox(world, [0.4, 1, 0.4], [x, 1, z])
}

// ------------------------------------------------------------------
// Dark purple-tinted ground with speckles, x-marks and a rim falloff.
function makeGroundTexture() {
  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = palette.ground
  ctx.fillRect(0, 0, size, size)

  for (let i = 0; i < 70; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = Math.random() * 90 + 40
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(60, 96, 80, 0.10)')
    g.addColorStop(1, 'rgba(60, 96, 80, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  for (let i = 0; i < 5200; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = Math.random() * 1.7 + 0.4
    const light = Math.random() > 0.5
    ctx.fillStyle = light ? 'rgba(150, 140, 200, 0.20)' : 'rgba(20, 16, 45, 0.22)'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Faint diagonal grid, like Bruno's floor
  ctx.strokeStyle = 'rgba(120, 110, 190, 0.10)'
  ctx.lineWidth = 2
  for (let d = 0; d < size * 2; d += 112) {
    ctx.beginPath(); ctx.moveTo(d, 0); ctx.lineTo(d - size, size); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(d - size, 0); ctx.lineTo(d, size); ctx.stroke()
  }

  // Bruno-style little x marks in a loose grid
  ctx.strokeStyle = 'rgba(140, 130, 210, 0.30)'
  ctx.lineWidth = 2.5
  const step = 56
  for (let gy = step / 2; gy < size; gy += step) {
    for (let gx = step / 2; gx < size; gx += step) {
      const x = gx + (Math.random() - 0.5) * 14
      const y = gy + (Math.random() - 0.5) * 14
      const s = 4.5
      ctx.beginPath()
      ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s)
      ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s)
      ctx.stroke()
    }
  }

  const rim = ctx.createRadialGradient(size / 2, size / 2, size * 0.25, size / 2, size / 2, size * 0.52)
  rim.addColorStop(0, 'rgba(10, 8, 30, 0)')
  rim.addColorStop(1, 'rgba(10, 8, 30, 0.28)')
  ctx.fillStyle = rim
  ctx.fillRect(0, 0, size, size)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

// Lavender stone-tile texture used for paths and the plaza.
function makeTileTexture() {
  const size = 512
  const tile = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')

  for (let ty = 0; ty < size / tile; ty++) {
    for (let tx = 0; tx < size / tile; tx++) {
      const v = (Math.random() - 0.5) * 14
      ctx.fillStyle = `rgb(${141 + v}, ${129 + v}, ${171 + v})`
      ctx.fillRect(tx * tile, ty * tile, tile, tile)
    }
  }
  ctx.strokeStyle = 'rgba(70, 60, 105, 0.55)'
  ctx.lineWidth = 3
  for (let p = 0; p <= size; p += tile) {
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke()
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 4
  return tex
}

// Tiled stone paths from the plaza to each area, with soft cream dashes.
function buildRoads(scene) {
  const tileTex = makeTileTexture()
  const dashMat = new THREE.MeshStandardMaterial({ color: '#d9d2ef', roughness: 0.9 })
  const roadDefs = [
    { w: 9, l: 46, x: 0, z: -33, dir: 'z' },
    { w: 9, l: 40, x: 0, z: 30, dir: 'z' },
    { w: 9, l: 42, x: -31, z: 0, dir: 'x' },
    { w: 9, l: 42, x: 31, z: 0, dir: 'x' },
  ]
  for (const r of roadDefs) {
    const tex = tileTex.clone()
    tex.needsUpdate = true
    const geo = r.dir === 'z' ? new THREE.PlaneGeometry(r.w, r.l) : new THREE.PlaneGeometry(r.l, r.w)
    tex.repeat.set(geo.parameters.width / 4.5, geo.parameters.height / 4.5)
    const road = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }))
    road.rotation.x = -Math.PI / 2
    road.position.set(r.x, 0.015, r.z)
    road.receiveShadow = true
    scene.add(road)

    const count = Math.floor(r.l / 5)
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count - 0.5
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 2.2), dashMat)
      dash.rotation.x = -Math.PI / 2
      if (r.dir === 'z') {
        dash.position.set(r.x, 0.02, r.z + t * r.l)
      } else {
        dash.rotation.z = Math.PI / 2
        dash.position.set(r.x + t * r.l, 0.02, r.z)
      }
      scene.add(dash)
    }
  }

  const plazaTex = tileTex.clone()
  plazaTex.needsUpdate = true
  plazaTex.repeat.set(5, 5)
  const plaza = new THREE.Mesh(
    new THREE.CircleGeometry(11, 48),
    new THREE.MeshStandardMaterial({ map: plazaTex, roughness: 0.95 })
  )
  plaza.rotation.x = -Math.PI / 2
  plaza.position.set(0, 0.012, 0)
  plaza.receiveShadow = true
  scene.add(plaza)
  const plazaRing = new THREE.Mesh(new THREE.RingGeometry(10.4, 11, 48), dashMat)
  plazaRing.rotation.x = -Math.PI / 2
  plazaRing.position.set(0, 0.018, 0)
  scene.add(plazaRing)
}

// Thousands of tiny grass tufts, instanced for performance.
function buildGrass(scene) {
  const geo = new THREE.ConeGeometry(0.14, 0.8, 4)
  const mat = new THREE.MeshStandardMaterial({ roughness: 1 })
  const count = 2400
  const inst = new THREE.InstancedMesh(geo, mat, count)
  const dummy = new THREE.Object3D()
  const colors = [new THREE.Color('#3f7259'), new THREE.Color('#35604d'), new THREE.Color('#52558f')]
  let placed = 0
  let guard = 0
  while (placed < count && guard < count * 30) {
    guard++
    const angle = Math.random() * Math.PI * 2
    const dist = Math.sqrt(Math.random()) * 124
    const x = Math.cos(angle) * dist
    const z = Math.sin(angle) * dist
    if (Math.abs(x) < 6.5 && z > -58 && z < 52) continue
    if (Math.abs(z) < 6.5 && Math.abs(x) < 54) continue
    if (dist < 12.5) continue
    if (z < -36 && Math.abs(x) < 16) continue // project pads + screen
    if (x > 41 && x < 51 && z < -3 && z > -26) continue // bowling lane
    dummy.position.set(x, 0.32, z)
    dummy.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * Math.PI, (Math.random() - 0.5) * 0.5)
    dummy.scale.setScalar(0.7 + Math.random() * 0.9)
    dummy.updateMatrix()
    inst.setMatrixAt(placed, dummy.matrix)
    inst.setColorAt(placed, colors[placed % 3])
    placed++
  }
  inst.instanceMatrix.needsUpdate = true
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true
  scene.add(inst)
}

// A lamppost with an emissive lantern and a warm point light.
function buildLamppost(scene, world, x, z) {
  const group = new THREE.Group()
  const postMat = new THREE.MeshStandardMaterial({ color: '#332c52', roughness: 0.8 })
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 3.4, 8), postMat)
  post.position.y = 1.7
  post.castShadow = true
  group.add(post)

  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.35, 4), postMat)
  cap.position.y = 3.75
  group.add(cap)

  const lantern = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.55, 0.5),
    new THREE.MeshStandardMaterial({
      color: '#ffb254',
      emissive: '#ff9d3c',
      emissiveIntensity: 2.4,
    })
  )
  lantern.position.y = 3.35
  group.add(lantern)

  const light = new THREE.PointLight(palette.lamp, 11, 17, 2)
  light.position.y = 3.3
  group.add(light)

  group.position.set(x, 0, z)
  scene.add(group)
  addStaticBox(world, [0.15, 1.7, 0.15], [x, 1.7, z])
  return { group, light }
}

// A colored ring on the floor; entering its radius fires onEnter and/or a popup.
function buildTriggerPad(scene, zones, { x, z, radius, color, popup, onEnter, getPopup }) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius - 0.5, radius, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 })
  )
  ring.rotation.x = -Math.PI / 2
  ring.position.set(x, 0.04, z)
  scene.add(ring)

  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(radius - 0.5, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12 })
  )
  disc.rotation.x = -Math.PI / 2
  disc.position.set(x, 0.035, z)
  scene.add(disc)

  zones.push({ x, z, radius, popup, onEnter, getPopup, ring })
}
