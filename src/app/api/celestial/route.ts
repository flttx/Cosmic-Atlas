import { NextResponse } from "next/server";
import { sampleCelestialObjects } from "@/data/celestial";

export const runtime = "edge";

export async function GET() {
  return NextResponse.json({ items: sampleCelestialObjects });
}
