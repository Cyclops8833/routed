// Routed — Curated Destinations Database
// Maintained by Ian via Claude Code. To add a new spot, add an entry here, commit, and push.
// Vercel redeploys automatically.
//
// Sources cross-referenced:
// - VFA Fish Stocking Database (vfa.vic.gov.au/stockingdatabase)
// - Fishing Victoria Forum (fishing-victoria.com)
// - Parks Victoria (parks.vic.gov.au)
// - VRFish camping + fishing guides
// - WikiCamps data
// - Crew first-hand knowledge
//
// Last updated: March 2026

export type Activity = "camping" | "hiking" | "fishing" | "4wd";
export type RoadType = "sealed" | "unsealed" | "4wd-only";
export type Season = "summer" | "autumn" | "winter" | "spring";
export type TripLength = "overnighter" | "long-weekend";

export interface Destination {
  id: string;
  name: string;
  description: string;
  lat: number;
  lng: number;
  nearestTown: string;
  region: string;
  campsites: string[];
  campsiteCostPerNight: number;
  activities: Activity[];
  roadType: RoadType;
  bestSeasons: Season[];
  tripLength: TripLength[];
  crewNotes: string | null;
  fishSpecies: string[];
  tags: string[];
}

export const destinations: Destination[] = [
  // ============================================================
  // HIGH COUNTRY
  // ============================================================
  {
    id: "harrietville-ovens-east",
    name: "Harrietville / Ovens River East Branch",
    description:
      "Bush camping along the east branch of the Ovens River, a few kilometres hike in from the trailhead near Harrietville. Crystal clear alpine water, excellent rainbow and brown trout fishing in a pristine river setting.",
    lat: -36.897,
    lng: 147.07,
    nearestTown: "Harrietville",
    region: "High Country",
    campsites: ["Dispersed riverside sites (hike-in)"],
    campsiteCostPerNight: 0,
    activities: ["camping", "hiking", "fishing"],
    roadType: "sealed",
    bestSeasons: ["summer", "autumn"],
    tripLength: ["long-weekend"],
    crewNotes:
      "The boys' spot. Rainbow trout fishing up the Ovens east arm — hike a few km in with your gear. Cold river, good campsites along the bank. Overdue for a return trip.",
    fishSpecies: ["Rainbow trout", "Brown trout"],
    tags: ["free camping", "hike-in", "trout", "river", "alpine"],
  },
  {
    id: "lake-eildon-fraser",
    name: "Lake Eildon / Fraser Camping Area",
    description:
      "Large reservoir in the High Country foothills. Excellent fishing for trout, golden perch, and Murray cod. Fraser Camping Area offers shaded lakeside sites with good facilities. Boat ramp access nearby.",
    lat: -37.231,
    lng: 145.911,
    nearestTown: "Eildon",
    region: "High Country",
    campsites: ["Fraser Camping Area", "Coller Bay", "Jerusalem Creek"],
    campsiteCostPerNight: 20,
    activities: ["camping", "hiking", "fishing"],
    roadType: "sealed",
    bestSeasons: ["summer", "autumn", "winter", "spring"],
    tripLength: ["overnighter", "long-weekend"],
    crewNotes: null,
    fishSpecies: ["Brown trout", "Rainbow trout", "Golden perch", "Murray cod"],
    tags: ["lake", "boat ramp", "stocked", "facilities"],
  },
  {
    id: "jamieson-river-kevington",
    name: "Jamieson River / Kevington",
    description:
      "River camping in gold country. The Jamieson River holds good brown trout and the area has a historic gold panning legacy. Dispersed free camping along the river with unsealed road access for the last section.",
    lat: -37.311,
    lng: 146.258,
    nearestTown: "Jamieson",
    region: "High Country",
    campsites: ["Dispersed river sites", "Kevington camping area"],
    campsiteCostPerNight: 0,
    activities: ["camping", "fishing", "hiking"],
    roadType: "unsealed",
    bestSeasons: ["summer", "autumn"],
    tripLength: ["overnighter", "long-weekend"],
    crewNotes: null,
    fishSpecies: ["Brown trout"],
    tags: ["free camping", "river", "gold history", "trout"],
  },
  {
    id: "howqua-river",
    name: "Howqua River / Sheepyard Flat",
    description:
      "One of Victoria's most popular river camping areas in the High Country. The Howqua is a beautiful trout stream with easy access. Sheepyard Flat has good facilities and is a solid base for day walks. Gets busy in peak season.",
    lat: -37.194,
    lng: 146.345,
    nearestTown: "Mansfield",
    region: "High Country",
    campsites: ["Sheepyard Flat", "Tunnel Bend", "Fry's Flat"],
    campsiteCostPerNight: 0,
    activities: ["camping", "fishing", "hiking"],
    roadType: "unsealed",
    bestSeasons: ["summer", "autumn", "spring"],
    tripLength: ["overnighter", "long-weekend"],
    crewNotes: null,
    fishSpecies: ["Brown trout", "Rainbow trout"],
    tags: ["free camping", "river", "trout", "popular", "family friendly"],
  },
  {
    id: "buckland-valley",
    name: "Buckland Valley",
    description:
      "Bush camping along the Buckland River between Bright and Porepunkah. Beautiful brown trout water that's regularly stocked. Several dispersed sites along the valley road with river frontage. Close to Bright for supplies.",
    lat: -36.692,
    lng: 146.899,
    nearestTown: "Bright",
    region: "High Country",
    campsites: ["Dispersed sites along Buckland Valley Road"],
    campsiteCostPerNight: 0,
    activities: ["camping", "fishing", "hiking"],
    roadType: "unsealed",
    bestSeasons: ["summer", "autumn"],
    tripLength: ["overnighter", "long-weekend"],
    crewNotes: null,
    fishSpecies: ["Brown trout"],
    tags: ["free camping", "river", "trout", "stocked", "near Bright"],
  },
  {
    id: "lake-catani-buffalo",
    name: "Lake Catani / Mount Buffalo",
    description:
      "Alpine camping at 1300m elevation in Mount Buffalo National Park. Lake Catani is a stunning glacial-era lake surrounded by granite boulders and Snow Gums. Swimming, bushwalks to waterfalls and The Horn lookout. Book ahead in summer.",
    lat: -36.738,
    lng: 146.76,
    nearestTown: "Bright",
    region: "High Country",
    campsites: ["Lake Catani Campground"],
    campsiteCostPerNight: 25,
    activities: ["camping", "hiking"],
    roadType: "sealed",
    bestSeasons: ["summer", "spring"],
    tripLength: ["overnighter", "long-weekend"],
    crewNotes: null,
    fishSpecies: [],
    tags: ["alpine", "lake", "granite", "swimming", "bushwalks", "bookings required"],
  },
  {
    id: "lake-william-hovell",
    name: "Lake William Hovell",
    description:
      "Quiet lake south of the King Valley, regularly stocked with brown trout. Surrounded by state forest with good campground facilities. Excellent fly fishing from the shore or kayak. Less crowded than Eildon.",
    lat: -36.917,
    lng: 146.388,
    nearestTown: "Whitfield",
    region: "High Country",
    campsites: ["Lake William Hovell Camping Area"],
    campsiteCostPerNight: 0,
    activities: ["camping", "fishing", "hiking"],
    roadType: "sealed",
    bestSeasons: ["summer", "autumn", "spring"],
    tripLength: ["overnighter", "long-weekend"],
    crewNotes: null,
    fishSpecies: ["Brown trout"],
    tags: ["free camping", "lake", "trout", "stocked", "quiet"],
  },
  {
    id: "wonnangatta-valley",
    name: "Wonnangatta Valley",
    description:
      "Iconic 4WD destination deep in the Alpine National Park. 222km loop through remote valleys, historic cattlemen's huts, and the ruins of Wonnangatta Station — site of an unsolved 1918 double murder. Proper adventure driving.",
    lat: -37.233,
    lng: 146.825,
    nearestTown: "Dargo",
    region: "High Country",
    campsites: [
      "Wonnangatta Station",
      "Herne Spur",
      "Talbotville",
      "Horseyard Flat",
    ],
    campsiteCostPerNight: 0,
    activities: ["camping", "hiking", "4wd"],
    roadType: "4wd-only",
    bestSeasons: ["summer", "autumn"],
    tripLength: ["long-weekend"],
    crewNotes:
      "Proper remote. Need at least one 4WD. The drive in through Billy Goat Bluff Track is half the adventure. Check Parks Vic for fire closures before heading out — parts were closed in 2025/26 due to Dargo complex fires.",
    fishSpecies: [],
    tags: [
      "4wd",
      "remote",
      "free camping",
      "historic",
      "adventure",
      "unsolved murder",
    ],
  },
  {
    id: "king-river-valley",
    name: "King River / Riverside King Valley",
    description:
      "River camping in the King Valley wine region. The King River holds brown trout and is a pleasant, accessible waterway. Several camping options from free bush sites to private properties with facilities. Wineries nearby if that's your thing.",
    lat: -36.799,
    lng: 146.426,
    nearestTown: "Whitfield",
    region: "High Country",
    campsites: ["Riverside King Valley", "Crown frontage dispersed sites"],
    campsiteCostPerNight: 15,
    activities: ["camping", "fishing", "hiking"],
    roadType: "sealed",
    bestSeasons: ["summer", "autumn", "spring"],
    tripLength: ["overnighter", "long-weekend"],
    crewNotes: null,
    fishSpecies: ["Brown trout"],
    tags: ["river", "trout", "wine region", "accessible"],
  },
  {
    id: "delatite-river-mansfield",
    name: "Delatite River / Mansfield Area",
    description:
      "Beautiful trout stream near Mansfield in the High Country foothills. Excellent fly fishing water with good access points. Mansfield offers accommodation and supplies, with several camping options nearby in state forest.",
    lat: -37.15,
    lng: 146.127,
    nearestTown: "Mansfield",
    region: "High Country",
    campsites: ["State forest dispersed sites near Delatite"],
    campsiteCostPerNight: 0,
    activities: ["camping", "fishing", "hiking"],
    roadType: "sealed",
    bestSeasons: ["summer", "autumn", "spring"],
    tripLength: ["overnighter"],
    crewNotes: null,
    fishSpecies: ["Rainbow trout", "Brown trout"],
    tags: ["free camping", "river", "trout", "fly fishing"],
  },
  {
    id: "lake-nillahcootie",
    name: "Lake Nillahcootie",
    description:
      "Smaller lake south of Benalla, well stocked with Murray cod, golden perch, and trout. Quieter alternative to Eildon with good shore-based fishing. Camping at the lake's edge with basic facilities.",
    lat: -36.875,
    lng: 145.999,
    nearestTown: "Benalla",
    region: "High Country",
    campsites: ["Lake Nillahcootie Caravan Park"],
    campsiteCostPerNight: 20,
    activities: ["camping", "fishing"],
    roadType: "sealed",
    bestSeasons: ["summer", "autumn", "spring"],
    tripLength: ["overnighter"],
    crewNotes: "Closer to Hesko than most High Country spots. Could work as a shorter trip option.",
    fishSpecies: ["Murray cod", "Golden perch", "Brown trout", "Redfin"],
    tags: ["lake", "stocked", "Murray cod", "accessible"],
  },

  // ============================================================
  // GIPPSLAND
  // ============================================================
  {
    id: "tidal-river-prom",
    name: "Tidal River / Wilsons Promontory",
    description:
      "Victoria's most iconic coastal national park. Tidal River campground sits on a stunning beach backed by granite headlands. World-class bushwalks including the Prom circuit. Book well ahead — always in demand.",
    lat: -39.035,
    lng: 146.32,
    nearestTown: "Yanakie",
    region: "Gippsland",
    campsites: ["Tidal River Campground"],
    campsiteCostPerNight: 45,
    activities: ["camping", "hiking"],
    roadType: "sealed",
    bestSeasons: ["summer", "spring"],
    tripLength: ["long-weekend"],
    crewNotes: null,
    fishSpecies: [],
    tags: ["coastal", "national park", "bookings required", "iconic", "bushwalks"],
  },
  {
    id: "thompson-river-walhalla",
    name: "Thompson River / Walhalla Area",
    description:
      "Free camping along the Thompson River just before historic Walhalla. Hidden gem for brown trout and bass. The old gold mining town of Walhalla is worth exploring. Great bush camping with river access.",
    lat: -37.969,
    lng: 146.419,
    nearestTown: "Walhalla",
    region: "Gippsland",
    campsites: ["Dispersed sites along Thomson River Road"],
    campsiteCostPerNight: 0,
    activities: ["camping", "fishing", "hiking"],
    roadType: "unsealed",
    bestSeasons: ["summer", "autumn"],
    tripLength: ["overnighter", "long-weekend"],
    crewNotes: null,
    fishSpecies: ["Brown trout", "Australian bass"],
    tags: ["free camping", "river", "gold history", "trout", "bass", "hidden gem"],
  },
  {
    id: "aberfeldy-river",
    name: "Aberfeldy River / Baw Baw",
    description:
      "Remote riverside camping in Baw Baw National Park. Only eight sites, no caravan access, 4WD recommended. Waterfall walks nearby. Proper off-grid experience for those who earn their campsite.",
    lat: -37.79,
    lng: 146.228,
    nearestTown: "Aberfeldy",
    region: "Gippsland",
    campsites: ["Aberfeldy River Campground"],
    campsiteCostPerNight: 0,
    activities: ["camping", "hiking", "4wd"],
    roadType: "4wd-only",
    bestSeasons: ["summer", "autumn"],
    tripLength: ["overnighter", "long-weekend"],
    crewNotes: null,
    fishSpecies: ["Brown trout"],
    tags: ["free camping", "remote", "4wd", "waterfall", "river", "limited sites"],
  },
  {
    id: "blue-rock-lake",
    name: "Blue Rock Lake",
    description:
      "Quiet lake east of Moe stocked with brown trout. Surrounded by state forest with free camping nearby. Good shore-based fishing and kayak fishing. A solid option for Gippsland-based overnighters.",
    lat: -38.06,
    lng: 146.176,
    nearestTown: "Moe",
    region: "Gippsland",
    campsites: ["Blue Rock Lake Recreation Area"],
    campsiteCostPerNight: 0,
    activities: ["camping", "fishing", "hiking"],
    roadType: "sealed",
    bestSeasons: ["summer", "autumn", "spring"],
    tripLength: ["overnighter"],
    crewNotes: null,
    fishSpecies: ["Brown trout"],
    tags: ["free camping", "lake", "trout", "stocked", "quiet"],
  },
  {
    id: "mitchellriver-den-of-nargun",
    name: "Mitchell River / Den of Nargun",
    description:
      "Mitchell River National Park in East Gippsland. Camp at Angusvale (4WD access) or Billy Goat Bend and walk to the Den of Nargun — a sacred Aboriginal rock overhang. The Mitchell holds Australian bass.",
    lat: -37.589,
    lng: 147.352,
    nearestTown: "Bairnsdale",
    region: "Gippsland",
    campsites: ["Angusvale Camping Area", "Billy Goat Bend"],
    campsiteCostPerNight: 0,
    activities: ["camping", "hiking", "fishing", "4wd"],
    roadType: "4wd-only",
    bestSeasons: ["summer", "autumn", "spring"],
    tripLength: ["long-weekend"],
    crewNotes: null,
    fishSpecies: ["Australian bass"],
    tags: ["4wd", "free camping", "river", "indigenous heritage", "national park"],
  },
  {
    id: "glenmaggie-lake",
    name: "Lake Glenmaggie",
    description:
      "Lake in the Gippsland hinterland stocked with Australian bass and surrounded by state forest. Boat ramp access, good facilities. Quieter alternative to Eildon with solid fishing. Near the start of the Macalister River.",
    lat: -37.916,
    lng: 146.756,
    nearestTown: "Heyfield",
    region: "Gippsland",
    campsites: ["Lake Glenmaggie Caravan Park", "Nearby state forest sites"],
    campsiteCostPerNight: 15,
    activities: ["camping", "fishing"],
    roadType: "sealed",
    bestSeasons: ["summer", "autumn"],
    tripLength: ["overnighter"],
    crewNotes: null,
    fishSpecies: ["Australian bass"],
    tags: ["lake", "stocked", "bass", "boat ramp"],
  },
  {
    id: "ninety-mile-beach-seaspray",
    name: "Ninety Mile Beach / Shoreline Drive",
    description:
      "Free coastal camping along Shoreline Drive at Golden Beach/Seaspray. 19 campgrounds, 65+ sites, first-in first-served. Shore fishing for gummy shark, flathead, salmon, and whiting. As remote as coastal camping gets in Gippsland.",
    lat: -38.264,
    lng: 147.035,
    nearestTown: "Seaspray",
    region: "Gippsland",
    campsites: ["Shoreline Drive Campgrounds 1-19"],
    campsiteCostPerNight: 0,
    activities: ["camping", "fishing"],
    roadType: "sealed",
    bestSeasons: ["summer", "autumn"],
    tripLength: ["overnighter", "long-weekend"],
    crewNotes: null,
    fishSpecies: ["Gummy shark", "Flathead", "Australian salmon", "Whiting"],
    tags: ["free camping", "coastal", "beach", "surf fishing"],
  },

  // ============================================================
  // GRAMPIANS / WESTERN VICTORIA
  // ============================================================
  {
    id: "grampians-smiths-mill",
    name: "Grampians / Smiths Mill Campground",
    description:
      "Bush camping in the Grampians with access to iconic walks like the Pinnacle and Mackenzie Falls. Smiths Mill is a quieter campground away from Halls Gap crowds. Wallabies, emus, and koalas in abundance.",
    lat: -37.163,
    lng: 142.479,
    nearestTown: "Halls Gap",
    region: "Grampians",
    campsites: ["Smiths Mill Campground", "Borough Huts", "Jimmy Creek"],
    campsiteCostPerNight: 15,
    activities: ["camping", "hiking"],
    roadType: "sealed",
    bestSeasons: ["spring", "autumn"],
    tripLength: ["overnighter", "long-weekend"],
    crewNotes: null,
    fishSpecies: [],
    tags: ["national park", "bushwalks", "rock formations", "wildlife"],
  },
  {
    id: "lake-wartook-grampians",
    name: "Lake Wartook / Grampians West",
    description:
      "Attractive lake on the western side of the Grampians, well regarded for trout fishing by bait and fly anglers. Quieter than the main Grampians campgrounds. Surrounded by native bush with good walking tracks.",
    lat: -37.09,
    lng: 142.433,
    nearestTown: "Halls Gap",
    region: "Grampians",
    campsites: ["Lake Wartook campground"],
    campsiteCostPerNight: 0,
    activities: ["camping", "fishing", "hiking"],
    roadType: "unsealed",
    bestSeasons: ["spring", "autumn", "winter"],
    tripLength: ["overnighter", "long-weekend"],
    crewNotes: "Good option when planning trips around Archer in Ballarat — closer for him and Hesko.",
    fishSpecies: ["Rainbow trout", "Brown trout", "Redfin"],
    tags: ["free camping", "lake", "trout", "fly fishing", "quiet"],
  },
  {
    id: "rocklands-reservoir",
    name: "Rocklands Reservoir / Glendinning",
    description:
      "Massive reservoir west of the Grampians, emerging as a serious native fishery. Over 1.4 million Murray cod and 605,000 golden perch stocked since 2017. Glendinning Campground has boat access, toilets, and room to spread out.",
    lat: -37.231,
    lng: 141.973,
    nearestTown: "Balmoral",
    region: "Grampians",
    campsites: [
      "Glendinning Campground",
      "Brodies Corner",
      "Beear Fossicking Area",
    ],
    campsiteCostPerNight: 0,
    activities: ["camping", "fishing"],
    roadType: "sealed",
    bestSeasons: ["summer", "autumn", "spring"],
    tripLength: ["long-weekend"],
    crewNotes: null,
    fishSpecies: [
      "Murray cod",
      "Golden perch",
      "Rainbow trout",
      "Brown trout",
      "Redfin",
    ],
    tags: ["free camping", "lake", "Murray cod", "stocked", "boat ramp"],
  },

  // ============================================================
  // GOLDFIELDS / CENTRAL VICTORIA
  // ============================================================
  {
    id: "cathedral-range",
    name: "Cathedral Range State Park",
    description:
      "Dramatic ridgeline walks and rock scrambling just north of Melbourne. Neds Gully camping area sits in a valley surrounded by towering rock formations. The Cathedral itself is a challenging but rewarding ridge walk.",
    lat: -37.377,
    lng: 145.738,
    nearestTown: "Buxton",
    region: "Yarra Ranges",
    campsites: ["Neds Gully", "Cooks Mill"],
    campsiteCostPerNight: 15,
    activities: ["camping", "hiking"],
    roadType: "sealed",
    bestSeasons: ["spring", "autumn"],
    tripLength: ["overnighter"],
    crewNotes: null,
    fishSpecies: [],
    tags: ["ridge walk", "rock scrambling", "close to Melbourne", "state park"],
  },
  {
    id: "tullaroop-reservoir",
    name: "Tullaroop Reservoir",
    description:
      "Lake near Maryborough in the Goldfields, known for fly fishing for trout. Tullaroop is stocked with rainbow trout and has good shore access. Rodborough Vale nearby offers private camping on a working sheep property with creek frontage.",
    lat: -37.101,
    lng: 143.875,
    nearestTown: "Maryborough",
    region: "Goldfields",
    campsites: ["Rodborough Vale (private, Hipcamp)", "Nearby free sites"],
    campsiteCostPerNight: 15,
    activities: ["camping", "fishing"],
    roadType: "sealed",
    bestSeasons: ["autumn", "winter", "spring"],
    tripLength: ["overnighter"],
    crewNotes: "Central location — works well when Hesko and Doug are both coming, roughly equidistant from Bendigo and Kyneton.",
    fishSpecies: ["Rainbow trout", "Brown trout"],
    tags: ["lake", "trout", "fly fishing", "goldfields", "stocked"],
  },
  {
    id: "lake-eppalock",
    name: "Lake Eppalock",
    description:
      "Large reservoir north of Kyneton. Heavily stocked with Murray cod (80,000 in 2017 alone) and popular for boat-based fishing. No camping directly on the lake, but multiple options within 15 minutes.",
    lat: -36.867,
    lng: 144.504,
    nearestTown: "Heathcote",
    region: "Goldfields",
    campsites: ["Kimbolton camping area", "Heathcote caravan parks"],
    campsiteCostPerNight: 20,
    activities: ["camping", "fishing"],
    roadType: "sealed",
    bestSeasons: ["summer", "autumn", "spring"],
    tripLength: ["overnighter"],
    crewNotes: "Very close to Doug in Kyneton. Note: no camping directly on the lake — use nearby campgrounds.",
    fishSpecies: ["Murray cod", "Golden perch", "Redfin"],
    tags: ["lake", "Murray cod", "stocked", "boat fishing"],
  },
  {
    id: "goulburn-river-seymour",
    name: "Goulburn River / Seymour–Nagambie",
    description:
      "The Goulburn between Seymour and Nagambie is prime Murray cod water, with massive stocking over recent years. Several free bush camping spots along the river. The stretch around Toolamba and Shepparton/Mooroopna area also fishes well.",
    lat: -37.031,
    lng: 145.133,
    nearestTown: "Seymour",
    region: "Goldfields",
    campsites: [
      "Major Creek Reserve near Nagambie",
      "Crown frontage dispersed sites",
    ],
    campsiteCostPerNight: 0,
    activities: ["camping", "fishing"],
    roadType: "sealed",
    bestSeasons: ["summer", "autumn"],
    tripLength: ["overnighter"],
    crewNotes: null,
    fishSpecies: ["Murray cod", "Golden perch", "Redfin"],
    tags: ["free camping", "river", "Murray cod", "stocked"],
  },
  {
    id: "hepburn-lagoon",
    name: "Hepburn Lagoon / Daylesford Area",
    description:
      "Shallow lagoon near Daylesford stocked with brown trout and known for excellent fly fishing. The Goldfields region around Daylesford also has Jubilee Lake for a quick cast. Good camping in the surrounding state forest.",
    lat: -37.376,
    lng: 144.003,
    nearestTown: "Daylesford",
    region: "Goldfields",
    campsites: ["Lerderderg State Forest sites", "Nearby caravan parks"],
    campsiteCostPerNight: 0,
    activities: ["camping", "fishing", "hiking"],
    roadType: "sealed",
    bestSeasons: ["autumn", "winter", "spring"],
    tripLength: ["overnighter"],
    crewNotes: "Good halfway point between Archer (Ballarat) and the eastern crew. Fly fishing paradise in the cooler months.",
    fishSpecies: ["Brown trout"],
    tags: ["lake", "fly fishing", "trout", "stocked", "goldfields"],
  },
  {
    id: "lauriston-reservoir",
    name: "Lauriston Reservoir",
    description:
      "Quiet reservoir near Kyneton regularly stocked with brown trout (10,000 in 2017). Good shore fishing in a peaceful setting. Surrounded by state forest with informal camping options. Very close to Doug.",
    lat: -37.255,
    lng: 144.381,
    nearestTown: "Kyneton",
    region: "Goldfields",
    campsites: ["State forest dispersed sites"],
    campsiteCostPerNight: 0,
    activities: ["camping", "fishing"],
    roadType: "sealed",
    bestSeasons: ["autumn", "winter", "spring"],
    tripLength: ["overnighter"],
    crewNotes: "Basically in Doug's backyard. Good for a low-key overnight when not everyone can make a longer trip.",
    fishSpecies: ["Brown trout"],
    tags: ["free camping", "lake", "trout", "stocked", "quiet", "close to Doug"],
  },
  {
    id: "cairn-curran-reservoir",
    name: "Cairn Curran Reservoir",
    description:
      "Large reservoir near Newstead stocked with Murray cod (40,000 in 2017). Good boat and shore fishing. Camping available at nearby recreation reserves. A Goldfields option that's equidistant between Bendigo and Ballarat.",
    lat: -37.07,
    lng: 144.02,
    nearestTown: "Newstead",
    region: "Goldfields",
    campsites: ["Cairn Curran Recreation Reserve"],
    campsiteCostPerNight: 0,
    activities: ["camping", "fishing"],
    roadType: "sealed",
    bestSeasons: ["summer", "autumn", "spring"],
    tripLength: ["overnighter"],
    crewNotes: null,
    fishSpecies: ["Murray cod", "Golden perch", "Redfin"],
    tags: ["free camping", "lake", "Murray cod", "stocked"],
  },
  {
    id: "butts-reserve-maldon",
    name: "Butts Reserve / Maldon",
    description:
      "Free camping at the foot of Mount Tarrengower near the charming gold rush town of Maldon. Rocky granite outcrops, picnic tables, wood-fired BBQs, toilets, and water. 2WD accessible. Good base for exploring the Goldfields.",
    lat: -36.988,
    lng: 144.046,
    nearestTown: "Maldon",
    region: "Goldfields",
    campsites: ["Butts Reserve"],
    campsiteCostPerNight: 0,
    activities: ["camping", "hiking"],
    roadType: "sealed",
    bestSeasons: ["spring", "autumn"],
    tripLength: ["overnighter"],
    crewNotes: "Close to both Hesko (Bendigo) and Doug (Kyneton). Good gold history to explore in Maldon.",
    fishSpecies: [],
    tags: ["free camping", "gold history", "2WD", "facilities", "granite"],
  },

  // ============================================================
  // OTWAYS / GREAT OCEAN ROAD
  // ============================================================
  {
    id: "aire-river-west",
    name: "Aire River West / Otways Coast",
    description:
      "Free coastal campground where the Otway forest meets the coast. River views and easy beach access. Cast a line for bream, salmon, trout, and mulloway. On the Great Ocean Walk. Peaceful and atmospheric.",
    lat: -38.765,
    lng: 143.508,
    nearestTown: "Apollo Bay",
    region: "Otways",
    campsites: ["Aire River West Campground"],
    campsiteCostPerNight: 0,
    activities: ["camping", "fishing", "hiking"],
    roadType: "sealed",
    bestSeasons: ["summer", "autumn", "spring"],
    tripLength: ["overnighter", "long-weekend"],
    crewNotes: null,
    fishSpecies: ["Bream", "Australian salmon", "Trout", "Mulloway"],
    tags: ["free camping", "coastal", "river", "Great Ocean Walk", "fishing"],
  },
  {
    id: "lerderderg-gorge",
    name: "Lerderderg Gorge / State Park",
    description:
      "Deep gorge carved through sandstone just northwest of Bacchus Marsh. The campground is basic and wombat-adjacent. Good day walks along the gorge. Close to Melbourne — a solid overnighter when you don't want a big drive.",
    lat: -37.475,
    lng: 144.345,
    nearestTown: "Bacchus Marsh",
    region: "Central West",
    campsites: ["Lerderderg Campground"],
    campsiteCostPerNight: 0,
    activities: ["camping", "hiking"],
    roadType: "unsealed",
    bestSeasons: ["spring", "autumn"],
    tripLength: ["overnighter"],
    crewNotes: "Shortest drive from Hampton Park/Berwick/Cranbourne. Under 2 hours for everyone except maybe Hesko.",
    fishSpecies: [],
    tags: ["free camping", "gorge", "close to Melbourne", "bushwalks", "wombats"],
  },

  // ============================================================
  // MURRAY / NORTH-EAST
  // ============================================================
  {
    id: "goulburn-river-eildon-molesworth",
    name: "Goulburn River / Eildon to Molesworth",
    description:
      "Trophy trout water. The Goulburn below Eildon is one of Victoria's best brown trout streams, stocked annually. Crown frontage camping along the river. Fly fishing heaven in the right conditions. Also stocked with rainbow trout.",
    lat: -37.244,
    lng: 145.896,
    nearestTown: "Eildon",
    region: "High Country",
    campsites: ["Crown water frontage dispersed sites"],
    campsiteCostPerNight: 0,
    activities: ["camping", "fishing"],
    roadType: "sealed",
    bestSeasons: ["autumn", "winter", "spring"],
    tripLength: ["overnighter", "long-weekend"],
    crewNotes: null,
    fishSpecies: ["Brown trout", "Rainbow trout"],
    tags: ["free camping", "river", "trout", "fly fishing", "trophy water", "stocked"],
  },
  {
    id: "waranga-basin",
    name: "Waranga Basin / Rushworth Area",
    description:
      "Large irrigation basin stocked with golden perch (55,000 in 2021). Good shore and boat fishing. Rushworth State Forest nearby has free camping with box-ironbark bushland. A solid native fish option in the Goulburn-Murray area.",
    lat: -36.55,
    lng: 145.101,
    nearestTown: "Rushworth",
    region: "Goldfields",
    campsites: ["Rushworth State Forest sites", "Waranga Basin recreation area"],
    campsiteCostPerNight: 0,
    activities: ["camping", "fishing", "hiking"],
    roadType: "sealed",
    bestSeasons: ["summer", "autumn"],
    tripLength: ["overnighter"],
    crewNotes: null,
    fishSpecies: ["Golden perch", "Murray cod", "Redfin"],
    tags: ["free camping", "lake", "golden perch", "stocked", "state forest"],
  },
  {
    id: "ovens-river-wangaratta",
    name: "Ovens River / Wangaratta Area",
    description:
      "Crown water frontage camping along the Ovens River near Wangaratta. The Ovens is stocked with Macquarie perch (threatened native species — catch and release only) plus brown trout. Flat, accessible river camping.",
    lat: -36.532,
    lng: 146.668,
    nearestTown: "Wangaratta",
    region: "High Country",
    campsites: ["Crown water frontage dispersed sites"],
    campsiteCostPerNight: 0,
    activities: ["camping", "fishing"],
    roadType: "sealed",
    bestSeasons: ["summer", "autumn"],
    tripLength: ["overnighter"],
    crewNotes: null,
    fishSpecies: ["Brown trout", "Macquarie perch (catch & release)"],
    tags: ["free camping", "river", "trout", "native fish", "stocked"],
  },

  // ============================================================
  // CLOSER OPTIONS (shorter drives)
  // ============================================================
  {
    id: "mount-franklin",
    name: "Mount Franklin / Volcanic Crater",
    description:
      "Camp inside an extinct volcano. Mount Franklin is a unique free campground completely covered in pine trees, surrounded by cleared farmland near Daylesford. Basic facilities, good for a quick overnight. Close to mineral springs.",
    lat: -37.275,
    lng: 144.085,
    nearestTown: "Daylesford",
    region: "Goldfields",
    campsites: ["Mount Franklin Campground"],
    campsiteCostPerNight: 0,
    activities: ["camping", "hiking"],
    roadType: "sealed",
    bestSeasons: ["spring", "autumn", "summer"],
    tripLength: ["overnighter"],
    crewNotes: null,
    fishSpecies: [],
    tags: ["free camping", "volcano", "unique", "close to Melbourne", "pine forest"],
  },
  {
    id: "lake-purrumbete",
    name: "Lake Purrumbete",
    description:
      "Deep volcanic crater lake near Camperdown. Famous for trophy-sized Chinook salmon and brown trout. Holiday park right on the lake. Clear deep water — excellent for kayak fishing. One of Victoria's most unique fishing lakes.",
    lat: -38.292,
    lng: 143.22,
    nearestTown: "Camperdown",
    region: "Western District",
    campsites: ["Lake Purrumbete Holiday Park"],
    campsiteCostPerNight: 25,
    activities: ["camping", "fishing"],
    roadType: "sealed",
    bestSeasons: ["autumn", "winter", "spring"],
    tripLength: ["overnighter", "long-weekend"],
    crewNotes: null,
    fishSpecies: ["Chinook salmon", "Brown trout"],
    tags: ["volcanic lake", "trophy fish", "salmon", "deep water", "kayak fishing"],
  },
  {
    id: "buchan-river-caves",
    name: "Buchan River / Buchan Caves",
    description:
      "River camping behind the famous Buchan Caves in East Gippsland. The Buchan River holds bass and large brown trout. Free camping nearby, and the caves themselves are spectacular. The local milkbar owner is a mad fisherman and will point you to the best spots.",
    lat: -37.502,
    lng: 148.174,
    nearestTown: "Buchan",
    region: "Gippsland",
    campsites: ["Buchan Caves Reserve Campground", "Nearby free sites"],
    campsiteCostPerNight: 20,
    activities: ["camping", "fishing", "hiking"],
    roadType: "sealed",
    bestSeasons: ["summer", "autumn"],
    tripLength: ["long-weekend"],
    crewNotes: null,
    fishSpecies: ["Australian bass", "Brown trout"],
    tags: ["caves", "river", "bass", "trout", "East Gippsland"],
  },
  {
    id: "dargo-river",
    name: "Dargo River",
    description:
      "Remote river camping in the Dargo area, access point for the Wonnangatta 4WD loop. The Dargo River holds brown trout and blackfish. The Dargo Pub does great meals. Excellent base for exploring the High Country's eastern reaches.",
    lat: -37.338,
    lng: 147.297,
    nearestTown: "Dargo",
    region: "High Country",
    campsites: ["Dargo River crown frontage sites", "Grant Historic Area"],
    campsiteCostPerNight: 0,
    activities: ["camping", "fishing", "hiking", "4wd"],
    roadType: "unsealed",
    bestSeasons: ["summer", "autumn"],
    tripLength: ["long-weekend"],
    crewNotes: null,
    fishSpecies: ["Brown trout", "Blackfish"],
    tags: ["free camping", "river", "trout", "4wd access", "remote", "pub"],
  },
  {
    id: "poplars-west-gippsland",
    name: "The Poplars / West Gippsland",
    description:
      "Tucked away in West Gippsland, The Poplars campground sits among towering European poplar trees and Manna Gums. Trout-filled streams nearby. Free camping with basic facilities — toilets, picnic tables, and a rustic shelter.",
    lat: -37.95,
    lng: 146.15,
    nearestTown: "Noojee",
    region: "Gippsland",
    campsites: ["The Poplars Campground"],
    campsiteCostPerNight: 0,
    activities: ["camping", "fishing", "hiking"],
    roadType: "unsealed",
    bestSeasons: ["summer", "autumn"],
    tripLength: ["overnighter"],
    crewNotes: "Not far from Hampton Park/Berwick — could be a quick midweek overnighter.",
    fishSpecies: ["Brown trout"],
    tags: ["free camping", "river", "trout", "close to Melbourne", "quiet"],
  },
];

// ============================================================
// UTILITY: Get all unique regions
// ============================================================
export const getRegions = (): string[] => {
  return [...new Set(destinations.map((d) => d.region))].sort();
};

// ============================================================
// UTILITY: Get all unique activities
// ============================================================
export const getActivities = (): Activity[] => {
  return [...new Set(destinations.flatMap((d) => d.activities))].sort() as Activity[];
};

// ============================================================
// UTILITY: Filter by 4WD accessibility
// ============================================================
export const filterByVehicleAccess = (
  dests: Destination[],
  has4WD: boolean
): Destination[] => {
  if (has4WD) return dests;
  return dests.filter((d) => d.roadType !== "4wd-only");
};

// ============================================================
// UTILITY: Filter by trip length
// ============================================================
export const filterByTripLength = (
  dests: Destination[],
  length: TripLength
): Destination[] => {
  return dests.filter((d) => d.tripLength.includes(length));
};

// ============================================================
// UTILITY: Get current season
// ============================================================
export const getCurrentSeason = (): Season => {
  const month = new Date().getMonth();
  if (month >= 11 || month <= 1) return "summer";
  if (month >= 2 && month <= 4) return "autumn";
  if (month >= 5 && month <= 7) return "winter";
  return "spring";
};
