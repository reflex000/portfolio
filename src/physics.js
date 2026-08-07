import * as CANNON from 'cannon-es'

export function createPhysics() {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) })
  world.broadphase = new CANNON.SAPBroadphase(world)
  world.allowSleep = true
  world.defaultContactMaterial.friction = 0.3
  world.defaultContactMaterial.restitution = 0.1

  // Ground
  const groundBody = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane() })
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0)
  // The AABB was computed before the rotation — refresh it or wheel raycasts miss the ground
  groundBody.aabbNeedsUpdate = true
  groundBody.updateAABB()
  world.addBody(groundBody)

  // Car chassis — half extents match the visual body in car.js
  const chassisShape = new CANNON.Box(new CANNON.Vec3(1, 0.4, 1.9))
  const chassisBody = new CANNON.Body({ mass: 200 })
  chassisBody.addShape(chassisShape)
  chassisBody.position.set(0, 1.2, 8)
  chassisBody.angularDamping = 0.4
  chassisBody.allowSleep = false

  const vehicle = new CANNON.RaycastVehicle({
    chassisBody,
    indexRightAxis: 0,
    indexUpAxis: 1,
    indexForwardAxis: 2,
  })

  const wheelOptions = {
    radius: 0.5,
    directionLocal: new CANNON.Vec3(0, -1, 0),
    suspensionStiffness: 45,
    suspensionRestLength: 0.5,
    frictionSlip: 3.5,
    dampingRelaxation: 2.3,
    dampingCompression: 4.4,
    maxSuspensionForce: 100000,
    rollInfluence: 0.01,
    axleLocal: new CANNON.Vec3(-1, 0, 0),
    chassisConnectionPointLocal: new CANNON.Vec3(),
    maxSuspensionTravel: 0.4,
    customSlidingRotationalSpeed: -30,
    useCustomSlidingRotationalSpeed: true,
  }

  // Front wheels (steer) at -z, rear wheels (drive) at +z
  const connections = [
    new CANNON.Vec3(-0.95, 0, -1.3), // front left
    new CANNON.Vec3(0.95, 0, -1.3), // front right
    new CANNON.Vec3(-0.95, 0, 1.3), // rear left
    new CANNON.Vec3(0.95, 0, 1.3), // rear right
  ]
  connections.forEach((point) => {
    vehicle.addWheel({ ...wheelOptions, chassisConnectionPointLocal: point })
  })
  vehicle.addToWorld(world)

  return { world, chassisBody, vehicle, groundBody }
}

// Simple helper to add a static box (walls, sign posts, etc.)
export function addStaticBox(world, halfExtents, position, quaternion) {
  const body = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Box(new CANNON.Vec3(...halfExtents)),
  })
  body.position.set(...position)
  if (quaternion) body.quaternion.copy(quaternion)
  world.addBody(body)
  return body
}

// Dynamic box the car can smash into.
export function addDynamicBox(world, halfExtents, position, mass = 1) {
  const body = new CANNON.Body({
    mass,
    shape: new CANNON.Box(new CANNON.Vec3(...halfExtents)),
    sleepSpeedLimit: 0.3,
    sleepTimeLimit: 0.6,
  })
  body.position.set(...position)
  world.addBody(body)
  return body
}

export function addDynamicCylinder(world, radiusTop, radiusBottom, height, position, mass = 1) {
  const body = new CANNON.Body({
    mass,
    shape: new CANNON.Cylinder(radiusTop, radiusBottom, height, 12),
    sleepSpeedLimit: 0.3,
    sleepTimeLimit: 0.6,
  })
  body.position.set(...position)
  world.addBody(body)
  return body
}

export function addDynamicSphere(world, radius, position, mass = 2) {
  const body = new CANNON.Body({
    mass,
    shape: new CANNON.Sphere(radius),
    sleepSpeedLimit: 0.3,
    sleepTimeLimit: 0.6,
  })
  body.position.set(...position)
  world.addBody(body)
  return body
}
