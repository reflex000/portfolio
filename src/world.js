import * as THREE from 'three'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import fontData from './fonts/helvetiker_bold.typeface.json'
import { makeFloorText, makePanelTexture, makeLabelTexture } from './utils.js'
import { addStaticBox, addDynamicBox, addDynamicCylinder, addDynamicSphere } from './physics.js'

// Night palette — deep indigo world, glowing water rim, warm lanterns
export const palette = {
  bg: '#141232',
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

// Builds the whole world. Returns { syncList, zones, animated, startDecor } —
// syncList pairs each dynamic physics body with its mesh, zones are circular
// popup triggers, animated are per-frame update callbacks, startDecor is
// removed from the scene when driving starts.
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

  // Glowing shoreline rim (blooms like neon)
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
    [14, -46], [-14, -46], [14, 46], [-14, 46],
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

  // ---------- Start area: extruded 3D name + hints ----------
  const font = new FontLoader().parse(fontData)
  const nameGeo = new TextGeometry(content.name.toUpperCase(), {
    font,
    size: 2.3,
    depth: 0.9,
    curveSegments: 5,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.05,
    bevelSegments: 2,
  })
  nameGeo.computeBoundingBox()
  const nameWidth = nameGeo.boundingBox.max.x - nameGeo.boundingBox.min.x
  nameGeo.translate(-nameWidth / 2, 0, 0)
  nameGeo.rotateX(-Math.PI / 2)
  const nameMesh = new THREE.Mesh(
    nameGeo,
    new THREE.MeshStandardMaterial({ color: palette.letters, roughness: 0.5 })
  )
  nameMesh.position.set(0, 0.04, -2.5)
  nameMesh.castShadow = true
  scene.add(nameMesh)

  const titleText = makeFloorText(content.title, { height: 1.6, color: '#b7aed6' })
  titleText.position.set(0, 0.04, 3.5)
  scene.add(titleText)

  const tagText = makeFloorText(content.tagline, { height: 1.4, color: '#8f86b8' })
  tagText.position.set(0, 0.04, 14)
  scene.add(tagText)

  // Click-to-start ring + label around the spawn point (removed on start)
  const startDecor = new THREE.Group()
  const startRing = new THREE.Mesh(
    new THREE.RingGeometry(7.1, 7.5, 64),
    new THREE.MeshBasicMaterial({ color: '#e8e4ff', transparent: true, opacity: 0.9 })
  )
  startRing.rotation.x = -Math.PI / 2
  startRing.position.set(0, 0.05, 8)
  startDecor.add(startRing)
  const startLabel = makeFloorText('CLICK TO START', { height: 1.3, color: '#efe9ff' })
  startLabel.position.set(9.5, 0.05, 15)
  startLabel.rotation.z = -0.25
  startDecor.add(startLabel)
  scene.add(startDecor)
  animated.push((t) => {
    startRing.material.opacity = 0.6 + Math.sin(t * 2.4) * 0.3
  })

  // Direction labels near the start
  const dirs = [
    { text: '↑ PROJECTS', pos: [0, -18] },
    { text: '← ABOUT', pos: [-18, 0] },
    { text: 'PLAYGROUND →', pos: [18, 0] },
    { text: '↓ CONTACT', pos: [0, 18] },
  ]
  for (const d of dirs) {
    const t = makeFloorText(d.text, { height: 1.6, color: '#7d74a4' })
    t.position.set(d.pos[0], 0.04, d.pos[1])
    scene.add(t)
  }

  // ============================================================
  // PROJECTS — north (negative z): billboards + trigger pads
  // ============================================================
  const projTitle = makeFloorText('PROJECTS', { height: 4, color: '#7fd4b5' })
  projTitle.position.set(0, 0.04, -30)
  scene.add(projTitle)

  const spacing = 20
  content.projects.forEach((project, i) => {
    const x = (i - (content.projects.length - 1) / 2) * spacing
    buildBillboard(scene, world, project, x, -52)
    buildTriggerPad(scene, zones, {
      x,
      z: -44,
      radius: 4.5,
      color: '#5dd6a8',
      popup: {
        title: project.title,
        body: `${project.tech} — ${project.description}`,
        url: project.url,
        linkLabel: 'View project ↗',
      },
    })
  })

  // ============================================================
  // ABOUT — west (negative x): bio floor text + skill crates
  // ============================================================
  const aboutTitle = makeFloorText('ABOUT', { height: 4, color: '#ffcf86' })
  aboutTitle.position.set(-32, 0.04, 0)
  scene.add(aboutTitle)

  const bio = makeFloorText(content.about.lines, { height: 1.7 * content.about.lines.length, color: '#a89fce' })
  bio.position.set(-50, 0.04, 0)
  scene.add(bio)

  // Skill crates — dynamic boxes you can smash around
  content.about.skills.forEach((skill, i) => {
    const col = i % 4
    const row = Math.floor(i / 4)
    const x = -44 + col * 4
    const z = -14 - row * 4
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

  const skillsLabel = makeFloorText('my skills — smash them!', { height: 1.3, color: '#8f86b8' })
  skillsLabel.position.set(-40, 0.04, -8)
  scene.add(skillsLabel)

  // ============================================================
  // PLAYGROUND — east (positive x): bowling + brick wall + ball
  // ============================================================
  const playTitle = makeFloorText('PLAYGROUND', { height: 4, color: '#ff9d9b' })
  playTitle.position.set(34, 0.04, 0)
  scene.add(playTitle)

  // Bowling pins in a triangle
  const pinMat = new THREE.MeshStandardMaterial({ color: '#f4eee2', roughness: 0.5 })
  const stripeMat = new THREE.MeshStandardMaterial({ color: palette.coral, roughness: 0.5 })
  const pinBaseX = 52
  const pinBaseZ = -14
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i <= row; i++) {
      const x = pinBaseX + (i - row / 2) * 1.6
      const z = pinBaseZ - row * 1.6
      const pin = new THREE.Group()
      const bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 1.6, 12), pinMat)
      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.335, 0.335, 0.18, 12), stripeMat)
      stripe.position.y = 0.45
      bodyMesh.castShadow = true
      pin.add(bodyMesh, stripe)
      scene.add(pin)
      const body = addDynamicCylinder(world, 0.32, 0.42, 1.6, [x, 0.85, z], 0.5)
      syncList.push({ mesh: pin, body })
    }
  }

  const bowlLabel = makeFloorText('STRIKE!', { height: 1.6, color: '#8f86b8' })
  bowlLabel.position.set(pinBaseX, 0.04, pinBaseZ + 8)
  scene.add(bowlLabel)

  // Big beach ball
  const ballMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 24, 16),
    new THREE.MeshStandardMaterial({ color: palette.peach, roughness: 0.6 })
  )
  ballMesh.castShadow = true
  scene.add(ballMesh)
  const ballBody = addDynamicSphere(world, 1.4, [44, 1.5, 2], 1.5)
  syncList.push({ mesh: ballMesh, body: ballBody })

  // Brick wall
  const brickColors = [palette.coral, palette.peach, palette.sage, palette.blush]
  const brick = { hx: 0.9, hy: 0.45, hz: 0.45 }
  const wallX = 52
  const wallZ = 14
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

  const wallLabel = makeFloorText('CRASH ME', { height: 1.6, color: '#8f86b8' })
  wallLabel.position.set(wallX, 0.04, wallZ + 6)
  scene.add(wallLabel)

  // ============================================================
  // CONTACT — south (positive z): trigger pads for socials
  // ============================================================
  const contactTitle = makeFloorText('CONTACT', { height: 4, color: palette.ink })
  contactTitle.position.set(0, 0.04, 32)
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

  // ---------- Decorative trees scattered around ----------
  const treeSpots = [
    [-20, -25], [20, -25], [-25, 22], [25, 22], [-60, -30], [60, -35],
    [-30, -55], [30, -60], [-62, 30], [65, 32], [-15, 55], [15, 58],
    [40, -40], [-40, 40], [68, -10], [-68, 12],
  ]
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#6b5470', roughness: 0.9 })
  const leafColors = ['#3f7259', '#35604d', '#8a5fa8']
  treeSpots.forEach(([x, z], i) => {
    const tree = new THREE.Group()
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 1.6, 8), trunkMat)
    trunk.position.y = 0.8
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(1.6 + (i % 3) * 0.3, 3 + (i % 2), 8),
      new THREE.MeshStandardMaterial({ color: leafColors[i % 3], roughness: 0.9 })
    )
    crown.position.y = 3
    trunk.castShadow = true
    crown.castShadow = true
    tree.add(trunk, crown)
    tree.position.set(x, 0, z)
    scene.add(tree)
    addStaticBox(world, [0.4, 1, 0.4], [x, 1, z])
  })

  return { syncList, zones, animated, startDecor }
}

// Dark purple-tinted grassy ground with speckles and a soft rim falloff.
function makeGroundTexture() {
  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = palette.ground
  ctx.fillRect(0, 0, size, size)

  // Organic green-ish patches
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

  // Grain flecks
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

  // Rim falloff
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
    { w: 9, l: 46, x: 0, z: -33, dir: 'z' },   // north — projects
    { w: 9, l: 40, x: 0, z: 30, dir: 'z' },    // south — contact
    { w: 9, l: 42, x: -31, z: 0, dir: 'x' },   // west — about
    { w: 9, l: 42, x: 31, z: 0, dir: 'x' },    // east — playground
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

  // Start plaza
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
    // keep paths, plaza and pin/wall spots clear
    if (Math.abs(x) < 6.5 && z > -58 && z < 52) continue
    if (Math.abs(z) < 6.5 && Math.abs(x) < 54) continue
    if (dist < 12.5) continue
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

// A sign with two posts + a textured panel, plus static physics for the posts.
function buildBillboard(scene, world, project, x, z) {
  const group = new THREE.Group()
  const postMat = new THREE.MeshStandardMaterial({ color: '#6b5470', roughness: 0.9 })

  for (const px of [-4, 4]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, 0.5), postMat)
    post.position.set(px, 2.5, 0)
    post.castShadow = true
    group.add(post)
    addStaticBox(world, [0.25, 2.5, 0.25], [x + px, 2.5, z])
  }

  const texture = makePanelTexture(project.title, project.tech, {
    bg: palette.cream,
    fg: '#463a55',
    accent: '#6f9b8e',
  })
  const sideMat = new THREE.MeshStandardMaterial({ color: palette.cream })
  const panel = new THREE.Mesh(new THREE.BoxGeometry(9.5, 4.75, 0.3), [
    sideMat, sideMat, sideMat, sideMat,
    new THREE.MeshStandardMaterial({ map: texture, emissive: '#fffaf2', emissiveMap: texture, emissiveIntensity: 0.35 }),
    sideMat,
  ])
  panel.position.set(0, 4, 0)
  panel.castShadow = true
  group.add(panel)

  group.position.set(x, 0, z)
  scene.add(group)
}

// A colored ring on the floor; entering its radius fires the popup.
function buildTriggerPad(scene, zones, { x, z, radius, color, popup }) {
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

  zones.push({ x, z, radius, popup, ring })
}
