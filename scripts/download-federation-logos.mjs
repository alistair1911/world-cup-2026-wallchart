import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const logoDir = path.join(root, "public", "federations");
const logoMapPath = path.join(root, "src", "lib", "team-logo-map.ts");
const userAgent = "WorldCup2026FamilyWallchart/1.0 (private family project)";
const requestDelayMs = Number(process.env.FEDERATION_LOGO_DELAY_MS ?? 900);

const federationPages = {
  mexico: "Mexican Football Federation",
  "south-africa": "South African Football Association",
  "korea-republic": "Korea Football Association",
  czechia: "Football Association of the Czech Republic",
  canada: "Canadian Soccer Association",
  switzerland: "Swiss Football Association",
  qatar: "Qatar Football Association",
  "bosnia-herzegovina": "Football Association of Bosnia and Herzegovina",
  brazil: "Brazilian Football Confederation",
  morocco: "Royal Moroccan Football Federation",
  haiti: "Haitian Football Federation",
  scotland: "Scottish Football Association",
  usa: "United States Soccer Federation",
  paraguay: "Paraguayan Football Association",
  australia: "Football Australia",
  turkiye: "Turkish Football Federation",
  germany: "German Football Association",
  curacao: "Curaçao Football Federation",
  "cote-divoire": "Ivorian Football Federation",
  ecuador: "Ecuadorian Football Federation",
  netherlands: "Royal Dutch Football Association",
  japan: "Japan Football Association",
  tunisia: "Tunisian Football Federation",
  sweden: "Swedish Football Association",
  belgium: "Royal Belgian Football Association",
  egypt: "Egyptian Football Association",
  "ir-iran": "Football Federation Islamic Republic of Iran",
  "new-zealand": "New Zealand Football",
  spain: "Royal Spanish Football Federation",
  "cabo-verde": "Cape Verdean Football Federation",
  "saudi-arabia": "Saudi Arabian Football Federation",
  uruguay: "Uruguayan Football Association",
  france: "French Football Federation",
  senegal: "Senegalese Football Federation",
  norway: "Norwegian Football Federation",
  iraq: "Iraq Football Association",
  argentina: "Argentine Football Association",
  algeria: "Algerian Football Federation",
  austria: "Austrian Football Association",
  jordan: "Jordan Football Association",
  portugal: "Portuguese Football Federation",
  uzbekistan: "Uzbekistan Football Association",
  colombia: "Colombian Football Federation",
  "congo-dr": "Congolese Association Football Federation",
  england: "The Football Association",
  croatia: "Croatian Football Federation",
  ghana: "Ghana Football Association",
  panama: "Panamanian Football Federation"
};

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { "user-agent": userAgent } });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function fetchPageImage(title) {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("prop", "pageimages");
  url.searchParams.set("piprop", "thumbnail");
  url.searchParams.set("pithumbsize", "600");
  url.searchParams.set("titles", title);

  const data = await fetchJson(url.toString());
  const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
  const page = pages[0];
  return page?.thumbnail?.source ?? null;
}

function extensionFor(contentType, url) {
  if (contentType?.includes("svg")) {
    return "svg";
  }
  if (contentType?.includes("png")) {
    return "png";
  }
  if (contentType?.includes("webp")) {
    return "webp";
  }
  if (contentType?.includes("jpeg") || contentType?.includes("jpg")) {
    return "jpg";
  }

  const cleanUrl = url.split("?")[0].toLowerCase();
  if (cleanUrl.endsWith(".svg")) {
    return "svg";
  }
  if (cleanUrl.endsWith(".png")) {
    return "png";
  }
  if (cleanUrl.endsWith(".webp")) {
    return "webp";
  }
  return "jpg";
}

function existingLogoUrl(id) {
  for (const ext of ["svg", "png", "webp", "jpg"]) {
    if (existsSync(path.join(logoDir, `${id}.${ext}`))) {
      return `/federations/${id}.${ext}`;
    }
  }
  return null;
}

async function downloadImage(url, id) {
  const response = await fetch(url, { headers: { "user-agent": userAgent } });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 1200) {
    throw new Error("image too small");
  }

  const ext = extensionFor(response.headers.get("content-type"), url);
  const fileName = `${id}.${ext}`;
  await writeFile(path.join(logoDir, fileName), buffer);
  return `/federations/${fileName}`;
}

async function findAndDownload(id, title) {
  const existing = existingLogoUrl(id);
  if (existing) {
    return existing;
  }

  let imageUrl = null;
  try {
    imageUrl = await fetchPageImage(title);
  } catch {
    const summary = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    imageUrl = summary?.thumbnail?.source || summary?.originalimage?.source || null;
  }

  if (!imageUrl) {
    return null;
  }

  return downloadImage(imageUrl, id);
}

function renderLogoMap(logoMap) {
  const lines = Object.entries(logoMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, url]) => `  ${JSON.stringify(id)}: ${JSON.stringify(url)}`);

  return `export const TEAM_LOGOS = {\n${lines.join(",\n")}\n} as const;\n\nexport type TeamLogoId = keyof typeof TEAM_LOGOS;\n\nexport function getTeamLogo(teamId: string) {\n  return TEAM_LOGOS[teamId as TeamLogoId];\n}\n`;
}

await mkdir(logoDir, { recursive: true });

const logoMap = {};
for (const [id, title] of Object.entries(federationPages)) {
  try {
    if (!existingLogoUrl(id)) {
      await wait(requestDelayMs);
    }
    const url = await findAndDownload(id, title);
    if (url) {
      logoMap[id] = url;
      console.log(`ok ${id} -> ${url}`);
    } else {
      console.log(`miss ${id}`);
    }
  } catch (error) {
    console.log(`miss ${id}: ${error.message}`);
  }
}

await writeFile(logoMapPath, renderLogoMap(logoMap));
console.log(`Saved ${Object.keys(logoMap).length}/${Object.keys(federationPages).length} federation logos.`);
