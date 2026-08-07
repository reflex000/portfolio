import * as THREE from 'three'

// Low-poly toy car built from primitives (no external models needed).
// Chassis visual matches the physics box (2 x 0.8 x 3.8); drives toward -z.
export function buildCar(palette) {
  const group = new THREE.Group()

  const paintMat = new THREE.MeshStandardMaterial({ color: palette.coral, roughness: 0.32, metalness: 0.12 })
  const darkMat = new THREE.MeshStandardMaterial({ color: '#3c332d', roughness: 0.85 })
  const glassMat = new THREE.MeshStandardMaterial({ color: '#9fd4d6', roughness: 0.08, metalness: 0.35 })
  const chromeMat = new THREE.MeshStandardMaterial({ color: '#efe6d8', roughness: 0.25, metalness: 0.6 })
  const lightMat = new THREE.MeshStandardMaterial({
    color: '#fff8d8',
    emissive: '#ffe9a3',
    emissiveIntensity: 1.4,
  })

  // Lower body slab
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.55, 3.8), paintMat)
  body.position.y = -0.1
  body.castShadow = true
  group.add(body)

  // Hood (front, -z) and trunk (rear) — a step lower than the cabin line
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.28, 1.25), paintMat)
  hood.position.set(0, 0.3, -1.2)
  hood.castShadow = true
  group.add(hood)

  const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.3, 0.7), paintMat)
  trunk.position.set(0, 0.31, 1.5)
  trunk.castShadow = true
  group.add(trunk)

  // Cabin: glass band + painted roof (slightly narrower than the body)
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.6, 1.85), glassMat)
  cabin.position.set(0, 0.62, 0.28)
  cabin.castShadow = true
  group.add(cabin)

  // Window pillars — thin painted frames at the cabin corners
  const pillarGeo = new THREE.BoxGeometry(0.1, 0.6, 0.1)
  for (const [px, pz] of [[-0.78, -0.62], [0.78, -0.62], [-0.78, 1.16], [0.78, 1.16]]) {
    const pillar = new THREE.Mesh(pillarGeo, paintMat)
    pillar.position.set(px, 0.62, pz)
    group.add(pillar)
  }

  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.14, 2.05), paintMat)
  roof.position.set(0, 0.98, 0.28)
  roof.castShadow = true
  group.add(roof)

  // Wheel arches — dark fenders over each wheel corner
  const archGeo = new THREE.BoxGeometry(0.24, 0.5, 1.15)
  for (const [ax, az] of [[-1.02, -1.25], [1.02, -1.25], [-1.02, 1.25], [1.02, 1.25]]) {
    const arch = new THREE.Mesh(archGeo, darkMat)
    arch.position.set(ax, -0.18, az)
    group.add(arch)
  }

  // Side skirts
  for (const sx of [-0.98, 0.98]) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 1.4), darkMat)
    skirt.position.set(sx, -0.32, 0.05)
    group.add(skirt)
  }

  // Rear spoiler
  const spoilerWing = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.42), paintMat)
  spoilerWing.position.set(0, 0.78, 1.78)
  spoilerWing.castShadow = true
  group.add(spoilerWing)
  for (const sx of [-0.6, 0.6]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.32, 0.09), darkMat)
    strut.position.set(sx, 0.58, 1.78)
    group.add(strut)
  }

  // Headlights (round, front) + taillights (bar, rear)
  const headGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.08, 14)
  headGeo.rotateX(Math.PI / 2)
  for (const x of [-0.62, 0.62]) {
    const light = new THREE.Mesh(headGeo, lightMat)
    light.position.set(x, 0.22, -1.93)
    group.add(light)
  }
  const tailBar = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.14, 0.08),
    new THREE.MeshStandardMaterial({ color: '#d94b4b', emissive: '#c22', emissiveIntensity: 0.9 })
  )
  tailBar.position.set(0, 0.28, 1.93)
  group.add(tailBar)

  // Bumpers + front grille
  for (const z of [-1.95, 1.95]) {
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.06, 0.26, 0.18), darkMat)
    bumper.position.set(0, -0.32, z)
    group.add(bumper)
  }
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.06), chromeMat)
  grille.position.set(0, -0.05, -1.94)
  group.add(grille)

  // Wheels — torus tyre + chrome hub + spokes; positioned by physics each frame
  const wheels = []
  const tyreGeo = new THREE.TorusGeometry(0.36, 0.16, 12, 24)
  const tyreMat = new THREE.MeshStandardMaterial({ color: '#2e2824', roughness: 0.95 })
  const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.3, 16)
  hubGeo.rotateZ(Math.PI / 2)
  const spokeGeo = new THREE.BoxGeometry(0.3, 0.07, 0.05)

  for (let i = 0; i < 4; i++) {
    const wheel = new THREE.Group()
    const tyre = new THREE.Mesh(tyreGeo, tyreMat)
    tyre.rotation.y = Math.PI / 2
    tyre.castShadow = true
    const hub = new THREE.Mesh(hubGeo, chromeMat)
    wheel.add(tyre, hub)
    for (let sIdx = 0; sIdx < 5; sIdx++) {
      const spoke = new THREE.Mesh(spokeGeo, chromeMat)
      spoke.rotation.x = (sIdx / 5) * Math.PI * 2
      spoke.translateY(0.14)
      wheel.add(spoke)
    }
    wheels.push(wheel)
  }

  return { group, wheels }
}
