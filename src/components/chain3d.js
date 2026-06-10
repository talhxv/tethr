import * as THREE from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import chainSvg from '../assets/chainlinkvector.svg?raw'

/* ── Env map that matches the banner gradient ── */
function buildEnvMap(renderer) {
  const pmrem  = new THREE.PMREMGenerator(renderer)
  const scene  = new THREE.Scene()
  const geo    = new THREE.SphereGeometry(50, 32, 16)
  const mat    = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      top:    { value: new THREE.Color(0xc4d8ff) },
      bottom: { value: new THREE.Color(0x7aa3ee) },
    },
    vertexShader:  `varying vec3 v; void main(){ v=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader:`uniform vec3 top,bottom; varying vec3 v; void main(){ float t=clamp(v.y*.5+.5,0.,1.); gl_FragColor=vec4(mix(bottom,top,t),1.); }`,
  })
  scene.add(new THREE.Mesh(geo, mat))
  const envMap = pmrem.fromScene(scene, 0.02).texture
  pmrem.dispose(); mat.dispose(); geo.dispose()
  return envMap
}

/* ── Glass material ── */
function buildMat(envMap) {
  return new THREE.MeshPhysicalMaterial({
    color:               new THREE.Color(0x9ab8e8),
    roughness:           0.05,
    metalness:           0.0,
    transmission:        0.88,
    thickness:           6.0,
    ior:                 1.48,
    envMap,
    envMapIntensity:     2.6,
    clearcoat:           1.0,
    clearcoatRoughness:  0.04,
    attenuationColor:    new THREE.Color(0x99b4e8),
    attenuationDistance: 3.5,
    transparent:         true,
    opacity:             0.92,
    side:                THREE.FrontSide,
  })
}

export function initChain(container) {
  const W = container.offsetWidth
  const H = container.offsetHeight
  if (!W || !H) return

  /* ── Renderer — fully transparent so banner shows through ── */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(W, H)
  renderer.toneMapping    = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.3
  renderer.outputColorSpace   = THREE.SRGBColorSpace
  renderer.setClearColor(0x000000, 0)

  const canvas = renderer.domElement
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:2;'
  container.appendChild(canvas)

  const scene  = new THREE.Scene()
  const envMap = buildEnvMap(renderer)
  scene.environment = envMap

  /* ── Parse the SVG path ── */
  const loader   = new SVGLoader()
  const svgData  = loader.parse(chainSvg)

  // SVG viewBox: 0 0 283 251 → center at (141.5, 125.5)
  const SVG_W = 283, SVG_H = 251
  const scale  = 0.018   // tune to fill the banner nicely

  const group = new THREE.Group()

  svgData.paths.forEach(path => {
    const shapes = SVGLoader.createShapes(path)
    shapes.forEach(shape => {
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth:          18,
        bevelEnabled:   true,
        bevelThickness: 10,
        bevelSize:      8,
        bevelSegments:  20,
      })

      const mesh = new THREE.Mesh(geo, buildMat(envMap))
      mesh.castShadow    = true
      mesh.receiveShadow = true
      group.add(mesh)
    })
  })

  // Center the group on the SVG's own centroid, flip Y (SVG Y↓ vs Three Y↑)
  group.scale.set(scale, -scale, scale)
  group.position.set(-SVG_W * scale / 2, SVG_H * scale / 2, 0)

  scene.add(group)

  /* ── Camera — orthographic-feel perspective, match the SVG viewport ── */
  const camera = new THREE.PerspectiveCamera(28, W / H, 0.1, 100)
  camera.position.set(0, 0, 14)
  camera.lookAt(0, 0, 0)

  /* ── Lights ── */
  scene.add(new THREE.AmbientLight(0xd8e8ff, 1.4))

  const key = new THREE.DirectionalLight(0xffffff, 4.5)
  key.position.set(4, 8, 8)
  scene.add(key)

  const fill = new THREE.DirectionalLight(0xb8ccff, 1.4)
  fill.position.set(-6, -3, 4)
  scene.add(fill)

  const rim = new THREE.DirectionalLight(0xe8f0ff, 0.9)
  rim.position.set(0, -6, -5)
  scene.add(rim)

  /* ── Gentle idle drift ── */
  const clock = new THREE.Clock()
  let raf

  function tick() {
    raf = requestAnimationFrame(tick)
    const t = clock.getElapsedTime()
    group.rotation.y = Math.sin(t * 0.18) * 0.06
    group.rotation.x = Math.sin(t * 0.13) * 0.025
    renderer.render(scene, camera)
  }
  tick()

  /* ── Resize ── */
  function onResize() {
    const w = container.offsetWidth
    const h = container.offsetHeight
    if (!w || !h) return
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  }
  window.addEventListener('resize', onResize)

  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', onResize)
    envMap.dispose()
    renderer.dispose()
    canvas.remove()
  }
}
