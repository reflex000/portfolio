import * as THREE from 'three'

// Low-poly toy car built from primitives (no external models needed).
export function buildCar(palette) {
  const group = new THREE.Group()

  const bodyMat = new THREE.MeshStandardMaterial({ color: palette.coral, roughness: 0.7 })
  const darkMat = new THREE.MeshStandardMaterial({ color: '#4a3f38', roughness: 0.9 })
  const glassMat = new THREE.MeshStandardMaterial({ color: '#bfe3e0', roughness: 0.2 })
  const lightMat = new THREE.MeshStandardMaterial({
    color: '#fff3c4',
    emissive: '#ffe9a3',
    emissiveIntensity: 0.6,
  })

  // Main body — matches physics chassis box (2 x 0.8 x 3.8)
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 3.8), bodyMat)
  body.castShadow = true
  group.add(body)

  // Cabin — sits toward the rear; the car drives toward -z
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.75, 1.8), glassMat)
  cabin.position.set(0, 0.75, 0.45)
  cabin.castShadow = true
  group.add(cabin)

  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.18, 1.95), bodyMat)
  roof.position.set(0, 1.2, 0.45)
  roof.castShadow = true
  group.add(roof)

  // Headlights at the front (-z)
  for (const x of [-0.6, 0.6]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.1), lightMat)
    light.position.set(x, 0.1, -1.93)
    group.add(light)

    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.2, 0.1),
      new THREE.MeshStandardMaterial({ color: '#e05252', emissive: '#a33', emissiveIntensity: 0.4 })
    )
    tail.position.set(x, 0.1, 1.93)
    group.add(tail)
  }

  // Bumpers
  for (const z of [-1.95, 1.95]) {
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.3, 0.15), darkMat)
    bumper.position.set(0, -0.28, z)
    group.add(bumper)
  }

  // Wheels — separate meshes, positioned by the physics engine each frame
  const wheels = []
  const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 16)
  wheelGeo.rotateZ(Math.PI / 2)
  const wheelMat = new THREE.MeshStandardMaterial({ color: '#3d3430', roughness: 0.95 })
  const hubGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.42, 12)
  hubGeo.rotateZ(Math.PI / 2)
  const hubMat = new THREE.MeshStandardMaterial({ color: '#e8ddd0', roughness: 0.6 })

  for (let i = 0; i < 4; i++) {
    const wheel = new THREE.Group()
    const tyre = new THREE.Mesh(wheelGeo, wheelMat)
    tyre.castShadow = true
    const hub = new THREE.Mesh(hubGeo, hubMat)
    wheel.add(tyre, hub)
    wheels.push(wheel)
  }

  return { group, wheels }
}
