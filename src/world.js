import * as THREE from 'three'
import { makeFloorText, makePanelTexture, makeLabelTexture } from './utils.js'
import { addStaticBox, addDynamicBox, addDynamicCylinder, addDynamicSphere } from './physics.js'

export const palette = {
  bg: '#fdf6ec',
  ground: '#f3e5d3',
  ink: '#5b4b43',
  coral: '#f28482',
  sage: '#84a59d',
  peach: '#f6bd60',
  blush: '#f5cac3',
  cream: '#fffaf2',
}

// Builds the whole world. Returns { syncList, zones } —
// syncList pairs each dynamic physics body with its mesh,
// zones are circular triggers checked against the car position.
export function buildWorld(scene, world, content) {
  const syncList = []
  const zones = []

  // ---------- Ground ----------
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(130, 64),
    new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness: 1 })
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  // ---------- Roads to the four areas ----------
  buildRoads(scene)

  // ---------- Horizon hills (sit in the fog for depth) ----------
  const hillMat1 = new THREE.MeshStandardMaterial({ color: '#d9c9ae', roughness: 1 })
  const hillMat2 = new THREE.MeshStandardMaterial({ color: '#cbbfa8', roughness: 1 })
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2 + 0.2
    const dist = 105 + (i % 3) * 9
    const hill = new THREE.Mesh(new THREE.SphereGeometry(14 + (i % 4) * 6, 16, 10), i % 2 ? hillMat1 : hillMat2)
    hill.scale.y = 0.32 + (i % 3) * 0.06
    hill.position.set(Math.cos(angle) * dist, -2, Math.sin(angle) * dist)
    scene.add(hill)
  }

  // ---------- Perimeter fence ----------
  const fenceMat = new THREE.MeshStandardMaterial({ color: palette.blush, roughness: 0.9 })
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

  // ---------- Start area: name + hints on the floor ----------
  const nameText = makeFloorText(content.name.toUpperCase(), { height: 6, color: palette.ink })
  nameText.position.set(0, 0.03, -2)
  scene.add(nameText)

  const titleText = makeFloorText(content.title, { height: 2, color: '#a58d7f' })
  titleText.position.set(0, 0.03, 3)
  scene.add(titleText)

  const tagText = makeFloorText(content.tagline, { height: 1.4, color: '#b9a99b' })
  tagText.position.set(0, 0.03, 14)
  scene.add(tagText)

  // Direction labels near the start
  const dirs = [
    { text: '↑ PROJECTS', pos: [0, -18] },
    { text: '← ABOUT', pos: [-18, 0] },
    { text: 'PLAYGROUND →', pos: [18, 0] },
    { text: '↓ CONTACT', pos: [0, 18] },
  ]
  for (const d of dirs) {
    const t = makeFloorText(d.text, { height: 1.6, color: '#c4b3a4' })
    t.position.set(d.pos[0], 0.03, d.pos[1])
    scene.add(t)
  }

  // ============================================================
  // PROJECTS — north (negative z): billboards + trigger pads
  // ============================================================
  const projTitle = makeFloorText('PROJECTS', { height: 4, color: palette.sage })
  projTitle.position.set(0, 0.03, -30)
  scene.add(projTitle)

  const spacing = 20
  content.projects.forEach((project, i) => {
    const x = (i - (content.projects.length - 1) / 2) * spacing
    buildBillboard(scene, world, project, x, -52)
    buildTriggerPad(scene, zones, {
      x,
      z: -44,
      radius: 4.5,
      color: palette.sage,
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
  const aboutTitle = makeFloorText('ABOUT', { height: 4, color: palette.peach })
  aboutTitle.position.set(-32, 0.03, 0)
  scene.add(aboutTitle)

  const bio = makeFloorText(content.about.lines, { height: 1.7 * content.about.lines.length, color: '#8d7a6d' })
  bio.position.set(-50, 0.03, 0)
  scene.add(bio)

  // Skill crates — dynamic boxes you can smash around
  content.about.skills.forEach((skill, i) => {
    const col = i % 4
    const row = Math.floor(i / 4)
    const x = -44 + col * 4
    const z = -14 - row * 4
    const size = 1.1
    const crateColors = [palette.peach, palette.coral, palette.sage, palette.blush]
    const tex = makeLabelTexture(skill, { bg: crateColors[i % 4], fg: '#ffffff' })
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size * 2, size * 2, size * 2),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })
    )
    mesh.castShadow = true
    scene.add(mesh)
    const body = addDynamicBox(world, [size, size, size], [x, size + 0.05, z], 0.8)
    syncList.push({ mesh, body })
  })

  const skillsLabel = makeFloorText('my skills — smash them!', { height: 1.3, color: '#b9a99b' })
  skillsLabel.position.set(-40, 0.03, -8)
  scene.add(skillsLabel)

  // ============================================================
  // PLAYGROUND — east (positive x): bowling + brick wall + ball
  // ============================================================
  const playTitle = makeFloorText('PLAYGROUND', { height: 4, color: palette.coral })
  playTitle.position.set(34, 0.03, 0)
  scene.add(playTitle)

  // Bowling pins in a triangle
  const pinMat = new THREE.MeshStandardMaterial({ color: '#fffaf2', roughness: 0.5 })
  const stripeMat = new THREE.MeshStandardMaterial({ color: palette.coral, roughness: 0.5 })
  const pinBaseX = 52
  const pinBaseZ = -14
  let pinIndex = 0
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
      pinIndex++
    }
  }

  const bowlLabel = makeFloorText('STRIKE!', { height: 1.6, color: '#c4b3a4' })
  bowlLabel.position.set(pinBaseX, 0.03, pinBaseZ + 8)
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

  const wallLabel = makeFloorText('CRASH ME', { height: 1.6, color: '#c4b3a4' })
  wallLabel.position.set(wallX, 0.03, wallZ + 6)
  scene.add(wallLabel)

  // ============================================================
  // CONTACT — south (positive z): trigger pads for socials
  // ============================================================
  const contactTitle = makeFloorText('CONTACT', { height: 4, color: palette.ink })
  contactTitle.position.set(0, 0.03, 32)
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
      color: palette.peach,
      popup: { ...s.popup, url: s.url },
    })
    const label = makeFloorText(s.label, { height: 1.5, color: palette.ink })
    label.position.set(x, 0.04, z + 6)
    scene.add(label)
  })

  // ---------- Decorative trees scattered around ----------
  const treeSpots = [
    [-20, -25], [20, -25], [-25, 22], [25, 22], [-60, -30], [60, -35],
    [-30, -55], [30, -60], [-62, 30], [65, 32], [-15, 55], [15, 58],
    [40, -40], [-40, 40], [68, -10], [-68, 12],
  ]
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#b08968', roughness: 0.9 })
  const leafColors = [palette.sage, '#9dbba9', '#6d9887']
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

  return { syncList, zones }
}

// Speckled warm ground with a soft radial falloff — reads like clay/paper
// instead of a flat hex fill.
function makeGroundTexture() {
  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = palette.ground
  ctx.fillRect(0, 0, size, size)

  // Grain: thousands of tiny darker/lighter flecks
  for (let i = 0; i < 5200; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = Math.random() * 1.8 + 0.4
    const light = Math.random() > 0.5
    ctx.fillStyle = light ? 'rgba(255, 250, 240, 0.35)' : 'rgba(150, 120, 90, 0.14)'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Larger soft blotches for organic variation
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = Math.random() * 70 + 30
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(190, 160, 125, 0.06)')
    g.addColorStop(1, 'rgba(190, 160, 125, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Radial falloff: slightly darker toward the rim
  const rim = ctx.createRadialGradient(size / 2, size / 2, size * 0.25, size / 2, size / 2, size * 0.52)
  rim.addColorStop(0, 'rgba(120, 95, 70, 0)')
  rim.addColorStop(1, 'rgba(120, 95, 70, 0.16)')
  ctx.fillStyle = rim
  ctx.fillRect(0, 0, size, size)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

// Clay-path roads from the start plaza to each area, with cream dashes.
function buildRoads(scene) {
  const roadMat = new THREE.MeshStandardMaterial({ color: '#e0cdb2', roughness: 0.95 })
  const dashMat = new THREE.MeshStandardMaterial({ color: '#fdf3e3', roughness: 0.9 })
  const roadDefs = [
    { w: 9, l: 46, x: 0, z: -33, dir: 'z' },   // north — projects
    { w: 9, l: 40, x: 0, z: 30, dir: 'z' },    // south — contact
    { w: 9, l: 42, x: -31, z: 0, dir: 'x' },   // west — about
    { w: 9, l: 42, x: 31, z: 0, dir: 'x' },    // east — playground
  ]
  for (const r of roadDefs) {
    const geo = r.dir === 'z' ? new THREE.PlaneGeometry(r.w, r.l) : new THREE.PlaneGeometry(r.l, r.w)
    const road = new THREE.Mesh(geo, roadMat)
    road.rotation.x = -Math.PI / 2
    road.position.set(r.x, 0.015, r.z)
    road.receiveShadow = true
    scene.add(road)

    // Center dashes
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

  // Start plaza — a circle where the car spawns
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(11, 48), roadMat)
  plaza.rotation.x = -Math.PI / 2
  plaza.position.set(0, 0.012, 0)
  plaza.receiveShadow = true
  scene.add(plaza)
  const plazaRing = new THREE.Mesh(new THREE.RingGeometry(10.4, 11, 48), dashMat)
  plazaRing.rotation.x = -Math.PI / 2
  plazaRing.position.set(0, 0.018, 0)
  scene.add(plazaRing)
}

// A sign with two posts + a textured panel, plus static physics for the posts.
function buildBillboard(scene, world, project, x, z) {
  const group = new THREE.Group()
  const postMat = new THREE.MeshStandardMaterial({ color: '#b08968', roughness: 0.9 })

  for (const px of [-4, 4]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, 0.5), postMat)
    post.position.set(px, 2.5, 0)
    post.castShadow = true
    group.add(post)
    addStaticBox(world, [0.25, 2.5, 0.25], [x + px, 2.5, z])
  }

  const texture = makePanelTexture(project.title, project.tech, {
    bg: palette.cream,
    fg: palette.ink,
    accent: palette.sage,
  })
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(9.5, 4.75, 0.3),
    [
      new THREE.MeshStandardMaterial({ color: palette.cream }),
      new THREE.MeshStandardMaterial({ color: palette.cream }),
      new THREE.MeshStandardMaterial({ color: palette.cream }),
      new THREE.MeshStandardMaterial({ color: palette.cream }),
      new THREE.MeshStandardMaterial({ map: texture }), // front (+z, facing the start area)
      new THREE.MeshStandardMaterial({ color: palette.cream }),
    ]
  )
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
