import React from 'react';

interface ScriptTemplateSelectorProps {
  onSelectTemplate: (template: string) => void;
}

const templates: { [key: string]: string } = {
  'Blank': '',
  'Action': `INT. ABANDONED WAREHOUSE - NIGHT

SOUND of rain and distant thunder

AVA (30s, determined, agile) creeps through the shadows, her breath misting in the cold air. She clutches a silenced pistol.

CLOSE UP on a tripwire.

Ava spots it, freezes. Her eyes dart around, searching. She disarms it with a practiced hand.

MARCUS (O.S.)
(gruff)
Thought you could sneak in, did you?

Ava spins, gun raised. MARCUS (40s, burly, scarred) stands silhouetted in a doorway, a shotgun casually slung over his shoulder.

AVA
Just getting started.

SOUND of a shotgun cocking

FADE TO BLACK.`, 
  'Comedy': `INT. COFFEE SHOP - MORNING

SOUND of an espresso machine hissing

CHLOE (20s, perpetually flustered) juggles three coffee cups, a pastry bag, and her phone ringing.

CHLOE
(into phone, muffled)
I can't talk right now, Mom! I'm in a high-stakes caffeine-delivery operation!

She bumps into a customer, GARY (50s, mild-mannered, wearing a cat-themed sweater), sending coffee cascading down his front.

GARY
(gasps)
My artisanal oat milk latte! And my limited-edition Fluffykins sweater!

CHLOE
(eyes wide)
Oh my god, I am so, so, so sorry! Let me just...

Chloe tries to dab at the coffee with a napkin, only making it worse. Gary stares in horror.

GARY
(whispering)
It's... it's spreading.

SOUND of Chloe's phone ringing again, louder this time

FADE OUT.`, 
  'Drama': `INT. HOSPITAL ROOM - DAY

SOUND of a heart monitor beeping steadily

SARAH (30s, weary, eyes red) sits by the bedside of her MOTHER (60s, frail, asleep). Sunlight streams weakly through the blinds.

FLASHBACK - EXT. PARK - DAY (TEN YEARS AGO)

Young Sarah and her Mother laugh, pushing each other on a swing set. The sun is bright, the world vibrant.

BACK TO PRESENT

Sarah gently takes her Mother's hand. It feels cold.

SARAH
(whispering)
I wish I had told you more often.

A single tear rolls down Sarah's cheek. The heart monitor's beeps continue, a relentless rhythm.

FADE TO BLACK.`, 
  'Sci-Fi': `INT. STARSHIP ODYSSEY - BRIDGE - NIGHT

SOUND of the hum of the ship's engines

CAPTAIN EVA ROSTOVA (40s, stern, brilliant) stares at the main viewscreen. Stars streak past, a blur of hyperspace.

LIEUTENANT JAX (20s, nervous, tech-savvy) checks his console.

JAX
Captain, energy readings from the anomaly are spiking. It's... destabilizing.

EVA
(calmly)
Magnify. On screen.

The viewscreen zooms in on a swirling vortex of iridescent energy. It pulses ominously.

JAX
(voice trembling)
It's opening, Captain. A wormhole. But... it's not natural.

EVA
(a grim set to her jaw)
Prepare for evasive maneuvers. And ready the quantum torpedoes. We don't know what's coming through.

SOUND of klaxons blaring

FADE TO BLACK.`, 
  'Fantasy': `EXT. ANCIENT FOREST - DAY

SOUND of birdsong and rustling leaves

ELARA (20s, elven, graceful) moves silently through the ancient trees, her bow drawn. Sunlight dapples the forest floor.

CLOSE UP on a broken branch, fresh snap.

Elara's eyes narrow. She signals to Kael (30s, human, gruff warrior) who follows closely behind.

KAEL
(whispering)
Orcs. Fresh tracks.

ELARA
(softly)
Too close to the village. We must intercept.

They move deeper into the woods. A guttural ROAR echoes in the distance.

SOUND of swords being drawn

FADE TO BLACK.`,
};

const ScriptTemplateSelector: React.FC<ScriptTemplateSelectorProps> = ({ onSelectTemplate }) => {
  return (
    <div className="bg-secondary p-4 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold text-highlight mb-4">Script Templates</h2>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(templates).map(([name, content]) => (
          <button
            key={name}
            onClick={() => onSelectTemplate(content)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ScriptTemplateSelector;
