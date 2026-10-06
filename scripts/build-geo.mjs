// Builds the offline geography data:
//   src/features/geo/data/countries.json  – 195 countries (UN members + Vatican + Palestine) from world-countries
//   src/features/geo/data/world.topo.json – world-atlas countries-50m (Natural Earth)
//   src/features/geo/data/uk.topo.json    – UK areas: England ceremonial counties (from Natural Earth admin-1, merged),
//                                            Scottish council areas, Welsh principal areas
//   public/flags/<cca2>.svg               – flag-icons (MIT) for those countries
// Natural Earth admin-1 is downloaded on demand into data/raw/ (public domain).
//
// Usage: node scripts/build-geo.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { topology } from 'topojson-server'
import { presimplify, simplify, quantile } from 'topojson-simplify'
import { merge, feature, neighbors } from 'topojson-client'
import { geoArea, geoCentroid } from 'd3-geo'

const require = createRequire(import.meta.url)
const root = new URL('..', import.meta.url).pathname
const out = `${root}src/features/geo/data/`
mkdirSync(out, { recursive: true })
mkdirSync(`${root}public/flags`, { recursive: true })
mkdirSync(`${root}data/raw`, { recursive: true })

// ---------- countries ----------
const all = require('world-countries')
const NE0 = await loadNE('ne_10m_admin_0_countries')
const pop = new Map()
for (const f of NE0.features) pop.set(f.properties.ADM0_A3, f.properties.POP_EST)
pop.set('SSD', pop.get('SDS') ?? pop.get('SSD'))

// Capitals with more than one accepted answer, or a common alternative. Checked by the fact-check pass.
const CAPITAL_ALTS = {
  BOL: ['Sucre', 'La Paz'],
  ZAF: ['Pretoria', 'Cape Town', 'Bloemfontein'],
  NLD: ['Amsterdam'],
  CIV: ['Yamoussoukro', 'Abidjan'],
  MYS: ['Kuala Lumpur'],
  LKA: ['Sri Jayawardenepura Kotte', 'Kotte', 'Colombo'],
  BEN: ['Porto-Novo'],
  PSE: ['Ramallah', 'East Jerusalem', 'Jerusalem'],
  ISR: ['Jerusalem'],
  SWZ: ['Mbabane', 'Lobamba'],
  MMR: ['Naypyidaw', 'Nay Pyi Taw', 'Naypyitaw'],
  KAZ: ['Astana', 'Nur-Sultan'],
  TZA: ['Dodoma'],
  NGA: ['Abuja'],
  IDN: ['Jakarta'],
}

const countries = all
  .filter((c) => c.unMember || ['VAT', 'PSE'].includes(c.cca3))
  .map((c) => ({
    id: c.cca3,
    ccn3: c.ccn3,
    flag: c.cca2.toLowerCase(),
    name: c.name.common,
    alt: [...new Set([c.name.official, ...c.altSpellings.filter((s) => s.length > 3 && /[a-z]/.test(s))])].filter((s) => s !== c.name.common),
    capital: CAPITAL_ALTS[c.cca3] ?? c.capital,
    region: c.region,
    subregion: c.subregion,
    lat: c.latlng[0],
    lon: c.latlng[1],
    borders: c.borders,
    area: c.area,
    pop: pop.get(c.cca3) ?? null,
  }))
  .sort((a, b) => (b.pop ?? 0) - (a.pop ?? 0))
if (countries.length !== 195) throw new Error(`expected 195 countries, got ${countries.length}`)
writeFileSync(`${out}countries.json`, JSON.stringify(countries))
for (const c of countries) copyFileSync(require.resolve(`flag-icons/flags/4x3/${c.flag}.svg`), `${root}public/flags/${c.flag}.svg`)

// ---------- world map ----------
const world = require('world-atlas/countries-50m.json')
writeFileSync(`${out}world.topo.json`, JSON.stringify(world))

// ---------- UK areas ----------
const CEREMONIAL = {
  Bedfordshire: ['Luton', 'Central Bedfordshire', 'Bedford'],
  Berkshire: ['West Berkshire', 'Wokingham', 'Bracknell Forest', 'Royal Borough of Windsor and Maidenhead', 'Slough', 'Reading'],
  Bristol: ['Bristol'],
  Buckinghamshire: ['Buckinghamshire', 'Milton Keynes'],
  Cambridgeshire: ['Cambridgeshire', 'Peterborough'],
  Cheshire: ['Cheshire West and Chester', 'Cheshire East', 'Halton', 'Warrington'],
  Cornwall: ['Cornwall', 'Isles of Scilly'],
  Cumbria: ['Cumbria'],
  Derbyshire: ['Derbyshire', 'Derby'],
  Devon: ['Devon', 'Torbay', 'Plymouth'],
  Dorset: ['Dorset', 'Bournemouth', 'Poole'],
  Durham: ['Durham', 'Hartlepool', 'Darlington', 'Stockton-on-Tees'],
  'East Riding of Yorkshire': ['East Riding of Yorkshire', 'Kingston upon Hull'],
  'East Sussex': ['East Sussex', 'Brighton and Hove'],
  Essex: ['Essex', 'Southend-on-Sea', 'Thurrock'],
  Gloucestershire: ['Gloucestershire', 'South Gloucestershire'],
  'Greater London': ['Wandsworth', 'Merton', 'Westminster', 'Kensington and Chelsea', 'Hounslow', 'Ealing', 'Hammersmith and Fulham', 'Richmond upon Thames', 'City', 'Tower Hamlets', 'Enfield', 'Barnet', 'Waltham Forest', 'Redbridge', 'Havering', 'Bexley', 'Sutton', 'Hillingdon', 'Brent', 'Harrow', 'Camden', 'Islington', 'Lambeth', 'Southwark', 'Croydon', 'Lewisham', 'Haringey', 'Kingston upon Thames', 'Newham', 'Greenwich', 'Hackney', 'Barking and Dagenham', 'Bromley'],
  'Greater Manchester': ['Wigan', 'Stockport', 'Salford', 'Bolton', 'Trafford', 'Manchester', 'Oldham', 'Rochdale', 'Tameside', 'Bury'],
  Hampshire: ['Hampshire', 'Portsmouth', 'Southampton'],
  Herefordshire: ['Herefordshire'],
  Hertfordshire: ['Hertfordshire'],
  'Isle of Wight': ['Isle of Wight'],
  Kent: ['Kent', 'Medway'],
  Lancashire: ['Lancashire', 'Blackpool', 'Blackburn with Darwen'],
  Leicestershire: ['Leicestershire', 'Leicester'],
  Lincolnshire: ['Lincolnshire', 'North Lincolnshire', 'North East Lincolnshire'],
  Merseyside: ['Knowsley', 'Liverpool', 'Sefton', 'Merseyside'],
  Norfolk: ['Norfolk'],
  'North Yorkshire': ['North Yorkshire', 'York', 'Middlesbrough', 'Redcar and Cleveland'],
  Northamptonshire: ['Northamptonshire'],
  Northumberland: ['Northumberland'],
  Nottinghamshire: ['Nottinghamshire', 'Nottingham'],
  Oxfordshire: ['Oxfordshire'],
  Rutland: ['Rutland'],
  Shropshire: ['Shropshire', 'Telford and Wrekin'],
  Somerset: ['Somerset', 'North Somerset', 'Bath and North East Somerset'],
  'South Yorkshire': ['Doncaster', 'Rotherham', 'Sheffield', 'Barnsley'],
  Staffordshire: ['Staffordshire', 'Stoke-on-Trent'],
  Suffolk: ['Suffolk'],
  Surrey: ['Surrey'],
  'Tyne and Wear': ['North Tyneside', 'South Tyneside', 'Sunderland', 'Gateshead', 'Newcastle upon Tyne'],
  Warwickshire: ['Warwickshire'],
  'West Midlands': ['Solihull', 'Coventry', 'Birmingham', 'Sandwell', 'Dudley', 'Walsall', 'Wolverhampton'],
  'West Sussex': ['West Sussex'],
  'West Yorkshire': ['Calderdale', 'Kirklees', 'Leeds', 'Bradford', 'Wakefield'],
  Wiltshire: ['Wiltshire', 'Swindon'],
  Worcestershire: ['Worcestershire'],
}
// Natural Earth spellings → official council-area / principal-area names.
const RENAME = {
  'Perthshire and Kinross': 'Perth and Kinross', 'North Ayshire': 'North Ayrshire', Edinburgh: 'City of Edinburgh', Glasgow: 'Glasgow City',
  Aberdeen: 'Aberdeen City', Dundee: 'Dundee City', 'Eilean Siar': 'Na h-Eileanan Siar', 'Shetland Islands': 'Shetland Islands',
  'Rhondda, Cynon, Taff': 'Rhondda Cynon Taf', Anglesey: 'Isle of Anglesey',
}
const ALSO = { 'Na h-Eileanan Siar': ['Western Isles', 'Outer Hebrides', 'Eilean Siar'], 'City of Edinburgh': ['Edinburgh'], 'Glasgow City': ['Glasgow'], 'Aberdeen City': ['Aberdeen'], 'Dundee City': ['Dundee'], 'Isle of Anglesey': ['Anglesey', 'Ynys Môn'], Shetland: ['Shetland'], 'Rhondda Cynon Taf': ['Rhondda Cynon Taff'] }

const NE1 = await loadNE('ne_10m_admin_1_states_provinces')
const gbAll = NE1.features.filter((f) => f.properties.adm0_a3 === 'GBR')
// Northern Ireland's Natural Earth units are the pre-2015 districts, which don't match its six counties,
// so NI is drawn as an outline only and its counties are point-based questions.
const gb = gbAll.filter((f) => f.properties.geonunit !== 'Northern Ireland')
const ni = gbAll.filter((f) => f.properties.geonunit === 'Northern Ireland')
const unitToArea = new Map()
for (const [county, units] of Object.entries(CEREMONIAL)) for (const u of units) unitToArea.set(`England|${u}`, county)
const features = []
const unassigned = []
for (const f of gb) {
  const nation = f.properties.geonunit
  let area
  if (nation === 'England') area = unitToArea.get(`England|${f.properties.name}`)
  else area = RENAME[f.properties.name] ?? f.properties.name
  if (!area) { unassigned.push(f.properties.name); continue }
  features.push({ type: 'Feature', properties: { area, nation }, geometry: f.geometry })
}
if (unassigned.length) throw new Error(`Unassigned English units: ${unassigned.join(', ')}`)
for (const f of ni) features.push({ type: 'Feature', properties: { area: null, nation: 'Northern Ireland' }, geometry: f.geometry })
const topoRaw = topology({ units: { type: 'FeatureCollection', features } }, 1e5)
const pre = presimplify(topoRaw)
const topo = simplify(pre, quantile(pre, 0.12))
// Merge units into areas.
const byArea = new Map()
topo.objects.units.geometries.forEach((g) => {
  if (!g.properties.area) return
  const list = byArea.get(g.properties.area) ?? []
  list.push(g)
  byArea.set(g.properties.area, list)
})
const areaFeatures = [...byArea].map(([area, geoms]) => ({
  type: 'Feature',
  properties: { id: slug(area), name: area, nation: geoms[0].properties.nation, alt: ALSO[area] ?? [] },
  geometry: merge(topo, geoms),
}))
const nationFeatures = ['England', 'Scotland', 'Wales', 'Northern Ireland'].map((n) => ({
  type: 'Feature', properties: { name: n }, geometry: merge(topo, topo.objects.units.geometries.filter((g) => g.properties.nation === n)),
}))
const ukTopo = topology({ areas: { type: 'FeatureCollection', features: areaFeatures }, nations: { type: 'FeatureCollection', features: nationFeatures } }, 1e5)
writeFileSync(`${out}uk.topo.json`, JSON.stringify(ukTopo))
// Area list with centroid, size and neighbours (used to build cards and grade near-misses).
const areasFc = feature(ukTopo, ukTopo.objects.areas)
const nb = neighbors(ukTopo.objects.areas.geometries)
const ukAreas = areasFc.features.map((f, i) => {
  const [lon, lat] = geoCentroid(f)
  return {
    id: f.properties.id, name: f.properties.name, nation: f.properties.nation, alt: f.properties.alt,
    lat: +lat.toFixed(4), lon: +lon.toFixed(4), areaKm2: Math.round(geoArea(f) * 6371 ** 2),
    neighbours: nb[i].map((j) => areasFc.features[j].properties.id),
  }
})
writeFileSync(`${out}ukAreas.json`, JSON.stringify(ukAreas))

const counts = { England: 0, Scotland: 0, Wales: 0 }
for (const f of areaFeatures) counts[f.properties.nation]++
console.log(`countries: ${countries.length}; UK areas: ${JSON.stringify(counts)}; uk.topo ${Math.round(JSON.stringify(ukTopo).length / 1024)}KB`)

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function loadNE(name) {
  const file = `${root}data/raw/${name}.geojson`
  if (!existsSync(file)) {
    const res = await fetch(`https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/${name}.geojson`)
    if (!res.ok) throw new Error(`download ${name}: ${res.status}`)
    writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  }
  return JSON.parse(readFileSync(file, 'utf8'))
}
