import { DECK_POS } from '../layout'
import { zoomProps } from '../scene/interaction'
import { CassetteDoor } from './CassetteDoor'
import { DeckBody } from './DeckBody'
import { Knobs } from './Knobs'
import { PianoKeys } from './PianoKeys'
import { RadioSection } from './RadioSection'
import { Speakers } from './Speakers'
import { Switches } from './Switches'
import { TapeCounter } from './TapeCounter'
import { TapeWindow } from './TapeWindow'
import { VUMeters } from './VUMeters'

/**
 * The two-in-one deck. Each part is wrapped so a double-click zooms the camera to it;
 * click empty space (handled in the canvas) to zoom back out.
 */
export function Deck() {
  return (
    <group name="deck" position={DECK_POS}>
      <DeckBody />
      <group {...zoomProps('tape')}>
        <TapeWindow />
        <CassetteDoor />
      </group>
      <group {...zoomProps('keys')}>
        <PianoKeys />
      </group>
      <group {...zoomProps('vu')}>
        <VUMeters />
      </group>
      <group {...zoomProps('counter')}>
        <TapeCounter />
      </group>
      <group {...zoomProps('knobs')}>
        <Knobs />
      </group>
      <group {...zoomProps('switches')}>
        <Switches />
      </group>
      <group {...zoomProps('radio')}>
        <RadioSection />
      </group>
      <group {...zoomProps('speaker')}>
        <Speakers />
      </group>
    </group>
  )
}
