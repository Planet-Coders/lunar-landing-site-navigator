import { NextResponse } from "next/server";
import { evaluateLandingSite, HorizonsError } from "@/lib/jpl-horizons";
import type { EvaluationRequest } from "@/lib/types";

export const runtime = "nodejs";
export const revalidate = 21600;

function parseBody(data: unknown): EvaluationRequest {
  if (!data || typeof data !== "object") {
    throw new HorizonsError("JSON body required", undefined, 400);
  }
  const body = data as Record<string, unknown>;
  const siteId = String(body.siteId ?? "");
  const startTime = String(body.startTime ?? body.start ?? "");
  const stopTime = String(body.stopTime ?? body.stop ?? "");
  const stepSize =
    body.stepSize !== undefined ? String(body.stepSize) : undefined;

  if (!siteId) throw new HorizonsError("siteId is required", undefined, 400);
  return { siteId, startTime, stopTime, stepSize, location: body.location as EvaluationRequest["location"] };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const result = await evaluateLandingSite({
      siteId: url.searchParams.get("siteId") ?? "",
      startTime: url.searchParams.get("startTime") ?? "",
      stopTime: url.searchParams.get("stopTime") ?? "",
      stepSize: url.searchParams.get("stepSize") ?? undefined,
      location: url.searchParams.has("latitude") && url.searchParams.has("longitude")
        ? { latitude: Number(url.searchParams.get("latitude")?.trim() || "NaN"), longitude: Number(url.searchParams.get("longitude")?.trim() || "NaN") }
        : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const result = await evaluateLandingSite(parseBody(json));
    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}

function handleError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Unknown evaluation failure";
  const details = error instanceof HorizonsError ? error.details : undefined;
  const status = error instanceof HorizonsError ? error.status : error instanceof SyntaxError ? 400 : 502;

  return NextResponse.json(
    { error: message, details: details?.slice(0, 2000) },
    { status },
  );
}
