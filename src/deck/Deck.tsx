import { DECK_POS } from '../layout'
import { viewProps } from '../scene/interaction'
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
    <group name="deck" position={DECK_POS} {...viewProps('deck')}>
      <DeckBody />
      <group {...viewProps('tape', 'deck')}>
        <TapeWindow />
        <CassetteDoor />
      </group>
      <group {...viewProps('keys', 'deck')}>
        <PianoKeys />
      </group>
      <group {...viewProps('vu', 'deck')}>
        <VUMeters />
      </group>
      <group {...viewProps('counter', 'deck')}>
        <TapeCounter />
      </group>
      <group {...viewProps('knobs', 'deck')}>
        <Knobs />
      </group>
      <group {...viewProps('switches', 'deck')}>
        <Switches />
      </group>
      <group {...viewProps('radio', 'deck')}>
        <RadioSection />
      </group>
      <group {...viewProps('speaker', 'deck')}>
        <Speakers />
      </group>
    </group>
  )
}
