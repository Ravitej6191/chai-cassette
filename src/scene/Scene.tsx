import { useFrame } from '@react-three/fiber'
import { Deck } from '../deck/Deck'
import { tick } from '../controller/deck'
import { TapeShelf } from '../tapes/TapeShelf'
import { CameraRig } from './Camera'
import { Chai } from './Chai'
import { Fan } from './Fan'
import { Lamp } from './Lamp'
import { Lighting } from './Lighting'
import { PostFX } from './PostFX'
import { Props } from './Props'
import { Room } from './Room'
import { Table } from './Table'
import { Window } from './Window'

/** Drives the transport, audio meters and reel physics once per rendered frame. */
function Ticker() {
  useFrame((_, dt) => tick(dt))
  return null
}

export function Scene() {
  return (
    <>
      <Lighting />
      <Room />
      <Window />
      <Fan />
      <Table />
      <Props />
      <Lamp />
      <Chai />
      <Deck />
      <TapeShelf />
      <CameraRig />
      <Ticker />
      <PostFX />
    </>
  )
}
