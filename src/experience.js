import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { content } from './content.js'
import { createPhysics } from './physics.js'
import { buildCar } from './car.js'
import { buildWorld, palette } from './world.js'
import { createControls } from './controls.js'
import { createUI } from './ui.js'

const MAX_ENGINE_FORCE = 700
const MAX_STEER = 0.55
const BRAKE_FORCE = 42
const IDLE_DRAG = 7 // gentle brake when throttle is released, so the car coasts to a stop

export class Experience {
  constructor(container) {
    // ---------- Renderer / scene / camera ----------
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(palette.bg)
    this.scene.fog = new THREE.Fog(palette.bg, 60, 150)

    // Soft studio environment so PBR materials get real reflections
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environmentIntensity = 0.14

    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 300)
    this.cameraOffset = new THREE.Vector3(5.5, 13, 14.5)
    this.introOffset = new THREE.Vector3(9.5, 8.5, 14.5)
    this.camera.position.copy(this.introOffset)
    this.camera.lookAt(0, 0, 0)
    this.started = false
    this.startTime = 0

    // Bloom — makes lanterns, shore rim and car lights glow like Bruno's
    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.55, // strength
      0.65, // radius
      0.72 // threshold
    )
    this.composer.addPass(this.bloom)
    this.composer.addPass(new OutputPass())

    // ---------- Lights ----------
    // Night: cool hemisphere bounce + soft blue moonlight
    this.scene.add(new THREE.HemisphereLight('#585a9e', '#241f45', 0.85))
    this.sun = new THREE.DirectionalLight('#8a9bff', 1.1)
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

    // Working headlight beam
    const headlight = new THREE.SpotLight('#ffedbe', 60, 30, 0.55, 0.6, 1.4)
    headlight.position.set(0, 0.5, -1.6)
    headlight.target.position.set(0, -0.4, -14)
    carGroup.add(headlight, headlight.target)

    // ---------- World ----------
    const { syncList, zones, animated, startDecor, projectNav } = buildWorld(this.scene, world, content)
    this.syncList = syncList
    this.zones = zones
    this.animated = animated
    this.startDecor = startDecor
    this.projectNav = projectNav
    this.activeZone = null

    // ---------- UI + controls ----------
    this.ui = createUI(content, {
      onStart: () => {
        this.started = true
        this.startTime = this.clock.getElapsedTime()
        this.scene.remove(this.startDecor)
      },
      onReset: () => this.resetCar(),
    })
    this.input = createControls({
      onReset: () => this.resetCar(),
      onHorn: () => this.ui.horn(),
      onArrow: (dir) => {
        // Inside the projects viewing area, ← → flip the screen
        if (!this.started || !this.activeZone?.isNav) return
        if (dir < 0) this.projectNav.prev()
        else this.projectNav.next()
        const popup = this.activeZone.getPopup?.()
        if (popup) this.ui.showPopup(popup)
      },
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
    this.composer.setSize(window.innerWidth, window.innerHeight)
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

    const brakeValue = brake ? BRAKE_FORCE : throttle === 0 ? IDLE_DRAG : 0
    for (let i = 0; i < 4; i++) {
      this.vehicle.setBrake(brakeValue, i)
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
      if (found) {
        found.onEnter?.()
        const popup = found.getPopup ? found.getPopup() : found.popup
        if (popup) this.ui.showPopup(popup)
        else this.ui.hidePopup()
      } else {
        this.ui.hidePopup()
      }
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
      if (zone.ring) zone.ring.material.opacity = 0.5 + Math.sin(elapsed * 2.5) * 0.2
    }

    // Lantern flicker, floating sparkles, start-ring pulse
    for (const update of this.animated) update(elapsed)

    this.updateCamera(delta, elapsed)
    this.composer.render()
  }
}
