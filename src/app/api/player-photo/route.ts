import { NextResponse, type NextRequest } from "next/server";

const API_SPORTS_PLAYER_IMAGE = /^https:\/\/media\.api-sports\.io\/football\/players\/\d+\.png$/;
const API_SPORTS_PLACEHOLDER_BYTES = "5192";

function avatarUrl(name: string) {
  const params = new URLSearchParams({
    name: name || "Player",
    background: "0f5132",
    color: "ffffff",
    bold: "true",
    size: "512"
  });
  return `https://ui-avatars.com/api/?${params.toString()}`;
}

function redirectTo(url: string) {
  const response = NextResponse.redirect(url, 307);
  response.headers.set("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
  return response;
}

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get("src") ?? "";
  const name = request.nextUrl.searchParams.get("name") ?? "Player";

  if (!API_SPORTS_PLAYER_IMAGE.test(source)) {
    return redirectTo(avatarUrl(name));
  }

  try {
    const response = await fetch(source, {
      method: "HEAD",
      next: { revalidate: 60 * 60 * 24 * 7 }
    });
    const length = response.headers.get("content-length");

    if (!response.ok || length === API_SPORTS_PLACEHOLDER_BYTES) {
      return redirectTo(avatarUrl(name));
    }
  } catch {
    return redirectTo(avatarUrl(name));
  }

  return redirectTo(source);
}
