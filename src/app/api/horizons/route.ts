import { NextResponse } from "next/server";

export const runtime = "edge";

const HORIZONS_ENDPOINT = "https://ssd.jpl.nasa.gov/api/horizons.api";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const ALLOWED_KEYS = new Set([
  "COMMAND",
  "CENTER",
  "START_TIME",
  "STOP_TIME",
  "STEP_SIZE",
  "EPHEM_TYPE",
  "VEC_TABLE",
  "CSV_FORMAT",
  "OUT_UNITS",
  "REF_SYSTEM",
  "REF_PLANE",
  "REF_FRAME",
  "VEC_CORR",
  "VEC_LABELS",
  "CAL_FORMAT",
  "OBJ_DATA",
  "MAKE_EPHEM",
  "TLIST",
]);

const normalizeKey = (key: string) => key.trim().toUpperCase();

const buildHorizonsUrl = (requestUrl: string) => {
  const url = new URL(requestUrl);
  const horizons = new URL(HORIZONS_ENDPOINT);
  horizons.searchParams.set("format", "json");
  for (const [key, value] of url.searchParams.entries()) {
    if (!value) {
      continue;
    }
    const normalized = normalizeKey(key);
    if (normalized === "FORMAT" || !ALLOWED_KEYS.has(normalized)) {
      continue;
    }
    horizons.searchParams.set(normalized, value);
  }
  return horizons;
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: Request) {
  const horizonsUrl = buildHorizonsUrl(request.url);
  const response = await fetch(horizonsUrl.toString(), {
    headers: { "User-Agent": "Cosmic-Atlas" },
  });
  const body = await response.text();

  return new NextResponse(body, {
    status: response.status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": response.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  });
}
