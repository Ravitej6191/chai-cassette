import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Bloom, DepthOfField, EffectComposer, N8AO, Noise, SMAA, ToneMapping, Vignette, wrapEffect } from '@react-three/postprocessing'
import { BlendFunction, Effect, ToneMappingMode } from 'postprocessing'
import { Uniform, Vector3 } from 'three'
import { DECK_POS, HELD_POS, FRONT_Z } from '../layout'
import { useDeck } from '../state/store'
import { held } from '../controller/deck'
import { zoomFocus } from './Camera'

const FRAG = /* glsl */ `
uniform vec3 uTint;
uniform float uSat;
uniform float uContrast;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, uSat);
  c = (c - 0.5) * uContrast + 0.5;
  c *= uTint;
  outputColor = vec4(max(c, 0.0), inputColor.a);
}`

/** Warm colour grade: slight desaturation, a touch of contrast, amber-leaning tint. */
class WarmGradeEffect extends Effect {
  constructor() {
    super('WarmGrade', FRAG, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ['uTint', new Uniform(new Vector3(1.03, 0.99, 0.95))],
        ['uSat', new Uniform(1.0)],
        ['uContrast', new Uniform(1.06)],
      ]),
    })
  }
}
const WarmGrade = wrapEffect(WarmGradeEffect)

/**
 * Post-processing: bloom on the lamp and backlit meters, depth of field that focuses on
 * whatever the user is touching, the warm grade, film grain and a vignette.
 * Tiers: low = bloom+grain only; high = adds SMAA; ultra = adds depth of field, MSAA and ambient occlusion.
 */
export function PostFX() {
  const quality = useDeck((s) => s.ui.quality)
  const low = quality === 'low'
  const ultra = quality === 'ultra'
  const dof = useRef<{ target?: Vector3 | null } | null>(null)
  const focus = useMemo(() => DECK_POS.clone().add(new Vector3(0, 0, FRONT_Z)), [])
  const want = useMemo(() => new Vector3(), [])

  // ease the focal plane toward the thing being handled: a held tape, a zoomed part, else the deck front
  useFrame(() => {
    const s = useDeck.getState()
    if (s.heldId) want.copy(held.dragTarget ?? HELD_POS)
    else if (s.ui.zoom) want.copy(zoomFocus(s.ui.zoom))
    else want.set(DECK_POS.x - 0.05, DECK_POS.y, DECK_POS.z + FRONT_Z)
    focus.lerp(want, 0.08)
    const e = dof.current
    if (e) {
      if (!e.target) e.target = focus.clone()
      else e.target.copy(focus)
    }
  })

  return (
    <EffectComposer multisampling={ultra ? 4 : 0} enableNormalPass={false}>
      {/* ambient occlusion: contact shadows where objects meet — the biggest single realism gain */}
      {ultra && <N8AO aoRadius={0.35} distanceFalloff={0.8} intensity={2.2} aoSamples={6} denoiseSamples={4} denoiseRadius={8} quality="performance" halfRes />}
      <Bloom mipmapBlur intensity={low ? 0.3 : 0.45} luminanceThreshold={1.0} luminanceSmoothing={0.3} radius={0.7} />
      {!ultra ? <SMAA /> : <DepthOfField ref={dof as never} target={[0, 0.9, 0.1]} focalLength={0.045} bokehScale={1.3} height={480} />}
      <WarmGrade />
      {/* tone-map first: grain and vignette must work on display-range values, not HDR */}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Noise blendFunction={BlendFunction.SOFT_LIGHT} opacity={low ? 0.12 : 0.17} />
      <Vignette eskil={false} offset={0.25} darkness={0.75} />
    </EffectComposer>
  )
}
