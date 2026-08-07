import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { content } from './content.js'
import { createPhysics } from './physics.js'
import { buildCar } from './car.js'
import { buildWorld, palette } from './world.js'
import { createControls } from './controls.js'
import { createUI } from './ui.js'

const MAX_ENGINE_FORCE = 700
const MAX_STEER = 0.55
const BRAKE_FORCE = 15

export class Experience {
  constructor(container) {
    // ---------- Renderer / scene / camera ----------
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 0.98
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(palette.bg)
    this.scene.fog = new THREE.Fog(palette.bg, 70, 160)

    // Soft studio environment so PBR materials get real reflections
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environmentIntensity = 0.32

    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 300)
    this.cameraOffset = new THREE.Vector3(5.5, 13, 14.5)
    this.introOffset = new THREE.Vector3(0, 90, 60)
    this.camera.position.copy(this.introOffset)
    this.camera.lookAt(0, 0, 0)
    this.started = false
    this.startTime = 0

    // ---------- Lights ----------
    // Hemisphere = warm sky bounce + cooler ground bounce (kills the flat look)
    this.scene.add(new THREE.HemisphereLight('#fffdf2', '#cbb397', 0.5))
    this.sun = new THREE.DirectionalLight('#ffedca', 2.1)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    this.sun.shadow.camera.near = 5
    this.sun.shadow.camera.far = 120
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.03
    this.sun.shadow.radius = 4
    const s = 45
    this.sun.shadow.camera.left = -s
    this.sun.shadow.camera.right = s
    this.sun.shadow.camera.top = s
    this.sun.shadow.camera.bottom = -s
    this.scene.add(this.sun, this.sun.target)

    // ---------- Physics + car ----------
    const { world, chassisBody, vehicle } = createPhysics()
    this.world = world
    this.chassisBody = chassisBody
    this.vehicle = vehicle

    const { group: carGroup, wheels } = buildCar(palette)
    this.carGroup = carGroup
    this.wheels = wheels
    this.scene.add(carGroup, ...wheels)

    // ---------- World ----------
    const { syncList, zones } = buildWorld(this.scene, world, content)
    this.syncList = syncList
    this.zones = zones
    this.activeZone = null

    // ---------- UI + controls ----------
    this.ui = createUI(content, {
      onStart: () => {
        this.started = true
        this.startTime = this.clock.getElapsedTime()
      },
      onReset: () => this.resetCar(),
    })
    this.input = createControls({
      onReset: () => this.resetCar(),
      onHorn: () => this.ui.horn(),
    })

    this.upsideDownSince = null

    window.addEventListener('resize', () => this.onResize())

    this.clock = new THREE.Clock()
    this.renderer.setAnimationLoop(() => this.tick())
  }

  resetCar() {
    const b = this.chassisBody
    // Respawn near where the car currently is, upright and still
    b.position.set(b.position.x, 2, b.position.z)
    b.quaternion.set(0, 0, 0, 1)
    b.velocity.setZero()
    b.angularVelocity.setZero()
    b.wakeUp()
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  applyInput() {
    const { throttle, steer, brake } = this.input

    // Engine on rear wheels (2, 3). Positive force drives toward -z (the car's nose).
    const force = throttle * MAX_ENGINE_FORCE
    this.vehicle.applyEngineForce(force, 2)
    this.vehicle.applyEngineForce(force, 3)

    // Steering on front wheels (0, 1)
    this.vehicle.setSteeringValue(steer * MAX_STEER, 0)
    this.vehicle.setSteeringValue(steer * MAX_STEER, 1)

    for (let i = 0; i < 4; i++) {
      this.vehicle.setBrake(brake ? BRAKE_FORCE : 0, i)
    }
  }

  syncCar() {
    this.carGroup.position.copy(this.chassisBody.position)
    this.carGroup.quaternion.copy(this.chassisBody.quaternion)
    for (let i = 0; i < 4; i++) {
      this.vehicle.updateWheelTransform(i)
      const t = this.vehicle.wheelInfos[i].worldTransform
      this.wheels[i].position.copy(t.position)
      this.wheels[i].quaternion.copy(t.quaternion)
    }
  }

  checkZones() {
    const p = this.chassisBody.position
    let found = null
    for (const zone of this.zones) {
      const dx = p.x - zone.x
      const dz = p.z - zone.z
      if (dx * dx + dz * dz < zone.radius * zone.radius) {
        found = zone
        break
      }
    }
    if (found !== this.activeZone) {
      this.activeZone = found
      if (found) this.ui.showPopup(found.popup)
      else this.ui.hidePopup()
    }
  }

  checkFlip(elapsed) {
    // Auto-reset if the car stays upside down
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.carGroup.quaternion)
    if (up.y < 0.1) {
      this.upsideDownSince ??= elapsed
      if (elapsed - this.upsideDownSince > 2.5) {
        this.resetCar()
        this.upsideDownSince = null
      }
    } else {
      this.upsideDownSince = null
    }
  }

  updateCamera(delta, elapsed) {
    const target = new THREE.Vector3().copy(this.chassisBody.position)

    let offset = this.cameraOffset
    if (this.started) {
      // Zoom in over the first 2 seconds after "Start"
      const t = Math.min((elapsed - this.startTime) / 2, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      offset = new THREE.Vector3().lerpVectors(this.introOffset, this.cameraOffset, ease)
    } else {
      offset = this.introOffset
    }

    const desired = target.clone().add(offset)
    this.camera.position.lerp(desired, Math.min(delta * 4, 1))
    this.camera.lookAt(target.x, target.y, target.z)

    // Keep the shadow camera centered on the car
    this.sun.position.set(target.x + 25, 40, target.z + 15)
    this.sun.target.position.copy(target)
  }

  tick() {
    const delta = Math.min(this.clock.getDelta(), 0.1)
    const elapsed = this.clock.getElapsedTime()

    if (this.started) this.applyInput()
    this.world.step(1 / 60, delta, 3)

    this.syncCar()
    for (const { mesh, body } of this.syncList) {
      mesh.position.copy(body.position)
      mesh.quaternion.copy(body.quaternion)
    }

    if (this.started) {
      this.checkZones()
      this.checkFlip(elapsed)
    }

    // Gentle pulse on trigger rings
    for (const zone of this.zones) {
      zone.ring.material.opacity = 0.5 + Math.sin(elapsed * 2.5) * 0.2
    }

    this.updateCamera(delta, elapsed)
    this.renderer.render(this.scene, this.camera)
  }
}
