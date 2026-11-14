/**
 * INVENTED sample data for building the screens before the database exists (PLAN P1-03 replaces
 * it with seeded rows). Layout follows design_handoff_sadak_smriti/; the content is our own:
 * every person and crash here is invented, with real place names and real highway numbers.
 * Never use names from the spike (PLAN rule 9). Pages show a "sample data" notice.
 *
 * Highway numbers follow the official numbering in our OSM data (Prithvi = NH17), not the
 * handoff's placeholders (which used NH04 for Prithvi).
 */
import type { VehicleType } from "@/lib/home/types";

export type L = { en: string; ne: string };

export const SAMPLE_TODAY = "2026-11-13"; // 27 Kartik 2083
export const RECORDING_SINCE = "2026-04-14"; // 1 Baisakh 2083

// ---------------------------------------------------------------------------
// Crashes
// ---------------------------------------------------------------------------

export interface SampleCrash {
  slug: string;
  date: string;
  time: string | null;
  title: L;
  place: L;
  district: L;
  highwayRef: string | null;
  km: number | null;
  vehicles: VehicleType[];
  killed: number;
  injured: number;
  onBoard: number | null;
  sources: number;
  lon: number;
  lat: number;
  precise: boolean;
}

export const CRASHES: SampleCrash[] = [
  {
    slug: "2083-07-26-malekhu-dhading-bus", date: "2026-11-12", time: "05:45",
    title: { en: "Bus fell off the road at Malekhu", ne: "मलेखुमा बस सडकबाट खस्यो" },
    place: { en: "Malekhu, Benighat Rorang", ne: "मलेखु, बेनीघाट रोराङ" }, district: { en: "Dhading", ne: "धादिङ" },
    highwayRef: "NH17", km: 51, vehicles: ["bus"], killed: 9, injured: 21, onBoard: 34, sources: 14,
    lon: 84.83, lat: 27.818, precise: true,
  },
  {
    slug: "2083-07-25-mugling-chitwan-bus-truck", date: "2026-11-11", time: "14:10",
    title: { en: "Bus and truck collided at Mugling", ne: "मुग्लिनमा बस र ट्रक ठोक्किए" },
    place: { en: "Mugling, Ichchhakamana", ne: "मुग्लिन, इच्छाकामना" }, district: { en: "Chitwan", ne: "चितवन" },
    highwayRef: "NH17", km: 112, vehicles: ["bus", "truck"], killed: 3, injured: 22, onBoard: 41, sources: 6,
    lon: 84.556, lat: 27.856, precise: true,
  },
  {
    slug: "2083-07-24-sindhuli-gadhi-jeep", date: "2026-11-10", time: null,
    title: { en: "Jeep fell off the road at Sindhuli Gadhi", ne: "सिन्धुलीगढीमा जिप सडकबाट खस्यो" },
    place: { en: "Sindhuli Gadhi", ne: "सिन्धुलीगढी" }, district: { en: "Sindhuli", ne: "सिन्धुली" },
    highwayRef: "NH13", km: 41, vehicles: ["jeep"], killed: 5, injured: 2, onBoard: 9, sources: 4,
    lon: 85.977, lat: 27.278, precise: true,
  },
  {
    slug: "2083-07-24-lahan-siraha-motorcycle", date: "2026-11-10", time: "19:30",
    title: { en: "Motorcycle and tipper collided at Lahan", ne: "लहानमा मोटरसाइकल र टिपर ठोक्किए" },
    place: { en: "Lahan", ne: "लहान" }, district: { en: "Siraha", ne: "सिराहा" },
    highwayRef: "NH01", km: 402, vehicles: ["motorcycle", "tipper"], killed: 2, injured: 0, onBoard: 2, sources: 3,
    lon: 86.483, lat: 26.725, precise: true,
  },
  {
    slug: "2083-07-23-manma-kalikot-jeep", date: "2026-11-09", time: null,
    title: { en: "Jeep fell into the Karnali near Manma", ne: "मान्म नजिक जिप कर्णालीमा खस्यो" },
    place: { en: "Manma, Kalikot", ne: "मान्म, कालीकोट" }, district: { en: "Kalikot", ne: "कालीकोट" },
    highwayRef: "NH61", km: 88, vehicles: ["jeep"], killed: 6, injured: 4, onBoard: 11, sources: 5,
    lon: 81.736, lat: 29.142, precise: false,
  },
  {
    slug: "2083-07-22-tansen-palpa-bus", date: "2026-11-08", time: "07:20",
    title: { en: "Bus left the road above Tansen", ne: "तानसेन माथि बस सडकबाहिर गयो" },
    place: { en: "Tansen", ne: "तानसेन" }, district: { en: "Palpa", ne: "पाल्पा" },
    highwayRef: "NH47", km: 36, vehicles: ["bus"], killed: 3, injured: 17, onBoard: 38, sources: 7,
    lon: 83.547, lat: 27.866, precise: true,
  },
  {
    slug: "2083-07-22-galchhi-dhading-car", date: "2026-11-08", time: "22:05",
    title: { en: "Car hit a parked truck at Galchhi", ne: "गल्छीमा कारले रोकिएको ट्रकलाई ठक्कर दियो" },
    place: { en: "Galchhi", ne: "गल्छी" }, district: { en: "Dhading", ne: "धादिङ" },
    highwayRef: "NH17", km: 41, vehicles: ["car", "truck"], killed: 2, injured: 1, onBoard: 3, sources: 3,
    lon: 84.95, lat: 27.79, precise: true,
  },
  {
    slug: "2083-07-21-kohalpur-banke-motorcycle", date: "2026-11-07", time: null,
    title: { en: "Motorcycle hit by a bus at Kohalpur", ne: "कोहलपुरमा बसले मोटरसाइकललाई ठक्कर दियो" },
    place: { en: "Kohalpur", ne: "कोहलपुर" }, district: { en: "Banke", ne: "बाँके" },
    highwayRef: "NH01", km: 612, vehicles: ["motorcycle", "bus"], killed: 2, injured: 1, onBoard: 2, sources: 2,
    lon: 81.663, lat: 28.198, precise: true,
  },
];

export const LATEST = CRASHES[0];

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

export const HOME_STATS = {
  killed: 1184,
  crashes: 846,
  injured: 2903,
  last7Killed: 31,
  last7Crashes: 19,
  worst: { ref: "NH17", name: { en: "Prithvi", ne: "पृथ्वी" }, rate: 0.41 },
  police: { fiscalYear: "2081/82", killed: 2371 },
};

export interface SamplePerson {
  slug: string;
  name: L;
  age: number;
  home: L;
  quote: L | null;
  diedOn: string;
  candles: number;
}

export const REMEMBERED: SamplePerson[] = [
  {
    slug: "hari-prasad-adhikari", name: { en: "Hari Prasad Adhikari", ne: "हरिप्रसाद अधिकारी" }, age: 58, home: { en: "Syangja", ne: "स्याङ्जा" },
    quote: { en: "He drove the same Pokhara bus for thirty years and knew every passenger’s village.", ne: "उहाँले तीस वर्षसम्म पोखराको एउटै बस चलाउनुभयो, हरेक यात्रुको गाउँ चिन्नुहुन्थ्यो।" },
    diedOn: "2024-11-12", candles: 412,
  },
  {
    slug: "sabitri-thapa-magar", name: { en: "Sabitri Thapa Magar", ne: "सावित्री थापा मगर" }, age: 34, home: { en: "Palpa", ne: "पाल्पा" },
    quote: { en: "A schoolteacher who opened the library in Tansen every Saturday.", ne: "हरेक शनिबार तानसेनमा पुस्तकालय खोल्ने शिक्षिका।" },
    diedOn: "2025-11-13", candles: 268,
  },
  {
    slug: "nima-dorje-lama", name: { en: "Nima Dorje Lama", ne: "निमा दोर्जे लामा" }, age: 41, home: { en: "Rasuwa", ne: "रसुवा" },
    quote: { en: "Carried supplies to the high villages for twenty seasons, and came home every winter.", ne: "बीस सिजनसम्म माथिल्ला गाउँमा सामान पुर्‍याउनुभयो, र हरेक जाडोमा घर फर्कनुहुन्थ्यो।" },
    diedOn: "2023-11-13", candles: 530,
  },
];

export interface TimelineItem { slug: string; place: L; road: L; vehicles: VehicleType[]; killed: number }

export const NEWS = [
  { outlet: "Kathmandu Post", lang: "EN", title: { en: "Nine killed as bus falls off Prithvi Highway at Malekhu", ne: "Nine killed as bus falls off Prithvi Highway at Malekhu" }, date: "2026-11-12", kind: "followUp", crash: CRASHES[0] },
  { outlet: "Onlinekhabar", lang: "NE", title: { en: "मलेखुमा बस दुर्घटना: मृतकको संख्या ९ पुग्यो", ne: "मलेखुमा बस दुर्घटना: मृतकको संख्या ९ पुग्यो" }, date: "2026-11-12", kind: "report", crash: CRASHES[0] },
  { outlet: "Setopati", lang: "NE", title: { en: "मुग्लिनमा बस र ट्रक ठोक्किए, तीन जनाको मृत्यु", ne: "मुग्लिनमा बस र ट्रक ठोक्किए, तीन जनाको मृत्यु" }, date: "2026-11-11", kind: "report", crash: CRASHES[1] },
  { outlet: "Khabarhub", lang: "EN", title: { en: "Jeep plunges into Karnali in Kalikot; six dead", ne: "Jeep plunges into Karnali in Kalikot; six dead" }, date: "2026-11-09", kind: "report", crash: CRASHES[4] },
] as const;

export const POLICE_DISTRICTS = [
  { district: { en: "Dhading", ne: "धादिङ" }, police: 87, here: 38 },
  { district: { en: "Chitwan", ne: "चितवन" }, police: 143, here: 72 },
  { district: { en: "Kathmandu", ne: "काठमाडौं" }, police: 168, here: 101 },
  { district: { en: "Makwanpur", ne: "मकवानपुर" }, police: 112, here: 61 },
  { district: { en: "Rupandehi", ne: "रुपन्देही" }, police: 131, here: 54 },
  { district: { en: "Banke", ne: "बाँके" }, police: 96, here: 37 },
];

export const POLICE_REPORTS = [
  { type: "PDF", title: { en: "Yearly accident statistics by district, FY 2081/82", ne: "जिल्लागत वार्षिक दुर्घटना तथ्यांक, आ.व. २०८१/८२" }, source: { en: "Nepal Police Headquarters", ne: "नेपाल प्रहरी प्रधान कार्यालय" }, date: { en: "Shrawan 2082", ne: "साउन २०८२" } },
  { type: "PDF", title: { en: "Kathmandu Valley traffic accidents, Asoj 2083", ne: "काठमाडौं उपत्यका ट्राफिक दुर्घटना, असोज २०८३" }, source: { en: "Metropolitan Traffic Police Division", ne: "महानगरीय ट्राफिक प्रहरी महाशाखा" }, date: { en: "Kartik 2083", ne: "कात्तिक २०८३" } },
  { type: "NOTE", title: { en: "Preliminary assessment, Malekhu bus crash", ne: "प्रारम्भिक मूल्याङ्कन, मलेखु बस दुर्घटना" }, source: { en: "District Police Office, Dhading", ne: "जिल्ला प्रहरी कार्यालय, धादिङ" }, date: { en: "26 Kartik 2083", ne: "कात्तिक २६, २०८३" } },
  { type: "CSV", title: { en: "Imported police totals used on district pages", ne: "जिल्ला पृष्ठमा प्रयोग भएका प्रहरी तथ्यांक" }, source: { en: "Sadak Smriti data team", ne: "सडक स्मृति तथ्यांक टोली" }, date: { en: "Updated Asoj 2083", ne: "असोज २०८३ मा अद्यावधिक" } },
];

/**
 * Risk step 0-3 per highway (killed per km) for colouring map lines. Sample values until the
 * statistics exist (PLAN P4-01); highways not listed are step 0.
 */
export const HIGHWAY_RISK: Record<string, 0 | 1 | 2 | 3> = {
  NH17: 3, NH61: 3, NH47: 3, NH44: 3, NH13: 2, NH01: 2, NH41: 1, NH03: 1, NH34: 1, NH58: 1,
};

// ---------------------------------------------------------------------------
// Crash page (the latest crash)
// ---------------------------------------------------------------------------

export const CRASH_DETAIL = {
  crash: LATEST,
  breadcrumb: { en: ["Crashes", "Bagmati", "Dhading", "Benighat Rorang"], ne: ["दुर्घटनाहरू", "बागमती", "धादिङ", "बेनीघाट रोराङ"] },
  timeDisputed: "05:45 / 06:10",
  crashType: "fell_off_road" as const,
  injuredSerious: 8,
  injuredMinor: 13,
  verification: { outlets: 6, reviewer: true },
  updated: "2026-11-13T09:10",
  killedPeople: [
    { slug: "sample-person-1", name: { en: "Anita Shrestha", ne: "अनिता श्रेष्ठ" }, age: 22, home: { en: "Pokhara, Kaski", ne: "पोखरा, कास्की" } },
    { slug: "sample-person-2", name: { en: "Ram Kumar Paudel", ne: "रामकुमार पौडेल" }, age: 47, home: { en: "Damauli, Tanahun", ne: "दमौली, तनहुँ" } },
    { slug: "sample-person-3", name: { en: "Sushila Gurung", ne: "सुशीला गुरुङ" }, age: 31, home: { en: "Lekhnath, Kaski", ne: "लेखनाथ, कास्की" } },
    { slug: "sample-person-4", name: { en: "Bimal Tamang", ne: "बिमल तामाङ" }, age: 26, home: { en: "Kathmandu", ne: "काठमाडौं" } },
    { slug: "sample-person-5", name: { en: "Kamala Sapkota", ne: "कमला सापकोटा" }, age: 63, home: { en: "Gorkha", ne: "गोरखा" } },
    { slug: "sample-person-6", name: { en: "Dipendra Rana", ne: "दीपेन्द्र राना" }, age: 19, home: { en: "Syangja", ne: "स्याङ्जा" } },
    { slug: "sample-person-7", name: { en: "Laxmi Bhandari", ne: "लक्ष्मी भण्डारी" }, age: 38, home: { en: "Dhading Besi", ne: "धादिङबेसी" } },
    { slug: null, name: null, age: null, home: null, withheld: false },
    { slug: null, name: null, age: null, home: null, withheld: true },
  ],
  notYetNamed: 1,
  injuredPeople: [
    { name: { en: "Suman K.C.", ne: "सुमन केसी" }, meta: { en: "33 · serious", ne: "३३ · गम्भीर" } },
    { name: { en: "Gita Karki", ne: "गीता कार्की" }, meta: { en: "41 · serious", ne: "४१ · गम्भीर" } },
    { name: null, meta: { en: "under 18", ne: "१८ वर्षमुनि" } },
    { name: { en: "Prakash Thapa", ne: "प्रकाश थापा" }, meta: { en: "29 · serious", ne: "२९ · गम्भीर" } },
    { name: { en: "Rita Lama", ne: "रीता लामा" }, meta: { en: "36 · minor", ne: "३६ · सामान्य" } },
    { name: { en: "Bhim Bahadur Ale", ne: "भीम बहादुर आले" }, meta: { en: "52 · minor (driver)", ne: "५२ · सामान्य (चालक)" } },
  ],
  tolls: [
    { value: 6, source: "Kathmandu Post 09:10", final: false },
    { value: 8, source: "Kathmandu Post 13:25", final: false },
    { value: 9, source: "Onlinekhabar 16:50", final: true },
  ],
  sources: [
    { outlet: "Kathmandu Post", title: "Nine killed as bus falls off Prithvi Highway at Malekhu", date: "2026-11-12", kind: "followUp" },
    { outlet: "Onlinekhabar", title: "मलेखुमा बस दुर्घटना: मृतकको संख्या ९ पुग्यो", date: "2026-11-12", kind: "report" },
    { outlet: "Setopati", title: "धादिङमा बस दुर्घटना, ६ जनाको मृत्यु", date: "2026-11-12", kind: "report" },
    { outlet: "Ratopati", title: "मलेखु बस दुर्घटनाका मृतकको सनाखत", date: "2026-11-12", kind: "followUp" },
    { outlet: "Khabarhub", title: "Malekhu bus crash: those killed identified", date: "2026-11-13", kind: "followUp" },
    { outlet: "Nepalnews", title: "Road crashes this week: a roundup", date: "2026-11-13", kind: "roundup" },
  ],
  placeLines: { en: ["Malekhu bazaar, ward 1", "Benighat Rorang Rural Municipality", "Dhading · Bagmati Province", "Prithvi Highway (NH17), km 51"], ne: ["मलेखु बजार, वडा १", "बेनीघाट रोराङ गाउँपालिका", "धादिङ · बागमती प्रदेश", "पृथ्वी राजमार्ग (NH17), किमी ५१"] },
  vehicleLines: { en: ["Bus · public", "Gandaki Province 01-001 Kha 1234", "Kathmandu → Pokhara"], ne: ["बस · सार्वजनिक", "गण्डकी प्रदेश ०१-००१ ख १२३४", "काठमाडौं → पोखरा"] },
  cause: {
    text: { en: "Lost control on a bend while overtaking.", ne: "ओभरटेक गर्दा मोडमा नियन्त्रण गुम्यो।" },
    by: { en: "Police preliminary assessment, reported by Kathmandu Post. Not a finding of fault.", ne: "प्रहरीको प्रारम्भिक मूल्याङ्कन, काठमाडौं पोस्टले रिपोर्ट गरेअनुसार। दोषको निर्णय होइन।" },
  },
  placeAccuracy: { en: "Within 2 km of Malekhu", ne: "मलेखुबाट २ किमीभित्र" },
};

// ---------------------------------------------------------------------------
// Person page
// ---------------------------------------------------------------------------

export const PERSON_DETAIL = {
  slug: "sabitri-thapa-magar",
  name: { en: "Sabitri Thapa Magar", ne: "सावित्री थापा मगर" },
  alias: { en: "Sabitri Miss", ne: "सावित्री मिस" },
  age: 34,
  home: { en: "Tansen, Palpa", ne: "तानसेन, पाल्पा" },
  diedOn: "2025-11-13",
  confirmedOn: "2025-12-04",
  candles: 268,
  crash: { slug: "2082-07-27-tansen-palpa-bus", title: { en: "Bus left the road above Tansen", ne: "तानसेन माथि बस सडकबाहिर गयो" }, road: "NH47 km 36", district: { en: "Palpa", ne: "पाल्पा" }, killed: 4, injured: 19 },
  storyBy: { en: "Her story · written by her husband, Rajan", ne: "उनको कथा · श्रीमान् राजनले लेखेको" },
  story: {
    en: [
      "Sabitri taught Nepali and social studies at a secondary school in Tansen for eleven years. Her students called her Sabitri Miss, even after they left school and came back with children of their own.",
      "On Saturdays she opened the school library for anyone who wanted to read. She sang while she cooked, grew chillies and marigolds on the roof, and never missed Tihar at her mother’s home.",
      "She was on her way back from a teachers’ training in Butwal. She leaves her husband, a son of twelve and a daughter of eight.",
    ],
    ne: [
      "सावित्रीले तानसेनको एक माध्यमिक विद्यालयमा एघार वर्ष नेपाली र सामाजिक अध्ययन पढाउनुभयो। विद्यार्थीहरूले उहाँलाई सावित्री मिस भन्थे, विद्यालय छाडेर आफ्नै छोराछोरी लिएर फर्किँदा पनि।",
      "शनिबार उहाँ पढ्न चाहने जो कोहीका लागि विद्यालयको पुस्तकालय खोल्नुहुन्थ्यो। खाना पकाउँदा गीत गाउनुहुन्थ्यो, छतमा खुर्सानी र सयपत्री रोप्नुहुन्थ्यो, र माइतीघरमा तिहार कहिल्यै छुटाउनुभएन।",
      "उहाँ बुटवलको शिक्षक तालिमबाट फर्किँदै हुनुहुन्थ्यो। उहाँका श्रीमान्, बाह्र वर्षको छोरा र आठ वर्षकी छोरी हुनुहुन्छ।",
    ],
  },
  photos: [
    { en: "With her class, Baisakh 2081", ne: "आफ्नो कक्षासँग, बैशाख २०८१" },
    { en: "Tihar at her mother’s home", ne: "माइतीघरमा तिहार" },
    { en: "Rooftop garden", ne: "छतको बगैंचा" },
    { en: "Wedding, 2068", ne: "विवाह, २०६८" },
    { en: "With her children", ne: "छोराछोरीसँग" },
    { en: "", ne: "" },
  ],
  photoCount: 14,
  tributes: [
    { body: { en: "She taught me to read Nepali properly when I was eleven. I became a teacher because of her.", ne: "एघार वर्षको हुँदा उहाँले मलाई राम्रोसँग नेपाली पढ्न सिकाउनुभयो। उहाँकै कारण म शिक्षक भएँ।" }, who: { en: "Former student · 2 Mangsir 2082", ne: "पूर्व विद्यार्थी · मंसिर २, २०८२" } },
    { body: { en: "Every Saturday the library door was open because she opened it. We have kept it open.", ne: "हरेक शनिबार पुस्तकालयको ढोका खुला हुन्थ्यो किनभने उहाँ खोल्नुहुन्थ्यो। हामीले खुलै राखेका छौं।" }, who: { en: "Colleague · 5 Mangsir 2082", ne: "सहकर्मी · मंसिर ५, २०८२" } },
    { body: { en: "Didi, we miss your songs in the kitchen.", ne: "दिदी, भान्सामा तपाईंको गीत सम्झिरहन्छौं।" }, who: { en: "Her sister, Kalpana · 27 Kartik 2083", ne: "बहिनी कल्पना · कात्तिक २७, २०८३" } },
  ],
  facts: [
    { k: { en: "Work", ne: "काम" }, v: { en: "Teacher, secondary school in Tansen", ne: "शिक्षिका, तानसेनको माध्यमिक विद्यालय" } },
    { k: { en: "Taught", ne: "पढाउने विषय" }, v: { en: "Nepali and social studies", ne: "नेपाली र सामाजिक अध्ययन" } },
    { k: { en: "Loved", ne: "मन पर्ने" }, v: { en: "Folk songs, her rooftop garden", ne: "लोकगीत, छतको बगैंचा" } },
    { k: { en: "Family", ne: "परिवार" }, v: { en: "Husband Rajan, a son and a daughter", ne: "श्रीमान् राजन, एक छोरा र एक छोरी" } },
  ],
  spellings: [
    { n: "Sabitri Thapa Magar, 34", o: "Kathmandu Post" },
    { n: "Savitri Thapa, 35", o: "Setopati" },
    { n: "सावित्री थापा मगर, ३४", o: "Onlinekhabar" },
    { n: "Sabitri Magar, 34", o: "Khabarhub" },
  ],
};

// ---------------------------------------------------------------------------
// Highway page (NH17)
// ---------------------------------------------------------------------------

function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const kmRand = seeded(9);
const HOT = new Set([40, 41, 50, 51, 61, 62, 97, 98, 99, 112, 113, 114, 115, 141, 142]);

export const HIGHWAY_DETAIL = {
  ref: "NH17",
  name: { en: "Prithvi Highway", ne: "पृथ्वी राजमार्ग" },
  from: { en: "Naubise, Dhading to Pokhara, Kaski", ne: "नौबिसे, धादिङदेखि पोखरा, कास्कीसम्म" },
  lengthKm: 174,
  /** Map crop around the highway (Naubise 85.1 E → Pokhara 84.0 E). */
  view: { lon: 84.55, lat: 27.95, spanLon: 1.7 },
  /** The "year" of the month chart: BS 2083 so far (Baisakh–Kartik). */
  monthsYear: 2083,
  stats: { crashes: 58, killed: 71, injured: 194, blackspotKm: 10 },
  /** Killed per 1 km segment, rolling 3 years: km 0..173. */
  segments: Array.from({ length: 174 }, (_, i) => {
    let v = kmRand() * 0.35;
    if (HOT.has(i)) v = 0.6 + kmRand() * 0.4;
    if (i === 113) v = 1;
    return Math.round(v * 6); // people killed: whole numbers
  }),
  landmarks: [
    { km: 0, name: { en: "Naubise", ne: "नौबिसे" } },
    { km: 41, name: { en: "Galchhi", ne: "गल्छी" } },
    { km: 62, name: { en: "Benighat", ne: "बेनीघाट" } },
    { km: 98, name: { en: "Majhimtar", ne: "माझीमटार" } },
    { km: 112, name: { en: "Mugling", ne: "मुग्लिन" } },
    { km: 142, name: { en: "Dumre", ne: "डुम्रे" } },
    { km: 174, name: { en: "Pokhara", ne: "पोखरा" } },
  ],
  blackspots: [
    { place: { en: "Mugling bazaar", ne: "मुग्लिन बजार" }, km: "112–113", crashes: 4, killed: 6 },
    { place: { en: "Abukhaireni bend", ne: "आबुखैरेनी मोड" }, km: "114–115", crashes: 3, killed: 5 },
    { place: { en: "Malekhu", ne: "मलेखु" }, km: "50–51", crashes: 3, killed: 5 },
    { place: { en: "Galchhi", ne: "गल्छी" }, km: "40–41", crashes: 4, killed: 4 },
    { place: { en: "Benighat", ne: "बेनीघाट" }, km: "61–62", crashes: 3, killed: 4 },
    { place: { en: "Majhimtar", ne: "माझीमटार" }, km: "98–99", crashes: 3, killed: 3 },
    { place: { en: "Dumre", ne: "डुम्रे" }, km: "141–142", crashes: 3, killed: 3 },
    { place: { en: "Kurintar", ne: "कुरिन्टार" }, km: "97–98", crashes: 3, killed: 2 },
    { place: { en: "Simaltal", ne: "सिमलताल" }, km: "115–116", crashes: 3, killed: 2 },
    { place: { en: "Damauli turn", ne: "दमौली मोड" }, km: "142–143", crashes: 3, killed: 2 },
  ],
  byVehicle: [["bus", 24], ["truck", 17], ["motorcycle", 13], ["car", 11], ["microbus", 6]] as [VehicleType, number][],
  byTime: [["0–3", 6], ["3–6", 9], ["6–9", 11], ["9–12", 7], ["12–15", 8], ["15–18", 12], ["18–21", 14], ["21–24", 10]] as [string, number][],
  byMonth: [[1, 8], [2, 11], [3, 9], [4, 14], [5, 12], [6, 10], [7, 7]] as [number, number][],
};

// ---------------------------------------------------------------------------
// Research dashboard
// ---------------------------------------------------------------------------

// Keep the per-km chart consistent with the top-10 table: each blackspot km carries its table
// value, and no other km reaches the lowest top-10 value.
{
  const top = new Map(HIGHWAY_DETAIL.blackspots.map((b) => [Number(b.km.split("–")[0]), b.killed]));
  const floor = Math.min(...top.values()) - 1;
  HIGHWAY_DETAIL.segments.forEach((v, km) => {
    HIGHWAY_DETAIL.segments[km] = top.get(km) ?? Math.min(v, floor);
  });
}

/** Full map: weekly killed counts, Baisakh 1 to Kartik 27 2083 (31 weeks). Invented. */
export const WEEKLY_KILLED = [
  22, 27, 31, 25, 29, 34, 38, 33, 30, 36, 41, 35, 32, 39, 44, 37, 34, 40, 43, 38, 33, 36, 42, 39, 35, 37, 41, 36, 34, 38, 31,
];

export const DASHBOARD = {
  kpis: { killed: 1184, crashes: 846, fatalCrashes: 312, injured: 2903, serious: 1077, hazard: 38, coverage: 61 },
  months: { killed: [142, 156, 171, 188, 176, 203, 148], crashes: [98, 112, 119, 131, 124, 151, 111], policeAvg: 198 },
  provinces: [["bagmati", 312], ["madhesh", 241], ["lumbini", 228], ["koshi", 162], ["gandaki", 101], ["sudurpashchim", 79], ["karnali", 61]] as [string, number][],
  vehicles: [["motorcycle", 402], ["bus", 231], ["truck", 168], ["jeep", 141], ["car", 102], ["tipper", 64]] as [VehicleType, number][],
  crashTypes: [["fell_off_road", 356], ["hit_pedestrian", 248], ["head_on", 211], ["side_impact", 142], ["rollover", 97], ["natural_hazard", 38]] as [string, number][],
  roadUsers: [["rider", 341], ["passenger", 322], ["pedestrian", 248], ["pillion", 129], ["driver", 112], ["cyclist", 32]] as [string, number][],
  ages: [["0–9", 8, 7], ["10–19", 30, 18], ["20–29", 100, 34], ["30–39", 82, 28], ["40–49", 60, 22], ["50–59", 44, 18], ["60–69", 28, 14], ["70+", 14, 9]] as [string, number, number][],
  coverage: [["bagmati", 72], ["madhesh", 54], ["lumbini", 63], ["koshi", 58], ["karnali", 41]] as [string, number][],
  downloads: [["crashes.csv", "412 KB"], ["crashes.geojson", "1.1 MB"], ["people.csv", "96 KB"], ["sources.csv", "238 KB"], ["highway_segments.geojson", "3.4 MB"]] as [string, string][],
};

// ---------------------------------------------------------------------------
// Remembrance: past crashes and the people killed in them (all invented).
// The three people in REMEMBERED belong to these crashes; each crash happened on 27 Kartik,
// so on SAMPLE_TODAY (27 Kartik 2083) they are 1, 2 and 3 years ago.
// ---------------------------------------------------------------------------

export const MEMORIAL_CRASHES: SampleCrash[] = [
  {
    slug: "2082-07-27-tansen-palpa-bus", date: "2025-11-13", time: "16:20",
    title: { en: "Bus left the road above Tansen", ne: "तानसेन माथि बस सडकबाहिर गयो" },
    place: { en: "Above Tansen", ne: "तानसेन माथि" }, district: { en: "Palpa", ne: "पाल्पा" },
    highwayRef: "NH47", km: 36, vehicles: ["bus"], killed: 4, injured: 19, onBoard: 38, sources: 7,
    lon: 83.548, lat: 27.874, precise: true,
  },
  {
    slug: "2081-07-27-waling-syangja-bus-tipper", date: "2024-11-12", time: "06:30",
    title: { en: "Bus and tipper collided at Waling", ne: "वालिङमा बस र टिपर ठोक्किए" },
    place: { en: "Waling, Syangja", ne: "वालिङ, स्याङ्जा" }, district: { en: "Syangja", ne: "स्याङ्जा" },
    highwayRef: null, km: null, vehicles: ["bus", "tipper"], killed: 3, injured: 11, onBoard: 29, sources: 5,
    lon: 83.765, lat: 28.017, precise: true,
  },
  {
    slug: "2080-07-27-syafrubesi-rasuwa-jeep", date: "2023-11-13", time: null,
    title: { en: "Jeep fell off the road near Syafrubesi", ne: "स्याफ्रुबेसी नजिक जिप सडकबाट खस्यो" },
    place: { en: "Near Syafrubesi", ne: "स्याफ्रुबेसी नजिक" }, district: { en: "Rasuwa", ne: "रसुवा" },
    highwayRef: null, km: null, vehicles: ["jeep"], killed: 2, injured: 3, onBoard: 9, sources: 3,
    lon: 85.372, lat: 28.162, precise: false,
  },
];

export interface SampleVictim {
  slug: string;
  name: L;
  age: number | null;
  home: L | null;
  crashSlug: string;
  /** A line the family chose, shown on cards. */
  quote: L | null;
  candles: number;
  confirmedByFamily: boolean;
}

/** Everyone named in a sample crash, with a memorial page. Hidden and not-yet-named people are never listed. */
export const VICTIMS: SampleVictim[] = [
  // The latest crash (Malekhu): the named people from CRASH_DETAIL.
  ...CRASH_DETAIL.killedPeople.flatMap((p, i) =>
    p.slug && p.name && p.home
      ? [{ slug: p.slug, name: p.name, age: p.age, home: p.home, crashSlug: LATEST.slug, quote: null, candles: [41, 33, 27, 25, 19, 16, 12][i] ?? 10, confirmedByFamily: false }]
      : [],
  ),
  // Tansen, 27 Kartik 2082
  {
    slug: "sabitri-thapa-magar", name: { en: "Sabitri Thapa Magar", ne: "सावित्री थापा मगर" }, age: 34, home: { en: "Tansen, Palpa", ne: "तानसेन, पाल्पा" },
    crashSlug: "2082-07-27-tansen-palpa-bus", quote: REMEMBERED[1].quote, candles: 268, confirmedByFamily: true,
  },
  {
    slug: "gopal-bahadur-rana", name: { en: "Gopal Bahadur Rana", ne: "गोपाल बहादुर राना" }, age: 52, home: { en: "Rampur, Palpa", ne: "रामपुर, पाल्पा" },
    crashSlug: "2082-07-27-tansen-palpa-bus", quote: { en: "Ran the tea shop by the bus park for twenty years.", ne: "बसपार्क छेउको चिया पसल बीस वर्ष चलाउनुभयो।" }, candles: 97, confirmedByFamily: true,
  },
  {
    slug: "mina-kumari-pun", name: { en: "Mina Kumari Pun", ne: "मीना कुमारी पुन" }, age: 27, home: { en: "Gulmi", ne: "गुल्मी" },
    crashSlug: "2082-07-27-tansen-palpa-bus", quote: null, candles: 64, confirmedByFamily: false,
  },
  // Waling, 27 Kartik 2081
  {
    slug: "hari-prasad-adhikari", name: { en: "Hari Prasad Adhikari", ne: "हरिप्रसाद अधिकारी" }, age: 58, home: { en: "Syangja", ne: "स्याङ्जा" },
    crashSlug: "2081-07-27-waling-syangja-bus-tipper", quote: REMEMBERED[0].quote, candles: 412, confirmedByFamily: true,
  },
  {
    slug: "bishnu-maya-gurung", name: { en: "Bishnu Maya Gurung", ne: "विष्णुमाया गुरुङ" }, age: 45, home: { en: "Putalibazar, Syangja", ne: "पुतलीबजार, स्याङ्जा" },
    crashSlug: "2081-07-27-waling-syangja-bus-tipper", quote: { en: "Sold vegetables at the Waling market every morning.", ne: "हरेक बिहान वालिङ बजारमा तरकारी बेच्नुहुन्थ्यो।" }, candles: 158, confirmedByFamily: true,
  },
  // Near Syafrubesi, 27 Kartik 2080
  {
    slug: "nima-dorje-lama", name: { en: "Nima Dorje Lama", ne: "निमा दोर्जे लामा" }, age: 41, home: { en: "Rasuwa", ne: "रसुवा" },
    crashSlug: "2080-07-27-syafrubesi-rasuwa-jeep", quote: REMEMBERED[2].quote, candles: 530, confirmedByFamily: true,
  },
  {
    slug: "pasang-tamang", name: { en: "Pasang Tamang", ne: "पासाङ तामाङ" }, age: 33, home: { en: "Dhunche, Rasuwa", ne: "धुन्चे, रसुवा" },
    crashSlug: "2080-07-27-syafrubesi-rasuwa-jeep", quote: null, candles: 211, confirmedByFamily: false,
  },
];

/** Every sample crash that has a page (recent ones and remembered ones). */
export const ALL_CRASHES: SampleCrash[] = [...CRASHES, ...MEMORIAL_CRASHES];

// ---------------------------------------------------------------------------
// Research dashboard: the extra charts (invented). Every breakdown of deaths sums to
// DASHBOARD.kpis.killed (1,184) and every breakdown of crashes to DASHBOARD.kpis.crashes (846).
// ---------------------------------------------------------------------------

export const DASHBOARD_MORE = {
  /** Killed by 3-hour group (SPEC 9.2). */
  byTime: [["0–3", 54], ["3–6", 97], ["6–9", 142], ["9–12", 151], ["12–15", 168], ["15–18", 205], ["18–21", 219], ["21–24", 148]] as [string, number][],
  /** Killed by day of week, Sunday first (Nepal's working week starts on Sunday). */
  byWeekday: [176, 158, 151, 149, 163, 179, 208],
  /** Crashes by the cause a source stated, as reported (not proven). */
  causes: [["speeding", 188], ["lost_control", 161], ["overtaking", 97], ["road_condition", 74], ["mechanical", 58], ["driver_asleep", 36], ["drink_driving", 29], ["not_stated", 203]] as [string, number][],
  /** Fatal crashes by how many people they killed. */
  crashSizes: [["1", 214], ["2", 54], ["3–5", 32], ["6–10", 9], ["11+", 3]] as [string, number][],
  /** Highways with the most deaths per 100 km (this year). Only NH17 has a page so far. */
  highways: [["NH17", 174, 71], ["NH61", 118, 33], ["NH47", 132, 31], ["NH44", 96, 21], ["NH13", 160, 29], ["NH01", 1027, 164], ["NH41", 88, 11], ["NH03", 119, 13]] as [string, number, number][],
};

/** Province keys in DASHBOARD.provinces, by province number. */
const PROVINCE_KEYS = ["koshi", "madhesh", "bagmati", "gandaki", "lumbini", "karnali", "sudurpashchim"];

/** Killed by district: each province's total shared among its districts with fixed invented weights. */
export function dashboardDistricts(districts: { slug: string; province: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  const totals = new Map(DASHBOARD.provinces);
  for (let p = 1; p <= 7; p++) {
    const ds = districts.filter((d) => d.province === p).sort((a, b) => a.slug.localeCompare(b.slug));
    const weight = (slug: string) => 1 + ([...slug].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 997, 7) % 9);
    const sum = ds.reduce((s, d) => s + weight(d.slug), 0);
    const total = totals.get(PROVINCE_KEYS[p - 1]) ?? 0;
    let given = 0;
    ds.forEach((d, i) => {
      const v = i === ds.length - 1 ? total - given : Math.round((total * weight(d.slug)) / sum);
      out[d.slug] = v;
      given += v;
    });
  }
  return out;
}
