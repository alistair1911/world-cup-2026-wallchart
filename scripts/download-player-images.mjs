import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const profileDataPath = path.join(root, "src", "lib", "profile-data.ts");
const playerDir = path.join(root, "public", "players");
const photoMapPath = path.join(root, "src", "lib", "player-photo-map.ts");
const userAgent = "WorldCup2026FamilyWallchart/1.0 (private family project)";
const requestDelayMs = Number(process.env.PLAYER_IMAGE_DELAY_MS ?? 1300);

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parsePlayers(source) {
  const start = source.indexOf("const featuredPlayers");
  const end = source.indexOf("const formationByGroup");
  const body = source.slice(start, end);
  const players = [];
  const blockPattern = /(?:^|\n)\s*"?([a-z0-9-]+)"?:\s*\[([\s\S]*?)\n\s*\]/g;
  let block;

  while ((block = blockPattern.exec(body))) {
    const teamId = block[1];
    const teamBody = block[2];
    const namePattern = /name:\s*"([^"]+)"/g;
    let match;
    while ((match = namePattern.exec(teamBody))) {
      const name = match[1];
      const id = `${teamId}-${slugify(name)}`;
      players.push({ id, name });
    }
  }

  return players;
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { "user-agent": userAgent } });
  if (response.status === 429) {
    await wait(requestDelayMs * 3);
    const retry = await fetch(url, { headers: { "user-agent": userAgent } });
    if (!retry.ok) {
      throw new Error(`${retry.status} ${retry.statusText}`);
    }

    return retry.json();
  }

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function searchWikipedia(name) {
  const query = encodeURIComponent(`${name} footballer`);
  const data = await fetchJson(`https://en.wikipedia.org/w/rest.php/v1/search/page?q=${query}&limit=4`);
  const pages = Array.isArray(data.pages) ? data.pages : [];
  return pages.find((page) => {
    const text = `${page.title ?? ""} ${page.description ?? ""} ${page.excerpt ?? ""}`.toLowerCase();
    return text.includes("football") || text.includes("soccer") || text.includes("player");
  }) ?? pages[0];
}

function extensionFor(contentType, url) {
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
  if (cleanUrl.endsWith(".png")) {
    return "png";
  }
  if (cleanUrl.endsWith(".webp")) {
    return "webp";
  }
  return "jpg";
}

async function downloadImage(url, id, attempt = 0) {
  const response = await fetch(url, { headers: { "user-agent": userAgent } });
  if (response.status === 429 && attempt < 2) {
    await wait(requestDelayMs * 3);
    return downloadImage(url, id, attempt + 1);
  }

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 4000) {
    throw new Error("image too small");
  }

  const ext = extensionFor(response.headers.get("content-type"), url);
  const fileName = `${id}.${ext}`;
  await writeFile(path.join(playerDir, fileName), buffer);
  return `/players/${fileName}`;
}

async function findAndDownload(player) {
  const existing = existingPhotoUrl(player.id);
  if (existing) {
    return existing;
  }

  const page = await searchWikipedia(player.name);
  if (!page?.title) {
    return null;
  }

  const summary = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.title)}`);
  const imageUrl = summary?.thumbnail?.source || summary?.originalimage?.source;
  if (!imageUrl) {
    return null;
  }

  return downloadImage(imageUrl, player.id);
}

function existingPhotoUrl(id) {
  const jpg = path.join(playerDir, `${id}.jpg`);
  const png = path.join(playerDir, `${id}.png`);
  const webp = path.join(playerDir, `${id}.webp`);
  if (existsSync(jpg)) {
    return `/players/${id}.jpg`;
  }
  if (existsSync(png)) {
    return `/players/${id}.png`;
  }
  if (existsSync(webp)) {
    return `/players/${id}.webp`;
  }
  return null;
}

function renderPhotoMap(photoMap) {
  const lines = Object.entries(photoMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, url]) => `  ${JSON.stringify(id)}: ${JSON.stringify(url)}`);

  return `export const PLAYER_PHOTOS = {\n${lines.join(",\n")}\n} as const;\n\nexport type PlayerPhotoId = keyof typeof PLAYER_PHOTOS;\n`;
}

await mkdir(playerDir, { recursive: true });

const source = await readFile(profileDataPath, "utf8");
const players = parsePlayers(source);
const photoMap = {};

for (const player of players) {
  try {
    if (!existingPhotoUrl(player.id)) {
      await wait(requestDelayMs);
    }
    const url = await findAndDownload(player);
    if (url) {
      photoMap[player.id] = url;
      console.log(`ok ${player.name} -> ${url}`);
    } else {
      console.log(`miss ${player.name}`);
    }
  } catch (error) {
    console.log(`miss ${player.name}: ${error.message}`);
  }
}

await writeFile(photoMapPath, renderPhotoMap(photoMap));
console.log(`Saved ${Object.keys(photoMap).length}/${players.length} player photos.`);
