# Conquista: The New World (1492–1600)

A browser strategy and exploration game about the Spanish voyages to and conquest of the Americas.

Sail west from Sevilla in 1492, discover the islands and coasts of the New World, send expeditions inland, meet the Taíno, Maya, Mexica, Inca, Muisca, Mapuche and dozens of other peoples, and uncover artifacts in ancient ruins such as Teotihuacan, Palenque, Tiwanaku and Machu Picchu.

## How to play

Open `index.html` in any modern browser. No build step or install is needed. You can also serve the folder with any static server (for example `npx http-server`) or GitHub Pages.

- **Click** the map to sail or march. **Drag** to pan, **scroll** to zoom.
- **Click land** while at sea to sail to the nearest shore and send an expedition ashore. Click the **ship** to re-embark.
- **Arrow keys / WASD** move one tile (Q/E/Z/C for diagonals), **L** lands or re-embarks, **Space** recentres.
- Sail next to the castle of **Sevilla** to deliver treasure, recruit soldiers, buy horses, arquebuses, cannon and provisions, and buy bigger ships.

## Features

- A map of the Atlantic and the Americas, from the Mississippi to Tierra del Fuego, with fog of war, rivers you can sail up (Amazon, Mississippi, Orinoco, Paraná), mountains, jungles and deserts.
- Historical winds: the trade winds carry you west and the westerlies carry you home.
- Provisions: fish in coastal waters, forage on land, and receive food from friendly peoples. Watch out for storms, Caribbean hurricanes from August to October, and French corsairs.
- About 85 native settlements across 30 peoples, each with its own attitude, rivals and allies. Trade, give gifts, demand tribute, recruit native allies, or attack.
- Turn-based battles with tactics: arquebus volleys, cavalry charges, steel and shield, or holding formation. The ground matters (cavalry on open plains, damp powder in the jungle), men tire and are wounded, and each people fights its own way. Fear of guns and horses fades as each people learns to fight them.
- Friars to hire in Sevilla and send to preach in native towns and colonies, founding missions.
- Disease: Old World epidemics (smallpox, measles, typhus, influenza) spread from town to town, often ahead of the Spanish themselves.
- 39 artifacts to collect, 37 geographic discoveries, conquests that become tribute-paying colonies, and a chronicle of real events from 1494 to 1598.
- Titles from Hidalgo to Virrey, autosave, and an end screen that tallies the human cost of the conquest.

## Files

- `index.html`: page layout
- `css/style.css`: styling
- `js/data.js`: geography, peoples, settlements, ruins, artifacts and discoveries
- `js/world.js`: map generation, pathfinding and terrain rendering
- `js/game.js`: game state, movement, events, disease, save/load
- `js/battle.js`: combat
- `js/ui.js`: HUD and dialogs
- `js/main.js`: rendering, input and the main loop
