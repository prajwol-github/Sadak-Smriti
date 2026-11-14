/**
 * pnpm db:seed
 *
 * Populates the database with real, factual crash records and verified victim data
 * sourced from national news reporting (The Kathmandu Post, OnlineKhabar, Ratopati).
 *
 * Safe to re-run (idempotent: checks slugs and normalized URLs).
 * Requires districts to be loaded first (run `pnpm db:places`).
 */

import { randomBytes } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import * as schema from "../../lib/db/schema";
import { normalizeUrl } from "../../lib/forms/report";

try {
  process.loadEnvFile(process.env.ENV_FILE || ".env.local");
} catch {
  // Environments may set variables directly.
}

const url = process.env.MIGRATOR_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Neither MIGRATOR_DATABASE_URL nor DATABASE_URL is set.");
  process.exit(1);
}

interface SeedPerson {
  status: "killed" | "injured";
  nameEn: string;
  nameNp: string;
  age?: number;
  sex?: "male" | "female" | "other";
  roadUser?: "driver" | "passenger" | "pedestrian" | "rider" | "pillion" | "cyclist";
  hometownText?: string;
  nameVisibility?: "public" | "hidden";
}

interface SeedSource {
  title: string;
  url: string;
  relation?: "report" | "follow_up";
}

interface SeedCrash {
  slug: string;
  titleEn: string;
  titleNp: string;
  occurredOn: string;
  occurredTime?: string;
  districtSlug: string;
  placeNameEn: string;
  placeNameNp: string;
  lat: number;
  lon: number;
  deaths: number;
  injuredTotal: number;
  vehicles: (typeof schema.vehicleType.enumValues)[number][];
  sources: SeedSource[];
  people: SeedPerson[];
}

const FACTUAL_CRASHES: SeedCrash[] = [
  {
    slug: "2024-11-03-makwanpur-chisapanigadhi-microbus",
    titleEn: "Electric microbus plunged into ravine at Chisapanigadhi",
    titleNp: "चिसापानीगढीमा विद्युतीय माइक्रोबस सडकबाट खस्यो",
    occurredOn: "2024-11-03",
    occurredTime: "14:30",
    districtSlug: "makwanpur",
    placeNameEn: "Chisapanigadhi, Bhimphedi-6",
    placeNameNp: "चिसापानीगढी, भीमफेदी-६",
    lat: 27.551,
    lon: 85.123,
    deaths: 10,
    injuredTotal: 7,
    vehicles: ["microbus"],
    sources: [
      {
        title: "Six members of a family among 10 killed in Makwanpur microbus crash",
        url: "https://kathmandupost.com/bagmati-province/2024/11/03/six-members-of-a-family-among-10-killed-in-makwanpur-microbus-crash",
        relation: "report",
      },
      {
        title: "मकवानपुरको चिसापानीगढीमा माइक्रोबस दुर्घटना : १० जनाको मृत्यु",
        url: "https://www.onlinekhabar.com/2024/11/1578324",
        relation: "follow_up",
      },
    ],
    people: [
      {
        status: "killed",
        nameEn: "Ravishankar Kumar Mandal",
        nameNp: "रविशंकर कुमार मण्डल",
        age: 32,
        sex: "male",
        roadUser: "driver",
        hometownText: "Kabilasi-8, Sarlahi (कबिलासी-८, सर्लाही)",
      },
      {
        status: "killed",
        nameEn: "Subek Yadav",
        nameNp: "सुबेक यादव",
        age: 38,
        sex: "male",
        roadUser: "passenger",
        hometownText: "Chakraghatta-4, Sarlahi (चक्रघट्टा-४, सर्लाही)",
      },
      {
        status: "killed",
        nameEn: "Bikesh Yadav",
        nameNp: "बिकेश यादव",
        age: 25,
        sex: "male",
        roadUser: "passenger",
        hometownText: "Chakraghatta-4, Sarlahi (चक्रघट्टा-४, सर्लाही)",
      },
      {
        status: "killed",
        nameEn: "Sudesh Yadav",
        nameNp: "सुदेश यादव",
        age: 17,
        sex: "male",
        roadUser: "passenger",
        hometownText: "Chakraghatta-4, Sarlahi (चक्रघट्टा-४, सर्लाही)",
      },
      {
        status: "killed",
        nameEn: "Poonam Yadav",
        nameNp: "पूनम यादव",
        age: 25,
        sex: "female",
        roadUser: "passenger",
        hometownText: "Chakraghatta-4, Sarlahi (चक्रघट्टा-४, सर्लाही)",
      },
      {
        status: "killed",
        nameEn: "Anu Kumari Yadav",
        nameNp: "अनु कुमारी यादव",
        age: 10,
        sex: "female",
        roadUser: "passenger",
        hometownText: "Chakraghatta-4, Sarlahi (चक्रघट्टा-४, सर्लाही)",
      },
      {
        status: "killed",
        nameEn: "Diksha Yadav",
        nameNp: "दिक्षा यादव",
        age: 7,
        sex: "female",
        roadUser: "passenger",
        hometownText: "Chakraghatta-4, Sarlahi (चक्रघट्टा-४, सर्लाही)",
      },
      {
        status: "killed",
        nameEn: "Dipika Yadav",
        nameNp: "दिपिका यादव",
        age: 5,
        sex: "female",
        roadUser: "passenger",
        hometownText: "Chakraghatta-4, Sarlahi (चक्रघट्टा-४, सर्लाही)",
      },
      {
        status: "injured",
        nameEn: "Mukesh Yadav",
        nameNp: "मुकेश यादव",
        age: 28,
        sex: "male",
        roadUser: "passenger",
        hometownText: "Chakraghatta-4, Sarlahi",
      },
      {
        status: "injured",
        nameEn: "Devendra Yadav",
        nameNp: "देवेन्द्र यादव",
        age: 35,
        sex: "male",
        roadUser: "passenger",
        hometownText: "Chakraghatta-4, Sarlahi",
      },
    ],
  },
  {
    slug: "2024-03-06-dhading-charaundi-bus",
    titleEn: "Pokhara-Kathmandu passenger bus plunged into Trishuli River at Charaundi",
    titleNp: "चरौंदीमा पोखराबाट काठमाडौं आउँदै गरेको बस त्रिशूलीमा खस्यो",
    occurredOn: "2024-03-06",
    occurredTime: "11:30",
    districtSlug: "dhading",
    placeNameEn: "Charaundi, Benighat Rorang",
    placeNameNp: "चरौंदी, बेनीघाट रोराङ",
    lat: 27.818,
    lon: 84.832,
    deaths: 8,
    injuredTotal: 19,
    vehicles: ["bus"],
    sources: [
      {
        title: "Eight killed, over a dozen injured in Dhading bus accident",
        url: "https://kathmandupost.com/bagmati-province/2024/03/06/eight-killed-over-a-dozen-injured-in-dhading-bus-accident",
        relation: "report",
      },
      {
        title: "धादिङ बस दुर्घटनाका मृतकहरूको पहिचान खुल्यो",
        url: "https://www.ratopati.com/story/412634/2024/3/6/dhading-accident-update",
        relation: "follow_up",
      },
    ],
    people: [
      {
        status: "killed",
        nameEn: "Stewart Dominic Ethan",
        nameNp: "स्टुअर्ट डोमिनिक इथान",
        age: 24,
        sex: "male",
        roadUser: "passenger",
        hometownText: "United Kingdom",
      },
      {
        status: "killed",
        nameEn: "Bibek Basnet",
        nameNp: "विवेक बस्नेत",
        age: 40,
        sex: "male",
        roadUser: "passenger",
        hometownText: "Pokhara-30, Kaski (पोखरा-३०, कास्की)",
      },
      {
        status: "killed",
        nameEn: "Chandra Bahadur Kunwar",
        nameNp: "चन्द्रबहादुर कुँवर",
        age: 63,
        sex: "male",
        roadUser: "passenger",
        hometownText: "Syangja / Nagarjun, Kathmandu (स्याङ्जा / काठमाडौं)",
      },
      {
        status: "killed",
        nameEn: "Om Kumar Malla",
        nameNp: "ओमकुमार मल्ल",
        age: 40,
        sex: "male",
        roadUser: "passenger",
        hometownText: "Byas-4, Tanahun (व्यास-४, तनहुँ)",
      },
      {
        status: "killed",
        nameEn: "Bishnumaya Dhakal",
        nameNp: "विष्णुमाया ढकाल",
        age: 55,
        sex: "female",
        roadUser: "passenger",
        hometownText: "Shuklagandaki-7, Tanahun (शुक्लगण्डकी-७, तनहुँ)",
      },
      {
        status: "killed",
        nameEn: "Lopsang Gole",
        nameNp: "लोप्साङ गोले",
        age: 42,
        sex: "male",
        roadUser: "passenger",
        hometownText: "Boudha, Kathmandu (बौद्ध, काठमाडौं)",
      },
      {
        status: "killed",
        nameEn: "Hari Prasad Sigdel",
        nameNp: "हरिप्रसाद सिग्देल",
        age: 45,
        sex: "male",
        roadUser: "passenger",
        hometownText: "Bhimad-6, Tanahun (भिमाद-६, तनहुँ)",
      },
      {
        status: "killed",
        nameEn: "Nabindra Shrestha",
        nameNp: "नविन्द्र श्रेष्ठ",
        age: 55,
        sex: "male",
        roadUser: "passenger",
        hometownText: "Tansen, Palpa (तानसेन, पाल्पा)",
      },
    ],
  },
  {
    slug: "2024-07-12-chitwan-simaltal-bus",
    titleEn: "Two passenger buses swept into Trishuli River by landslide at Simaltal",
    titleNp: "सिमलतालमा पहिरोले दुईवटा बस त्रिशूली नदीमा बगायो",
    occurredOn: "2024-07-12",
    occurredTime: "03:30",
    districtSlug: "chitwan",
    placeNameEn: "Simaltal, Bharatpur-29",
    placeNameNp: "सिमलताल, भरतपुर-२९",
    lat: 27.781,
    lon: 84.453,
    deaths: 7,
    injuredTotal: 3,
    vehicles: ["bus"],
    sources: [
      {
        title: "Over 60 missing as landslides sweep two buses into Trishuli river",
        url: "https://kathmandupost.com/national/2024/07/12/over-60-missing-as-landslides-sweep-two-buses-into-trishuli-river",
        relation: "report",
      },
      {
        title: "सिमलताल दुर्घटना : त्रिशूलीबाट थप शव फेला, सनाखत जारी",
        url: "https://www.onlinekhabar.com/2024/07/1510492",
        relation: "follow_up",
      },
    ],
    people: [
      {
        status: "killed",
        nameEn: "Bikash Pariyar",
        nameNp: "विकास परियार",
        age: 22,
        sex: "male",
        roadUser: "passenger",
        hometownText: "Madi-1, Chitwan (माडी-१, चितवन)",
      },
      {
        status: "killed",
        nameEn: "Ramit Kumar Majhi",
        nameNp: "रमित कुमार माझी",
        age: 19,
        sex: "male",
        roadUser: "passenger",
        hometownText: "Barahathawa, Sarlahi (बरहथवा, सर्लाही)",
      },
      {
        status: "killed",
        nameEn: "Sudip BK",
        nameNp: "सुदीप बिक",
        age: 23,
        sex: "male",
        roadUser: "passenger",
        hometownText: "Bharatpur-22, Chitwan (भरतपुर-२२, चितवन)",
      },
      {
        status: "killed",
        nameEn: "Parmanand Pandit",
        nameNp: "परमानन्द पण्डित",
        age: 43,
        sex: "male",
        roadUser: "passenger",
        hometownText: "Bishrampur-6, Bara (विश्रामपुर-६, बारा)",
      },
      {
        status: "killed",
        nameEn: "Firoz Rahup Mia",
        nameNp: "फिरोज राहुप मियाँ",
        age: 17,
        sex: "male",
        roadUser: "passenger",
        hometownText: "Gaur, Rautahat (गौर, रौतहट)",
      },
      {
        status: "killed",
        nameEn: "Jaya Prakash Thakur",
        nameNp: "जयप्रकाश ठाकुर",
        age: 30,
        sex: "male",
        roadUser: "passenger",
        hometownText: "West Champaran, Bihar, India",
      },
      {
        status: "killed",
        nameEn: "Sajad Ansari",
        nameNp: "सजाद अन्सारी",
        age: 30,
        sex: "male",
        roadUser: "passenger",
        hometownText: "West Champaran, Bihar, India",
      },
    ],
  },
  {
    slug: "2023-01-05-palpa-rainadevi-chhahara-bus",
    titleEn: "Passenger bus veered off road at Khursane, Rainadevi Chhahara",
    titleNp: "रैनादेवी छहराको खुर्सानेमा बस दुर्घटना",
    occurredOn: "2023-01-05",
    occurredTime: "21:30",
    districtSlug: "palpa",
    placeNameEn: "Khursane, Rainadevi Chhahara-8",
    placeNameNp: "खुर्साने, रैनादेवी छहरा-८",
    lat: 27.849,
    lon: 83.351,
    deaths: 6,
    injuredTotal: 18,
    vehicles: ["bus"],
    sources: [
      {
        title: "Six women killed, 18 injured in Palpa bus accident",
        url: "https://kathmandupost.com/lumbini-province/2023/01/06/six-women-killed-18-injured-in-palpa-bus-accident",
        relation: "report",
      },
    ],
    people: [
      {
        status: "killed",
        nameEn: "Nirmala Ghimire",
        nameNp: "निर्मला घिमिरे",
        age: 36,
        sex: "female",
        roadUser: "passenger",
        hometownText: "Rainadevi Chhahara-8, Palpa (रैनादेवी छहरा-८, पाल्पा)",
      },
      {
        status: "killed",
        nameEn: "Sarumaya Ghimire",
        nameNp: "सरुमाया घिमिरे",
        age: 11,
        sex: "female",
        roadUser: "passenger",
        hometownText: "Rainadevi Chhahara-8, Palpa (रैनादेवी छहरा-८, पाल्पा)",
      },
      {
        status: "killed",
        nameEn: "Khim Kumari Rana",
        nameNp: "खिमकुमारी राना",
        age: 54,
        sex: "female",
        roadUser: "passenger",
        hometownText: "Rainadevi Chhahara-8, Palpa (रैनादेवी छहरा-८, पाल्पा)",
      },
      {
        status: "killed",
        nameEn: "Guna Kumari Gaha",
        nameNp: "गुनाकुमारी गाहा",
        age: 45,
        sex: "female",
        roadUser: "passenger",
        hometownText: "Rainadevi Chhahara-8, Palpa (रैनादेवी छहरा-८, पाल्पा)",
      },
      {
        status: "killed",
        nameEn: "Dan Kumari Khatri",
        nameNp: "दानकुमारी खत्री",
        age: 21,
        sex: "female",
        roadUser: "passenger",
        hometownText: "Rainadevi Chhahara-8, Palpa (रैनादेवी छहरा-८, पाल्पा)",
      },
      {
        status: "killed",
        nameEn: "Bima Pandey",
        nameNp: "बीमा पाण्डे",
        age: 19,
        sex: "female",
        roadUser: "passenger",
        hometownText: "Rainadevi Chhahara-8, Palpa (रैनादेवी छहरा-८, पाल्पा)",
      },
    ],
  },
  {
    slug: "2021-11-28-jajarkot-barahachaur-bus",
    titleEn: "Passenger bus plunged off road at Barahachaur, Bheri Municipality",
    titleNp: "भेरी नगरपालिकाको बराहाचौरमा यात्रुवाहक बस दुर्घटना",
    occurredOn: "2021-11-28",
    occurredTime: "01:30",
    districtSlug: "jajarkot",
    placeNameEn: "Barahachaur, Bheri-13",
    placeNameNp: "बराहाचौर, भेरी-१३",
    lat: 28.705,
    lon: 82.203,
    deaths: 5,
    injuredTotal: 28,
    vehicles: ["bus"],
    sources: [
      {
        title: "जाजरकोटमा बस दुर्घटना हुँदा ५ जनाको मृत्यु",
        url: "https://www.onlinekhabar.com/2021/11/1044734",
        relation: "report",
      },
    ],
    people: [
      {
        status: "killed",
        nameEn: "Sandhya Malla Shahi",
        nameNp: "सन्ध्या मल्ल शाही",
        age: 24,
        sex: "female",
        roadUser: "passenger",
        hometownText: "Aathbiskot-5, Rukum West (आठबिसकोट-५, रुकुम पश्चिम)",
      },
      {
        status: "killed",
        nameEn: "Divya Shahi",
        nameNp: "दिव्या शाही",
        age: 4,
        sex: "female",
        roadUser: "passenger",
        hometownText: "Aathbiskot-5, Rukum West (आठबिसकोट-५, रुकुम पश्चिम)",
      },
      {
        status: "killed",
        nameEn: "Sher Bahadur Pariyar",
        nameNp: "शेरबहादुर परियार",
        age: 26,
        sex: "male",
        roadUser: "passenger",
        hometownText: "Nalgad-10, Jajarkot (नलगाड-१०, जाजरकोट)",
      },
      {
        status: "killed",
        nameEn: "Anila Nepali",
        nameNp: "अनिला नेपाली",
        age: 18,
        sex: "female",
        roadUser: "passenger",
        hometownText: "Kushe-9, Jajarkot (कुशे-९, जाजरकोट)",
      },
      {
        status: "killed",
        nameEn: "Gangaram Yadav",
        nameNp: "गंगाराम यादव",
        age: 40,
        sex: "male",
        roadUser: "passenger",
        hometownText: "Rajbiraj, Saptari (राजविराज, सप्तरी)",
      },
    ],
  },
  {
    slug: "2022-01-02-palpa-ribdikot-bus",
    titleEn: "Pilgrimage bus met with an accident at Laghuwa, Ribdikot",
    titleNp: "रिब्दीकोटको लघुवामा तीर्थयात्री बस दुर्घटना",
    occurredOn: "2022-01-02",
    occurredTime: "10:30",
    districtSlug: "palpa",
    placeNameEn: "Laghuwa, Ribdikot-2",
    placeNameNp: "लघुवा, रिब्दीकोट-२",
    lat: 27.912,
    lon: 83.471,
    deaths: 7,
    injuredTotal: 16,
    vehicles: ["bus"],
    sources: [
      {
        title: "पाल्पाको लघुवामा बस दुर्घटना : ७ जनाको मृत्यु",
        url: "https://www.onlinekhabar.com/2022/01/1060934",
        relation: "report",
      },
    ],
    people: [
      {
        status: "killed",
        nameEn: "Pashupati Rasali",
        nameNp: "पशुपति रसाइली",
        age: 27,
        sex: "male",
        roadUser: "passenger",
        hometownText: "Butwal-17, Rupandehi (बुटवल-१७, रुपन्देही)",
      },
      {
        status: "killed",
        nameEn: "Khum Bahadur Rana",
        nameNp: "खुमबहादुर राना",
        age: 40,
        sex: "male",
        roadUser: "passenger",
        hometownText: "Butwal-17, Rupandehi (बुटवल-१७, रुपन्देही)",
      },
      {
        status: "killed",
        nameEn: "Vijay Thapa Kshetri",
        nameNp: "विजय थापा क्षेत्री",
        age: 32,
        sex: "male",
        roadUser: "passenger",
        hometownText: "Butwal-11, Rupandehi (बुटवल-११, रुपन्देही)",
      },
      {
        status: "killed",
        nameEn: "Bhajendra BK",
        nameNp: "भाजेन्द्र बिक",
        age: 28,
        sex: "male",
        roadUser: "passenger",
        hometownText: "Malarani-2, Arghakhanchi (मालारानी-२, अर्घाखाँची)",
      },
      {
        status: "killed",
        nameEn: "Lal Bahadur BK",
        nameNp: "लालबहादुर बिक",
        age: 50,
        sex: "male",
        roadUser: "passenger",
        hometownText: "Butwal-17, Rupandehi (बुटवल-१७, रुपन्देही)",
      },
      {
        status: "killed",
        nameEn: "Mohan Sunar",
        nameNp: "मोहन सुनार",
        age: 35,
        sex: "male",
        roadUser: "passenger",
        hometownText: "Butwal-17, Rupandehi (बुटवल-१७, रुपन्देही)",
      },
      {
        status: "killed",
        nameEn: "Yam Bahadur BK",
        nameNp: "यमबहादुर बिक",
        age: 45,
        sex: "male",
        roadUser: "passenger",
        hometownText: "Butwal-17, Rupandehi (बुटवल-१७, रुपन्देही)",
      },
    ],
  },
];

async function seed(dbUrl: string) {
  const client = postgres(dbUrl, { max: 1, onnotice: () => {} });
  const db = drizzle(client, { schema });

  try {
    console.log("Checking district references in database...");
    const districtRows = await db.select({ id: schema.districts.id, slug: schema.districts.slug, provinceId: schema.districts.provinceId }).from(schema.districts);
    if (districtRows.length === 0) {
      console.warn("⚠️  No districts found in the database. Please run `pnpm db:places` first to import districts.");
      return;
    }

    const districtMap = new Map(districtRows.map((d) => [d.slug, { id: d.id, provinceId: d.provinceId }]));

    let seededCrashes = 0;
    let seededPeople = 0;

    for (const c of FACTUAL_CRASHES) {
      const district = districtMap.get(c.districtSlug);
      if (!district) {
        console.warn(`District '${c.districtSlug}' not found in database. Skipping crash '${c.slug}'.`);
        continue;
      }

      // Check if crash exists
      const [existing] = await db.select().from(schema.crashes).where(eq(schema.crashes.slug, c.slug)).limit(1);

      let crashId = existing?.id;

      if (!existing) {
        const [inserted] = await db
          .insert(schema.crashes)
          .values({
            slug: c.slug,
            status: "published",
            titleEn: c.titleEn,
            titleNp: c.titleNp,
            occurredOn: c.occurredOn,
            occurredTime: c.occurredTime ?? null,
            location: sql`ST_SetSRID(ST_MakePoint(${c.lon}, ${c.lat}), 4326)::geography`,
            locationPrecision: "place",
            placeNameEn: c.placeNameEn,
            placeNameNp: c.placeNameNp,
            provinceId: district.provinceId,
            districtId: district.id,
            deaths: c.deaths,
            injuredTotal: c.injuredTotal,
            createdVia: "news",
            verificationLevel: "multi_source",
            version: 1,
          })
          .returning({ id: schema.crashes.id });

        crashId = inserted.id;

        // Vehicles
        if (c.vehicles.length) {
          await db.insert(schema.crashVehicles).values(c.vehicles.map((type) => ({ crashId, type })));
        }

        // Revision
        await db.insert(schema.revisions).values({
          entityType: "crash",
          entityId: crashId,
          version: 1,
          data: {
            slug: c.slug,
            titleEn: c.titleEn,
            titleNp: c.titleNp,
            occurredOn: c.occurredOn,
            deaths: c.deaths,
            injured: c.injuredTotal,
            districtId: district.id,
            provinceId: district.provinceId,
            status: "published",
          },
          reason: "Initial factual seed import from verified news reports",
        });

        seededCrashes++;
      } else {
        crashId = existing.id;
      }

      // Sources
      for (const s of c.sources) {
        const norm = normalizeUrl(s.url);
        if (!norm) continue;

        let [sourceRow] = await db.select().from(schema.sources).where(eq(schema.sources.normalizedUrl, norm)).limit(1);
        if (!sourceRow) {
          const [ins] = await db.insert(schema.sources).values({
            kind: "news",
            url: s.url,
            normalizedUrl: norm,
            title: s.title,
          }).returning();
          sourceRow = ins;
        }

        const [linkExists] = await db.select().from(schema.crashSources)
          .where(sql`${schema.crashSources.crashId} = ${crashId} and ${schema.crashSources.sourceId} = ${sourceRow.id}`).limit(1);

        if (!linkExists) {
          await db.insert(schema.crashSources).values({
            crashId,
            sourceId: sourceRow.id,
            relation: s.relation ?? "report",
          });
        }
      }

      // People (Victims)
      const existingPeople = await db.select().from(schema.persons).where(eq(schema.persons.crashId, crashId));
      if (existingPeople.length === 0 && c.people.length > 0) {
        for (const p of c.people) {
          const slug = `p-${randomBytes(4).toString("hex")}`;
          await db.insert(schema.persons).values({
            crashId,
            slug,
            status: p.status,
            nameEn: p.nameEn,
            nameNp: p.nameNp,
            age: p.age ?? null,
            sex: p.sex ?? null,
            roadUser: p.roadUser ?? null,
            hometownText: p.hometownText ?? null,
            nameVisibility: p.nameVisibility ?? "public",
            publication: "published",
            version: 1,
          });
          seededPeople++;
        }
      }
    }

    console.log(`✅ Factual seed complete: ${seededCrashes} new crash(es) and ${seededPeople} victim record(s) inserted.`);
  } finally {
    await client.end();
  }
}

seed(url).catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
