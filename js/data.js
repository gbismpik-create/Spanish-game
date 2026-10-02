'use strict';
// ---------------------------------------------------------------------------
// Static game data: geography, peoples, ruins, artifacts and discoveries.
// All coordinates are [longitude, latitude] in degrees.
// ---------------------------------------------------------------------------

const GEO = { LON_MIN: -118, LON_MAX: -4, LAT_MAX: 45, LAT_MIN: -56, RES: 2 };
GEO.W = (GEO.LON_MAX - GEO.LON_MIN) * GEO.RES;
GEO.H = (GEO.LAT_MAX - GEO.LAT_MIN) * GEO.RES;
GEO.OLD_WORLD_LON = -32; // land east of this is Europe / Africa / Atlantic isles

const LAND_POLYS = [
  // The Americas, one outline clockwise from the north-west corner of the map
  [[-118, 45], [-67.5, 45], [-67, 44.8], [-68.5, 44.3], [-70, 43.7], [-70.7, 42.6], [-70, 41.8], [-70.5, 41.5],
   [-71.5, 41.4], [-72.8, 41.2], [-74, 40.6], [-74, 39.5], [-74.9, 38.9], [-75.3, 38], [-75.9, 37.1], [-76, 36.9],
   [-75.6, 35.5], [-76.5, 34.7], [-77.9, 33.9], [-79.2, 33.2], [-80.6, 32.3], [-81.3, 31.3], [-81.4, 30.3], [-81, 29.2],
   [-80.6, 28.2], [-80.1, 26.8], [-80.1, 25.8], [-80.4, 25.2], [-81.1, 25.1], [-81.7, 25.9], [-82.1, 26.7], [-82.7, 27.7],
   [-82.7, 28.6], [-83.1, 29.1], [-83.7, 29.9], [-84.4, 30], [-85.4, 29.7], [-86.5, 30.4], [-88, 30.4], [-89.4, 30.2],
   [-89.4, 29], [-90.3, 29.2], [-91.5, 29.5], [-93.5, 29.7], [-94.8, 29.3], [-96.5, 28.3], [-97.3, 27.3], [-97.4, 25.9],
   [-97.7, 24.3], [-97.8, 22.4], [-97.3, 21], [-96.4, 19.8], [-96, 19], [-95, 18.6], [-94.4, 18.2], [-92.8, 18.5],
   [-91.4, 18.6], [-90.7, 19.4], [-90.4, 20.6], [-90.3, 21], [-89.6, 21.3], [-88.2, 21.6], [-87.1, 21.5], [-86.8, 20.9],
   [-87.4, 20.2], [-87.6, 19.2], [-88, 18.4], [-88.3, 17.5], [-88.2, 16.3], [-88.9, 15.9], [-87.6, 15.8], [-86, 15.9],
   [-84, 15.8], [-83.2, 15], [-83.5, 13.5], [-83.6, 12], [-83.7, 11], [-83, 10], [-82.2, 9.2], [-81.4, 8.8],
   [-80.2, 9.2], [-79.4, 9.6], [-78.2, 9.3], [-77.3, 8.5], [-76.8, 8.4], [-76.2, 9.3], [-75.5, 10.4], [-74.8, 11],
   [-73.5, 11.3], [-72.2, 11.9], [-71.3, 12.4], [-71.6, 11], [-70.2, 11.6], [-69.8, 11.5], [-68.4, 10.6], [-66.5, 10.6],
   [-64.5, 10.2], [-63.5, 10.6], [-62.3, 10.6], [-62, 10], [-61.1, 9.7], [-60.8, 8.6], [-59.8, 8.3], [-58.5, 7],
   [-57.2, 6], [-55, 5.9], [-53.5, 5.5], [-52, 4.7], [-51.3, 4], [-50.5, 1.8], [-50, 0.5], [-49, -0.2],
   [-48.2, -0.8], [-47, -0.6], [-44.5, -2.3], [-42, -2.8], [-39.5, -3], [-37.5, -4.6], [-35.3, -5.2], [-34.8, -7.5],
   [-35.2, -9], [-36.5, -10.5], [-37.7, -12.2], [-38.6, -13.2], [-39, -15], [-39.2, -17.7], [-39.8, -19.6], [-40.9, -21.8],
   [-42, -23], [-44.5, -23.2], [-46.5, -24.1], [-48.5, -26.2], [-48.7, -28.5], [-50.2, -30.5], [-51.5, -31.8], [-53, -33.6],
   [-54.9, -34.9], [-56.2, -34.9], [-57.8, -34.4], [-58.5, -33.9], [-58.6, -34.4], [-57.3, -35.4], [-56.7, -36.4],
   [-57.5, -38.1], [-59, -38.8], [-62, -38.9], [-62.3, -40.5], [-65, -41], [-64.5, -42.3], [-65, -43], [-65.5, -45],
   [-67.5, -46.3], [-66, -47.5], [-67.5, -49.2], [-68.5, -50.2], [-69, -51.6], [-68.5, -52.2], [-71, -52.4], [-73, -52.6],
   [-75, -52.4], [-75.3, -50], [-75.5, -48], [-74.5, -46], [-74, -44], [-73.6, -42], [-73.7, -40], [-73.4, -37.5],
   [-72.6, -35.5], [-71.7, -33], [-71.5, -30], [-71.3, -27.5], [-70.6, -25], [-70.3, -21], [-70.3, -18.3], [-71.5, -17.3],
   [-73.5, -16.3], [-75.5, -15], [-76.3, -13.5], [-77.2, -12], [-78.2, -10], [-79.2, -8], [-80, -6.8], [-81.2, -5.8],
   [-81.3, -4.3], [-80.3, -3.4], [-79.9, -2.5], [-80.9, -2.2], [-80.4, -0.8], [-80, 0.3], [-79.4, 1.2], [-78.8, 1.8],
   [-77.8, 2.6], [-77.3, 3.9], [-77.4, 6.5], [-77.9, 7.5], [-78.3, 8], [-79, 8.4], [-79.8, 8.4], [-80.4, 8],
   [-80.5, 7.3], [-81.6, 7.6], [-82.8, 8.2], [-83.6, 8.6], [-84.8, 9.6], [-85.7, 10], [-85.9, 11.2], [-86.8, 12.3],
   [-87.6, 13], [-88.8, 13.2], [-90.5, 13.9], [-92.3, 14.6], [-93.9, 15.9], [-94.7, 16.2], [-96.2, 15.7], [-97.8, 16],
   [-99.9, 16.8], [-101.5, 17.6], [-103.5, 18.3], [-105.2, 19.7], [-105.7, 20.8], [-105.3, 21.6], [-105.8, 22.7],
   [-106.9, 23.9], [-108.2, 25.2], [-109.4, 26], [-110.5, 27.5], [-111.5, 28.6], [-112.5, 29.7], [-113.3, 31.1],
   [-114.7, 31.7], [-114.5, 30.4], [-113.2, 28.8], [-112.3, 27.2], [-111.3, 25.8], [-110.6, 24.2], [-109.8, 23.2],
   [-110.2, 22.9], [-111.2, 24], [-112.1, 24.8], [-112.1, 26.1], [-113.2, 26.8], [-114.1, 27.8], [-114.3, 28.8],
   [-115.6, 30.3], [-116.6, 31.7], [-117.1, 32.6], [-118, 33.7]],
  // Nova Scotia
  [[-66, 45], [-61.5, 45], [-63, 44.6], [-64.5, 44], [-65.7, 43.5], [-66.2, 44.2], [-65, 44.9]],
  // Cuba
  [[-85, 21.9], [-84, 22.7], [-82, 23.2], [-80, 23.1], [-77.5, 21.8], [-75.5, 20.9], [-74.2, 20.2], [-75, 19.9],
   [-77.7, 19.8], [-77.3, 20.7], [-78.5, 21.5], [-81, 22], [-82.5, 22.3], [-84, 21.9]],
  // Hispaniola
  [[-74.4, 18.4], [-72.8, 19.9], [-70, 19.8], [-68.4, 18.6], [-70, 18.2], [-71.5, 17.6], [-72.8, 18.1], [-74.4, 18.2]],
  // Puerto Rico
  [[-67.3, 18.6], [-65.5, 18.5], [-65.5, 17.9], [-67.2, 17.9]],
  // Jamaica
  [[-78.4, 18.5], [-76.2, 18.3], [-76.2, 17.8], [-77.8, 17.8]],
  // Trinidad
  [[-61.9, 10.8], [-60.9, 10.8], [-61, 10.0], [-61.9, 10.0]],
  // Tierra del Fuego
  [[-68.4, -53.2], [-65.3, -54.8], [-68, -55.5], [-71.5, -55], [-74.5, -53.3], [-71, -53.3]],
  // Iberia
  [[-4, 43.4], [-8, 43.7], [-9.3, 43], [-8.9, 42], [-8.8, 40.5], [-9.5, 38.8], [-8.9, 38.4], [-8.8, 37.1],
   [-7.4, 37.2], [-6.4, 36.8], [-6.1, 36.3], [-5.6, 36], [-4.6, 36.6], [-4, 36.7]],
  // North-west Africa
  [[-5.4, 35.9], [-6, 35.7], [-6.8, 34], [-8.5, 33.3], [-9.6, 30.5], [-10, 29.3], [-12, 28], [-13.2, 27.6],
   [-14.5, 26], [-16, 23.8], [-16.9, 22], [-17.1, 20.8], [-16.2, 19.5], [-16.5, 16.5], [-17.4, 14.7], [-16.8, 13.5],
   [-16.7, 12.3], [-15.5, 11.5], [-14.7, 10.6], [-13.3, 9.2], [-12.5, 7.8], [-11.3, 6.8], [-9.5, 5.4], [-7.5, 4.4],
   [-5.5, 4.9], [-4, 5.2], [-4, 35.2]],
];

// [lon, lat, radius] small islands
const LAND_CIRCLES = [
  // Bahamas
  [-77.7, 26.6, 0.35], [-77.9, 24.4, 0.5], [-76.3, 25.2, 0.3], [-75.6, 23.6, 0.3], [-74.5, 24.05, 0.35],
  [-73.6, 21.1, 0.4], [-71.8, 21.8, 0.25],
  // Lesser Antilles and the Spanish Main islands
  [-61.55, 16.2, 0.35], [-61.35, 15.4, 0.3], [-61, 14.65, 0.3], [-60.97, 13.9, 0.25], [-61.2, 13.25, 0.2],
  [-61.68, 12.1, 0.2], [-59.55, 13.15, 0.2], [-61.8, 17.07, 0.2], [-62.75, 17.3, 0.2], [-64.7, 18.4, 0.2],
  [-60.7, 11.25, 0.2], [-64, 11, 0.3], [-69, 12.2, 0.25], [-70, 12.5, 0.2], [-82.8, 21.7, 0.3],
  // Bermuda, Galápagos, Falklands
  [-64.75, 32.3, 0.2], [-91.1, -0.7, 0.5], [-90.4, -0.6, 0.3], [-89.5, -0.9, 0.25], [-59, -51.7, 0.6], [-60.2, -51.8, 0.5],
  // Atlantic isles of the Old World
  [-28.2, 38.5, 0.4], [-25.5, 37.8, 0.35], [-31.1, 39.4, 0.2], [-27.2, 38.7, 0.25], [-16.95, 32.75, 0.3],
  [-15.6, 28, 0.3], [-16.6, 28.3, 0.35], [-14.1, 28.4, 0.35], [-13.6, 29, 0.3], [-17.9, 28.6, 0.2],
  [-23.6, 15.1, 0.3], [-24.4, 16.7, 0.3], [-22.9, 16.1, 0.25],
];

const LAKES = [[-69.4, -15.8, 0.55], [-85.4, 11.6, 0.5], [-112.5, 41.1, 0.4]];

// Rivers: navigable by ship, crossable on foot
const RIVERS = [
  { name: 'Mississippi', w: 0.38, pts: [[-89.2, 28.9], [-89.6, 29.4], [-90.1, 30], [-91.2, 31], [-91, 32.5], [-91.1, 34], [-90, 35.2], [-89.4, 36.5], [-90.2, 38.6], [-91, 40.5], [-91.2, 43], [-91.5, 45]] },
  { name: 'Amazon', w: 0.45, pts: [[-49.3, 0.2], [-50.2, -0.4], [-51, -0.9], [-52, -1.5], [-54, -2.2], [-55.5, -2.3], [-58.5, -3.1], [-60, -3.2], [-63, -3.9], [-66, -3.4], [-70, -3.8], [-73.3, -4.2], [-75.5, -4.6], [-77.5, -5.5]] },
  { name: 'Orinoco', w: 0.38, pts: [[-60.3, 8.9], [-61, 8.7], [-62.5, 8.6], [-64, 8.2], [-65.5, 7.7], [-66.6, 7.5], [-67.5, 6.2], [-67.6, 4.6], [-66.5, 3.4]] },
  { name: 'Río de la Plata', w: 0.55, pts: [[-55.5, -35.3], [-57, -34.9], [-58.4, -34.2]] },
  { name: 'Paraná', w: 0.38, pts: [[-58.2, -34.1], [-58.6, -33.9], [-59.8, -33.2], [-60.7, -32], [-60.5, -30], [-59.2, -27.6], [-58.3, -27.3], [-57.6, -25.3], [-57.9, -22]] },
  { name: 'Magdalena', w: 0.36, pts: [[-74.85, 11.3], [-74.8, 9.5], [-74.3, 8], [-74.7, 6], [-74.9, 4.5]] },
];

const MOUNTAINS = [
  { w: 0.7, pts: [[-72, 10.5], [-73.3, 8], [-74.5, 6], [-75.5, 4], [-76.5, 2], [-77.6, 0.8]] },
  { w: 0.9, pts: [[-77.6, 0.8], [-78.6, -1], [-79, -4], [-78.2, -7.5], [-77, -9.5], [-75.5, -11.5], [-73.5, -13.5], [-71, -15], [-69.2, -16.5], [-68.3, -19], [-68, -22], [-68.6, -25], [-69.4, -28], [-70, -31], [-70.2, -34], [-71, -37], [-71.6, -40], [-72, -44], [-73, -48], [-73.5, -52]] },
  { w: 0.9, pts: [[-71, -14.5], [-68, -17], [-66.5, -20], [-66.5, -23]] },
  { w: 0.7, pts: [[-110, 31.5], [-107.5, 28], [-105.5, 25], [-104.3, 22.5]] },
  { w: 0.45, pts: [[-105, 20.3], [-103, 19.6], [-101, 19.8], [-99.5, 19.2], [-98.4, 19.1], [-97.2, 19]] },
  { w: 0.55, pts: [[-102, 26.5], [-100, 24], [-99.3, 21.5], [-98, 20]] },
  { w: 0.5, pts: [[-101, 18.3], [-99, 17.6], [-97, 17], [-95.5, 16.5]] },
  { w: 0.5, pts: [[-93, 16], [-91.5, 15.2], [-89.5, 14.6], [-87.5, 14.2], [-86, 13.2], [-85, 12]] },
  { w: 0.4, pts: [[-84.5, 10.4], [-83, 9]] },
  { w: 1.0, pts: [[-112, 45], [-110, 42.5], [-107, 40], [-106, 37], [-105.5, 34]] },
  { w: 0.6, pts: [[-74, 43.5], [-76.5, 41], [-79, 39], [-81, 37.2], [-83.5, 35.3], [-85, 34]] },
  { w: 0.4, pts: [[-73.9, 10.9], [-73.5, 10.8]] },
  { w: 1.0, pts: [[-64, 5], [-61, 5.3]] },
  { w: 0.4, pts: [[-48, -25.5], [-45, -23.2], [-42, -22]] },
  { w: 0.3, pts: [[-72, 19], [-70.3, 18.8]] },
  { w: 0.25, pts: [[-77, 20.0], [-75.8, 20.1]] },
];

const BIOME_POLYS = [
  { t: 'SAVANNA', pts: [[-73, 8], [-72.5, 4], [-67, 3], [-61.5, 7.5], [-64, 9.6], [-69, 9.8]] },
  { t: 'SAVANNA', pts: [[-60, -13], [-50, -6], [-44, -4], [-42, -10], [-43.5, -19], [-49, -21], [-57, -17]] },
  { t: 'SAVANNA', pts: [[-44, -3], [-37, -5.3], [-37.5, -10], [-41, -12], [-42, -10]] },
  { t: 'SAVANNA', pts: [[-64, -20], [-58, -20], [-58, -28], [-62, -30], [-65, -27]] },
  { t: 'DESERT', pts: [[-118, 37], [-110, 37], [-104, 33], [-101, 29], [-100, 25.5], [-102, 23], [-105, 24], [-109, 27.5], [-112, 30.5], [-118, 32.5]] },
  { t: 'DESERT', pts: [[-118, 33], [-114.5, 32], [-110, 24], [-109.5, 22.8], [-110.6, 22.8], [-112.5, 24.5], [-114.5, 27.5], [-118, 30]] },
  { t: 'DESERT', pts: [[-83, -3], [-79.5, -4.2], [-78.3, -8], [-76.6, -11.5], [-74.5, -14.5], [-71.3, -16.7], [-69.6, -18.5], [-69, -22], [-69.3, -26], [-70.4, -29.5], [-73, -29.5], [-73, -20], [-80, -12], [-83, -6]] },
  { t: 'DESERT', pts: [[-72.5, 12.5], [-71, 12.5], [-71, 11.3], [-72.6, 11.3]] },
];

// ---------------------------------------------------------------------------
// Peoples of the Americas. t = martial strength, rel = starting attitude.
// ---------------------------------------------------------------------------
const CULTURES = {
  taino: { name: 'Taíno', t: 0.5, rel: 25, rivals: ['kalinago'], desc: 'Arawakan islanders of the Greater Antilles and Bahamas, ruled by caciques. Farmers, fishers and skilled canoe-builders.' },
  kalinago: { name: 'Kalinago (Island Caribs)', t: 0.85, rel: -45, rivals: ['taino'], desc: 'Fierce seafaring warriors of the Lesser Antilles, feared raiders with poisoned arrows.' },
  cumanagoto: { name: 'Cumanagoto', t: 0.7, rel: -5, rivals: [], desc: 'Carib-speaking peoples of the pearl coast of Tierra Firme.' },
  calusa: { name: 'Calusa', t: 0.85, rel: -25, rivals: ['timucua'], desc: 'A powerful fishing kingdom of south-west Florida that killed Ponce de León.' },
  timucua: { name: 'Timucua', t: 0.7, rel: 0, rivals: ['calusa', 'apalachee'], desc: 'Tattooed chiefdoms of northern Florida.' },
  apalachee: { name: 'Apalachee', t: 0.85, rel: -15, rivals: ['timucua'], desc: 'Maize-rich chiefdom of the Florida panhandle, famed for its warriors.' },
  mississippian: { name: 'Mississippian chiefdoms', t: 0.8, rel: -10, rivals: [], desc: 'Mound-building chiefdoms of the great river valleys, heirs of Cahokia.' },
  pueblo: { name: 'Pueblo peoples', t: 0.6, rel: 5, rivals: [], desc: 'Farmers of the desert living in multi-storey adobe towns. Rumours call them the Seven Cities of Gold.' },
  mexica: { name: 'Mexica (Aztec Empire)', t: 1.0, rel: 0, rivals: ['tlaxcala', 'totonac', 'purepecha', 'zapotec'], desc: 'Masters of a tributary empire ruled from the island city of Tenochtitlan, one of the largest cities on Earth.' },
  tlaxcala: { name: 'Tlaxcalteca', t: 1.0, rel: -10, rivals: ['mexica'], desc: 'An unconquered republic surrounded by the Aztec Empire. Bitter enemies of the Mexica.' },
  totonac: { name: 'Totonac', t: 0.7, rel: 20, rivals: ['mexica'], desc: 'Gulf-coast people who resent the heavy tribute demanded by the Mexica.' },
  purepecha: { name: 'Purépecha (Tarascan State)', t: 1.0, rel: 0, rivals: ['mexica'], desc: 'Metal-working rivals of the Aztecs who defeated them in battle.' },
  zapotec: { name: 'Zapotec', t: 0.8, rel: 10, rivals: ['mixtec', 'mexica'], desc: 'Ancient people of the Oaxaca valley.' },
  mixtec: { name: 'Mixtec', t: 0.8, rel: 0, rivals: ['zapotec'], desc: 'Renowned goldsmiths and painters of codices.' },
  maya: { name: 'Yucatec Maya', t: 0.9, rel: -15, rivals: [], desc: 'Independent city-states of the Yucatán, heirs to an ancient literate civilization.' },
  itza: { name: 'Itza Maya', t: 0.9, rel: -20, rivals: [], desc: 'An island kingdom in the Petén jungle — the last independent Maya state.' },
  kiche: { name: "K'iche' Maya", t: 0.9, rel: -10, rivals: ['kaqchikel'], desc: 'The dominant highland kingdom of Guatemala.' },
  kaqchikel: { name: 'Kaqchikel Maya', t: 0.9, rel: 10, rivals: ['kiche'], desc: "Highland Maya at war with their former overlords, the K'iche'." },
  pipil: { name: 'Pipil', t: 0.8, rel: -5, rivals: [], desc: 'Nahua-speaking people of Cuzcatlán.' },
  chorotega: { name: 'Chorotega', t: 0.7, rel: 0, rivals: [], desc: 'Mesoamerican settlers of the Nicoya peninsula.' },
  cueva: { name: 'Cueva', t: 0.6, rel: 5, rivals: [], desc: 'Chiefdoms of the Isthmus who told Balboa of a great sea to the south.' },
  tairona: { name: 'Tairona', t: 0.8, rel: -10, rivals: [], desc: 'Builders of stone terraces and cities in the Sierra Nevada de Santa Marta.' },
  muisca: { name: 'Muisca Confederation', t: 0.7, rel: 0, rivals: [], desc: 'Gold-working highlanders whose offerings at Lake Guatavita inspired the legend of El Dorado.' },
  omagua: { name: 'Omagua', t: 0.7, rel: -5, rivals: [], desc: 'Populous chiefdoms along the banks of the great river.' },
  inca: { name: 'Inca Empire (Tawantinsuyu)', t: 1.0, rel: 0, rivals: ['canari', 'huanca'], desc: 'The largest empire in the Americas, joined by roads across the Andes and ruled by the Sapa Inca.' },
  canari: { name: 'Cañari', t: 0.8, rel: 10, rivals: ['inca'], desc: 'A conquered people who hate their Inca overlords.' },
  huanca: { name: 'Huanca', t: 0.8, rel: 10, rivals: ['inca'], desc: 'Andean people eager to throw off Inca rule.' },
  mapuche: { name: 'Mapuche', t: 1.25, rel: -20, rivals: [], desc: 'Never conquered by the Inca — or by Spain. The most formidable warriors of the south.' },
  tupi: { name: 'Tupinambá', t: 0.7, rel: 0, rivals: [], desc: 'Coastal Tupi villages of the Brazilian forest.' },
  guarani: { name: 'Guaraní', t: 0.7, rel: 15, rivals: [], desc: 'Farming peoples of the Paraná and Paraguay rivers.' },
  charrua: { name: 'Charrúa & Querandí', t: 0.9, rel: -20, rivals: [], desc: 'Mobile hunters of the pampas around the Río de la Plata.' },
  tehuelche: { name: 'Tehuelche', t: 0.8, rel: 0, rivals: [], desc: 'Tall hunters of Patagonia, the "Patagones" of Magellan\'s chroniclers.' },
};

// type: village | town | city | capital
const SETTLEMENTS = [
  ['Guanahaní', 'taino', 'village', -74.5, 24.05], ['Marién', 'taino', 'town', -72.2, 19.75], ['Maguana', 'taino', 'town', -71.2, 18.9],
  ['Jaragua', 'taino', 'town', -72.5, 18.5], ['Higüey', 'taino', 'village', -68.7, 18.6], ['Baracoa', 'taino', 'village', -74.5, 20.35],
  ['Bayamo', 'taino', 'village', -76.6, 20.4], ['Habana', 'taino', 'village', -82.3, 22.9], ['Maima', 'taino', 'village', -77.2, 18.4],
  ['Jatibonico', 'taino', 'village', -66.5, 18.2],
  ['Karukera', 'kalinago', 'village', -61.55, 16.2], ['Waitukubuli', 'kalinago', 'village', -61.35, 15.4], ['Iouanacaéra', 'kalinago', 'village', -61, 14.65],
  ['Cumaná', 'cumanagoto', 'village', -64.2, 10.45], ['Paria', 'cumanagoto', 'village', -62.6, 10.5], ['Kairi', 'cumanagoto', 'village', -61.3, 10.4],
  ['Calos', 'calusa', 'town', -81.9, 26.5, { artifact: 'calusa_panther' }],
  ['Utina', 'timucua', 'village', -81.7, 29.8], ['Saturiwa', 'timucua', 'village', -81.5, 30.4],
  ['Anhaica', 'apalachee', 'town', -84.3, 30.45],
  ['Coosa', 'mississippian', 'town', -84.8, 34.3], ['Mabila', 'mississippian', 'town', -87.8, 31.6], ['Natchez', 'mississippian', 'town', -91.4, 31.55],
  ['Pacaha', 'mississippian', 'village', -90.5, 35.3], ['Chicaza', 'mississippian', 'village', -88.7, 34.2],
  ['Hawikuh', 'pueblo', 'town', -108.9, 34.9, { gold: 40, cibola: true }], ['Acoma', 'pueblo', 'village', -107.6, 34.9], ['Tiguex', 'pueblo', 'village', -106.6, 35.4],
  ['Tenochtitlan', 'mexica', 'capital', -99.13, 19.43, { gold: 20000, artifact: 'moctezuma_headdress' }],
  ['Texcoco', 'mexica', 'city', -98.6, 19.6, { gold: 4000 }], ['Cholula', 'mexica', 'city', -98.3, 19.0, { gold: 3500 }],
  ['Tochtepec', 'mexica', 'town', -96.1, 18.1], ['Xoconochco', 'mexica', 'town', -92.3, 15.1],
  ['Tlaxcala', 'tlaxcala', 'city', -97.9, 19.4, { gold: 1500 }],
  ['Cempoala', 'totonac', 'town', -96.5, 19.45],
  ['Tzintzuntzan', 'purepecha', 'city', -101.58, 19.63, { gold: 4000, artifact: 'tarascan_bell' }],
  ['Zaachila', 'zapotec', 'town', -96.75, 16.95], ['Tehuantepec', 'zapotec', 'town', -95.2, 16.3],
  ['Tututepec', 'mixtec', 'town', -97.6, 16.1],
  ['Champotón', 'maya', 'town', -90.7, 19.35], ['Maní', 'maya', 'town', -89.4, 20.4], ['Tulum', 'maya', 'town', -87.45, 20.2],
  ['Chetumal', 'maya', 'village', -88.3, 18.5], ['Ecab', 'maya', 'village', -87.2, 21.3],
  ['Nojpetén', 'itza', 'city', -89.88, 16.93, { gold: 2500, artifact: 'itza_codex' }],
  ["Q'umarkaj", 'kiche', 'city', -91.17, 15.1, { gold: 3000, artifact: 'kiche_jade' }], ['Iximché', 'kaqchikel', 'town', -90.8, 14.6],
  ['Cuzcatlán', 'pipil', 'town', -89.2, 13.7], ['Nicoya', 'chorotega', 'village', -85.45, 10.15],
  ['Careta', 'cueva', 'village', -77.6, 8.8], ['Comogre', 'cueva', 'village', -78.6, 9.0], ['Natá', 'cueva', 'village', -80.5, 8.4],
  ['Teyuna', 'tairona', 'town', -73.9, 11.0, { gold: 1500, artifact: 'tairona_pendant' }],
  ['Bacatá', 'muisca', 'city', -74.07, 4.6, { gold: 6000, artifact: 'muisca_tunjo' }], ['Hunza', 'muisca', 'city', -73.36, 5.53, { gold: 5000 }],
  ['Sugamuxi', 'muisca', 'town', -72.93, 5.72, { gold: 3000 }],
  ['Aparia', 'omagua', 'town', -70, -3.3], ['Machiparo', 'omagua', 'town', -65, -3.0],
  ['Cusco', 'inca', 'capital', -71.97, -13.53, { gold: 25000, artifact: 'coricancha_disk' }],
  ['Cajamarca', 'inca', 'city', -78.5, -7.16, { gold: 13000, artifact: 'mascaipacha' }], ['Quito', 'inca', 'city', -78.5, -0.22, { gold: 6000 }],
  ['Tumbes', 'inca', 'town', -80.45, -3.57, { gold: 1200 }], ['Pachacamac', 'inca', 'town', -76.9, -12.26, { gold: 2500 }],
  ['Vilcabamba', 'inca', 'town', -73.2, -13.0], ['Huánuco Pampa', 'inca', 'town', -76.8, -9.9], ['Chucuito', 'inca', 'town', -69.9, -16.2],
  ['Tomebamba', 'canari', 'town', -79, -2.9], ['Hatun Xauxa', 'huanca', 'town', -75.5, -11.77],
  ['Mapocho', 'mapuche', 'village', -70.65, -33.45], ['Arauco', 'mapuche', 'village', -73.3, -37.25], ['Villarrica', 'mapuche', 'village', -72.2, -39.3],
  ['Kirimuré', 'tupi', 'village', -38.5, -12.97], ['Guanabara', 'tupi', 'village', -43.2, -22.9], ['Potiguara', 'tupi', 'village', -35, -8.05],
  ['Piratininga', 'tupi', 'village', -46.6, -23.55],
  ['Lambaré', 'guarani', 'village', -57.6, -25.35], ['Guairá', 'guarani', 'village', -54, -24.5],
  ['Querandí camp', 'charrua', 'village', -58.4, -34.8], ['Charrúa camp', 'charrua', 'village', -56.2, -34.4],
  ['Aónikenk camp', 'tehuelche', 'village', -69, -49.5], ['Chubut camp', 'tehuelche', 'village', -66, -43.5],
];

const SETTLEMENT_TYPES = {
  village: { label: 'Village', pop: [800, 2000], gold: [60, 160], fame: 10, income: 4 },
  town: { label: 'Town', pop: [4000, 10000], gold: [300, 900], fame: 30, income: 12 },
  city: { label: 'City', pop: [20000, 45000], gold: [2000, 5000], fame: 80, income: 35 },
  capital: { label: 'Imperial Capital', pop: [90000, 140000], gold: [15000, 25000], fame: 300, income: 120 },
};

// Named ancient sites: [name, lon, lat, artifactId]
const RUIN_SITES = [
  ['Teotihuacan', -98.84, 19.69, 'teotihuacan_mask'], ['Palenque', -91.98, 17.48, 'pakal_mask'], ['Tikal', -89.62, 17.22, 'tikal_lintel'],
  ['Copán', -89.14, 14.84, 'copan_stela'], ['Monte Albán', -96.77, 17.04, 'montealban_pectoral'], ['La Venta', -94.04, 18.1, 'olmec_jaguar'],
  ['Chichén Itzá', -88.57, 20.68, 'chichen_disc'],
  ['Chavín de Huántar', -77.18, -9.59, 'chavin_tenon'], ['Tiwanaku', -68.67, -16.9, 'tiwanaku_relief'], ['Nazca', -75.13, -14.74, 'nazca_vessel'],
  ['Caral', -77.52, -10.89, 'caral_quipu'], ['Chan Chan', -79.07, -8.1, 'chimu_tumi'], ['Kuélap', -77.92, -6.42, 'kuelap_sarcophagus'],
  ['Machu Picchu', -72.54, -13.16, 'machupicchu_llama'], ['San Agustín', -76.27, 1.88, 'sanagustin_statue'],
  ['Lake Guatavita', -73.78, 4.98, 'eldorado_raft'], ['Fountain of Youth', -81.31, 29.9, 'youth_water'],
  ['Cahokia', -90.06, 38.66, 'cahokia_chunkey'], ['Mesa Verde', -108.46, 37.18, 'mesaverde_pot'], ['Chaco Canyon', -107.96, 36.06, 'chaco_turquoise'],
  ['Marajó mounds', -49.5, -1.0, 'marajo_urn'], ['Caguana', -66.8, 18.3, 'caguana_cemi'],
];

const RANDOM_RUIN_NAMES = ['Overgrown Temple', 'Forgotten Shrine', 'Sunken Plaza', 'Cliff Tombs', 'Abandoned Terraces',
  'Stone Circle', 'Collapsed Pyramid', 'Burial Mound', 'Painted Cave', 'Fallen Observatory', 'Serpent Causeway',
  'Silent Ball Court', 'Hidden Sanctuary', 'Vine-choked Palace', 'Weathered Stelae', 'Moss-covered Altar'];
const GENERIC_ARTIFACTS = ['obsidian_blade', 'feather_shield', 'spondylus', 'serpent_effigy', 'gold_nosering', 'star_chart', 'jaguar_throne', 'crystal_skull'];

const ARTIFACTS = {
  teotihuacan_mask: { name: 'Turquoise Mask of Teotihuacan', icon: '🎭', fame: 60, value: 300, desc: 'A greenstone mask inlaid with turquoise and shell, carved centuries before the Mexica — who believed Teotihuacan was where the gods were born.' },
  pakal_mask: { name: 'Jade Funerary Mask', icon: '💚', fame: 80, value: 400, desc: 'A mosaic of jade fitted over the face of a Maya king of Palenque, sealed deep inside a temple-pyramid.' },
  tikal_lintel: { name: 'Carved Sapodilla Lintel', icon: '🪵', fame: 50, value: 150, desc: 'A hardwood lintel carved with a Maya lord enthroned beneath a giant jaguar protector.' },
  copan_stela: { name: 'Hieroglyphic Stela Fragment', icon: '📜', fame: 60, value: 150, desc: 'Covered in Maya glyphs recording the reigns of the kings of Copán — a written history no European could yet read.' },
  montealban_pectoral: { name: 'Mixtec Gold Pectoral', icon: '🌞', fame: 70, value: 600, desc: 'A cast-gold breastplate from a tomb on the mountaintop city of Monte Albán, made by the lost-wax method.' },
  olmec_jaguar: { name: 'Olmec Were-Jaguar Figure', icon: '🐆', fame: 70, value: 250, desc: 'Blue-green jade of the Olmec, the oldest civilization of Mesoamerica — already ancient when Rome ruled Spain.' },
  chichen_disc: { name: 'Gold Disc from the Sacred Cenote', icon: '🪙', fame: 70, value: 450, desc: 'Embossed gold dredged from the well of sacrifice at Chichén Itzá, showing warriors in battle.' },
  chavin_tenon: { name: 'Chavín Tenon Head', icon: '🗿', fame: 60, value: 120, desc: 'A snarling stone head that once projected from the temple walls of Chavín, nearly 3,000 years old.' },
  tiwanaku_relief: { name: 'Gateway God Relief', icon: '☀️', fame: 70, value: 200, desc: 'A carving of the Staff God from the high city of Tiwanaku beside Lake Titicaca, whose builders were forgotten even by the Inca.' },
  nazca_vessel: { name: 'Nazca Painted Vessel', icon: '🏺', fame: 50, value: 120, desc: 'A double-spouted polychrome jar. Nearby, giant lines etched on the desert can only be read from the hills.' },
  caral_quipu: { name: 'Ancient Knotted Quipu', icon: '🧶', fame: 70, value: 80, desc: 'Coloured knotted cords — the Andean way of recording numbers and perhaps words — from one of the oldest cities in the world.' },
  chimu_tumi: { name: 'Chimú Gold Tumi', icon: '🔪', fame: 60, value: 500, desc: 'A ceremonial gold knife from Chan Chan, the vast adobe capital of the Chimú, conquered by the Inca.' },
  kuelap_sarcophagus: { name: 'Chachapoya Sarcophagus Figure', icon: '⚱️', fame: 60, value: 100, desc: 'A clay funerary figure gazing out from a cliff above the cloud-forest fortress of Kuélap.' },
  machupicchu_llama: { name: 'Silver Llama Figurine', icon: '🦙', fame: 80, value: 350, desc: 'An offering found at a royal Inca estate on a mountain ridge above the Urubamba river.' },
  sanagustin_statue: { name: 'Eagle and Serpent Statue', icon: '🦅', fame: 60, value: 100, desc: 'A stone guardian from the mysterious burial grounds at the source of the Magdalena.' },
  eldorado_raft: { name: 'Golden Raft of El Dorado', icon: '🛶', fame: 150, value: 2000, desc: 'A tiny gold raft bearing a chieftain covered in gold dust — the Muisca ceremony that gave birth to the legend of El Dorado.' },
  youth_water: { name: 'Flask from the "Fountain of Youth"', icon: '💧', fame: 40, value: 0, desc: 'Just spring water. Your men drink it anyway. Nobody gets any younger.' },
  cahokia_chunkey: { name: 'Chunkey Stone', icon: '🥏', fame: 50, value: 60, desc: 'A polished stone disc for a game played in the plazas of Cahokia, once a city larger than London.' },
  mesaverde_pot: { name: 'Black-on-White Pottery Jar', icon: '🫙', fame: 50, value: 80, desc: 'From cliff dwellings abandoned two centuries before your arrival.' },
  chaco_turquoise: { name: 'Turquoise Mosaic of Chaco', icon: '🔷', fame: 60, value: 220, desc: 'Turquoise from great houses at the centre of a road network that crossed the desert.' },
  marajo_urn: { name: 'Marajoara Funerary Urn', icon: '⚱️', fame: 60, value: 100, desc: 'A painted urn from mounds at the mouth of the Amazon — proof that great societies once lived along the river.' },
  caguana_cemi: { name: 'Taíno Cemí Idol', icon: '🗿', fame: 50, value: 80, desc: 'A three-pointed stone cemí, home of a spirit, from a Taíno ceremonial ball court.' },
  moctezuma_headdress: { name: "Moctezuma's Quetzal Headdress", icon: '🪶', fame: 150, value: 1500, desc: 'Hundreds of shimmering green quetzal feathers set with gold — the regalia of the Huey Tlatoani.' },
  coricancha_disk: { name: 'Golden Sun Disk of the Coricancha', icon: '🌞', fame: 160, value: 4000, desc: 'From the Temple of the Sun, whose walls were sheathed in gold plates.' },
  mascaipacha: { name: 'Mascaipacha, Royal Fringe of the Sapa Inca', icon: '👑', fame: 120, value: 800, desc: 'The red woollen fringe worn only by the emperor. At Cajamarca, Atahualpa filled a room with gold for his ransom.' },
  muisca_tunjo: { name: 'Muisca Gold Tunjo', icon: '🥇', fame: 70, value: 500, desc: 'A flat gold votive figure, made to be offered to the gods in lakes and caves.' },
  kiche_jade: { name: "K'iche' Jade Necklace", icon: '📿', fame: 60, value: 400, desc: 'Royal jade from the highland capital of the K\'iche\' kings.' },
  tarascan_bell: { name: 'Tarascan Copper Bell', icon: '🔔', fame: 60, value: 200, desc: 'The Purépecha were the finest metalworkers of Mesoamerica.' },
  itza_codex: { name: 'Itza Bark-Paper Codex', icon: '📖', fame: 90, value: 200, desc: 'A folding book of painted glyphs. Nearly all such books were burned by missionaries; only four Maya codices survive today.' },
  calusa_panther: { name: 'Calusa Carved Panther', icon: '🐈', fame: 60, value: 120, desc: 'A kneeling cat-spirit figure of carved wood from the shell-mound capital of the Calusa.' },
  tairona_pendant: { name: 'Tairona Bat-Man Pendant', icon: '🦇', fame: 60, value: 450, desc: 'A gold pendant of a man transformed into a bat, cast in the mountain city of Teyuna.' },
  obsidian_blade: { name: 'Obsidian Blade', icon: '🗡️', fame: 25, value: 60, desc: 'Volcanic glass flaked sharper than any steel razor.' },
  feather_shield: { name: 'Feathered War Shield', icon: '🛡️', fame: 30, value: 120, desc: 'A war shield covered in a mosaic of coloured feathers.' },
  spondylus: { name: 'Spondylus Shell Necklace', icon: '🐚', fame: 25, value: 90, desc: 'The red "thorny oyster" shell was worth more than gold to many Andean peoples.' },
  serpent_effigy: { name: 'Serpent Effigy', icon: '🐍', fame: 30, value: 80, desc: 'A plumed serpent carved in stone — Quetzalcoatl, or Kukulkan.' },
  gold_nosering: { name: 'Gold Nose Ornament', icon: '💍', fame: 30, value: 200, desc: 'A hammered gold nose-piece worn by a lord.' },
  star_chart: { name: 'Carved Star Chart', icon: '✨', fame: 40, value: 70, desc: 'Movements of Venus recorded in stone with astonishing precision.' },
  jaguar_throne: { name: 'Jaguar Throne Fragment', icon: '🐾', fame: 35, value: 110, desc: 'Part of a red-painted throne in the shape of a jaguar.' },
  crystal_skull: { name: 'Rock Crystal Skull', icon: '💀', fame: 45, value: 150, desc: 'A skull of clear quartz. Your chaplain refuses to touch it.' },
};

// Discoveries: [id, name, lon, lat, radius(tiles), fame, text]
const DISCOVERIES = [
  ['canaries', 'Canary Islands', -15.5, 28.2, 3, 5, 'Castile\'s last stop before the open ocean.'],
  ['azores', 'The Azores', -27, 38.4, 4, 10, 'Portuguese isles in the middle of the Ocean Sea.'],
  ['guanahani', 'San Salvador (Guanahaní)', -74.5, 24.05, 3, 60, 'Land ho! Landfall in a world unknown to Europe.'],
  ['bahamas', 'The Lucayan Islands', -77, 25, 4, 15, 'Low islands of white sand and turquoise water.'],
  ['cuba', 'Cuba', -79, 21.8, 5, 30, 'An island so large some believe it is the mainland of Asia.'],
  ['hispaniola', 'La Española', -71, 19, 5, 30, 'A mountainous island of many caciques — and rumours of gold in its rivers.'],
  ['puertorico', 'Borikén (Puerto Rico)', -66.5, 18.2, 3, 20, 'A green island of the Taíno.'],
  ['jamaica', 'Jamaica (Xaymaca)', -77.3, 18.1, 3, 20, '"Land of wood and water".'],
  ['antilles', 'The Lesser Antilles', -61.3, 15, 4, 20, 'A chain of volcanic islands guarding the Caribbean.'],
  ['trinidad', 'Trinidad & the Gulf of Paria', -61.5, 10.3, 3, 25, 'Fresh water pours into the sea — this must be a vast continent.'],
  ['orinoco', 'Mouth of the Orinoco', -61, 8.6, 3, 30, 'Such a river can only come from a great land.'],
  ['florida', 'La Florida', -81.5, 27.5, 5, 40, 'A "land of flowers" sighted at Easter.'],
  ['bermuda', 'Las Bermudas', -64.75, 32.3, 2, 20, 'Lonely isles, rich in hogs and shipwrecks.'],
  ['gulf', 'Gulf of Mexico', -90, 25, 6, 30, 'A great enclosed sea.'],
  ['yucatan', 'Yucatán', -89, 20.5, 5, 40, 'Stone cities and people who wear cotton and write in books.'],
  ['mexico', 'Valley of Mexico', -99.1, 19.4, 4, 80, 'A city on a lake, larger than Sevilla, gleaming like a dream.'],
  ['mississippi', 'Río del Espíritu Santo (Mississippi)', -90.1, 30.5, 3, 50, 'A river of immense size.'],
  ['panama', 'Isthmus of Panama', -79.5, 9, 3, 30, 'Only a narrow neck of land separates two oceans.'],
  ['pacific', 'Mar del Sur (Pacific Ocean)', -79.6, 7.9, 3, 100, 'From a peak in Darién, a new ocean — the greatest on Earth.'],
  ['granada', 'Highlands of the Muisca', -74, 5, 4, 50, 'Cool fertile highlands rich in emeralds and gold.'],
  ['amazon', 'Río de las Amazonas', -55, -2.3, 4, 60, 'A river like a sea, named for warrior women of legend.'],
  ['brazil', 'Terra de Santa Cruz (Brazil)', -38.5, -13, 5, 30, 'Coast of brazilwood forests.'],
  ['plata', 'Río de la Plata', -57.5, -35, 4, 50, 'The "River of Silver" — so named for silver rumoured upstream.'],
  ['magellan', 'Strait of Magellan', -70, -52.8, 3, 120, 'A passage between the oceans at the end of the world.'],
  ['fuego', 'Tierra del Fuego', -68, -54, 3, 40, 'The fires of its people glitter along the shore at night.'],
  ['peru', 'Birú (Peru)', -80.4, -3.6, 4, 50, 'Llamas, fine cloth and talk of a mighty king in the mountains.'],
  ['andes', 'Cordillera of the Andes', -75, -10, 4, 40, 'Mountains higher than any in Europe, crossed by stone roads.'],
  ['titicaca', 'Lake Titicaca', -69.4, -15.8, 3, 60, 'A sacred lake high in the clouds, birthplace of the Inca.'],
  ['potosi', 'Cerro Rico de Potosí', -65.75, -19.6, 2, 100, 'A mountain made of silver! (+3000 treasure)'],
  ['atacama', 'Atacama Desert', -69.5, -24, 4, 25, 'The driest place on Earth.'],
  ['chile', 'Valley of Chile', -71, -33, 4, 40, 'A Mediterranean land, much like Castile.'],
  ['galapagos', 'Islas Encantadas (Galápagos)', -90.5, -0.6, 3, 60, 'Giant tortoises and birds that do not fear men.'],
  ['grandcanyon', 'Great Canyon of the Colorado', -112.1, 36.1, 3, 60, 'A chasm so deep the river below looks like a thread.'],
  ['baja', 'Island of California', -112, 28, 4, 30, 'Named for a fabled island of gold in a chivalric romance.'],
  ['acapulco', 'Pacific coast of New Spain', -99.9, 16.85, 3, 30, 'A sheltered harbour facing the South Sea.'],
  ['chesapeake', 'Bahía de Santa María (Chesapeake)', -76.2, 37.5, 3, 20, 'A great bay of the northern coast.'],
  ['falklands', 'Islas Malvinas', -59.5, -51.7, 3, 20, 'Windswept islands of the southern ocean.'],
];

const SHIPS = {
  caravel: { name: 'Caravel', men: 60, food: 400, hull: 100, speed: 1.0, cannons: 2, cost: 600 },
  nao: { name: 'Nao', men: 150, food: 800, hull: 160, speed: 0.92, cannons: 6, cost: 1800 },
  galleon: { name: 'Galleon', men: 400, food: 1600, hull: 260, speed: 0.85, cannons: 14, cost: 5000 },
};

const PRICES = { priest: 60, soldier: 25, horse: 80, arquebus: 40, cannon: 250, food: 1, goods: 2, repair: 2 };

const TITLES = [[0, 'Hidalgo'], [150, 'Capitán'], [400, 'Adelantado'], [900, 'Gobernador'], [1800, 'Marqués'], [3000, 'Virrey']];

const MONARCHS = [[1492, 'Isabella I & Ferdinand II'], [1504, 'Ferdinand II (regent)'], [1516, 'Charles I (Emperor Charles V)'], [1556, 'Philip II'], [1598, 'Philip III']];

const CHRONICLE = [
  [1494, 6, 'The Treaty of Tordesillas divides the newly found lands between Castile and Portugal along a line in the Atlantic.'],
  [1500, 4, 'Pedro Álvares Cabral claims Brazil for Portugal.'],
  [1503, 1, 'The Casa de Contratación is founded in Sevilla to control all trade with the Indies.'],
  [1511, 12, 'Friar Antonio de Montesinos preaches in Santo Domingo against the abuse of the Taíno: "Are these not men?"'],
  [1516, 1, 'Charles of Habsburg inherits the crowns of Castile and Aragon.'],
  [1519, 9, 'Ferdinand Magellan sails west to find a passage to the Spice Islands.'],
  [1522, 9, 'The Victoria returns to Spain — the first voyage around the world.'],
  [1542, 11, 'The New Laws forbid the enslavement of native peoples and limit the encomienda.'],
  [1550, 8, 'The Valladolid debate: Bartolomé de las Casas argues against Sepúlveda for the rights of native peoples.'],
  [1556, 1, 'Philip II becomes King of Spain.'],
  [1565, 6, 'The first Manila galleon links the Americas and Asia.'],
  [1571, 10, 'A Holy League fleet defeats the Ottomans at Lepanto.'],
  [1588, 8, 'The "Invincible" Armada is wrecked off England and Ireland.'],
  [1598, 9, 'Philip II dies at El Escorial.'],
];

const DISEASES = [
  { id: 'smallpox', name: 'Smallpox', rate: 0.075, months: 10 },
  { id: 'measles', name: 'Measles', rate: 0.05, months: 6 },
  { id: 'typhus', name: 'Typhus', rate: 0.04, months: 6 },
  { id: 'influenza', name: 'Influenza', rate: 0.03, months: 4 },
];

// ---------------------------------------------------------------------------
// Colony buildings. Each has levels 1-5; cost and time grow per level.
// Other buildings cannot rise above the Cabildo's level + 1.
// ---------------------------------------------------------------------------
const BUILDINGS = {
  cabildo: { name: 'Cabildo', icon: '🏛️', cost: 250, days: 30, desc: 'The town council. Raises the level cap of every other building and adds 25% tribute per level.' },
  barracks: { name: 'Barracks', icon: '⚔️', cost: 200, days: 25, desc: 'Draws Spanish settlers to enlist and trains native auxiliaries. More recruits each month per level.' },
  walls: { name: 'Walls & Fort', icon: '🏰', cost: 300, days: 40, desc: 'Stone walls and a fort. Each level strengthens the garrison against raids and revolts by 25%.' },
  church: { name: 'Church', icon: '⛪', cost: 180, days: 30, desc: 'Friars convert the townspeople a little every month, and preaching here works faster.' },
  fields: { name: 'Fields & Granary', icon: '🌽', cost: 150, days: 20, desc: 'Maize fields and a granary. Stores provisions every month for your expeditions.' },
  mine: { name: 'Mines', icon: '⛏️', cost: 400, days: 45, desc: 'Gold and silver every month, dug by forced native labour. The mines slowly kill the people who work them.' },
  harbor: { name: 'Harbour', icon: '⚓', cost: 250, days: 35, coastal: true, desc: 'Cheap ship repairs. At level 3 shipwrights build naos here, at level 5 galleons.' },
  stables: { name: 'Stables', icon: '🐎', cost: 220, days: 30, desc: 'Breeds horses from Spanish stock, sold here more cheaply than in Sevilla.' },
};
const BUILD_COST_MULT = [1, 2, 4, 7, 12];
const BUILD_DAYS_MULT = [1, 1.5, 2, 3, 4];
