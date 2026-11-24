import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { geocode, roadDistanceKm } = await import("@/modules/odf/routing");
const { estimatedRoadKm } = await import("@/modules/odf/geo");

const A = { lat: -8.8, lng: 13.23 };
const B = { lat: -8.9, lng: 13.4 };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("roadDistanceKm", () => {
  it("falls back to straight line × 1.3 without ROUTING_URL", async () => {
    vi.stubEnv("ROUTING_URL", "");
    expect(await roadDistanceKm(A, B)).toEqual({ km: estimatedRoadKm(A, B), source: "estimate" });
  });

  it("uses the OSRM road distance when available", async () => {
    vi.stubEnv("ROUTING_URL", "https://osrm.test/");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ code: "Ok", routes: [{ distance: 23456 }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await roadDistanceKm(A, B)).toEqual({ km: 23.5, source: "route" });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://osrm.test/route/v1/driving/13.23000,-8.80000;13.40000,-8.90000?overview=false",
    );
  });

  it("falls back when the routing service fails", async () => {
    vi.stubEnv("ROUTING_URL", "https://osrm.test");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    const C = { lat: -9.1, lng: 13.5 };
    expect(await roadDistanceKm(A, C)).toEqual({ km: estimatedRoadKm(A, C), source: "estimate" });
  });
});

describe("geocode", () => {
  it("returns null when not configured", async () => {
    vi.stubEnv("GEOCODER_URL", "");
    expect(await geocode("Viana", "pt")).toBeNull();
  });

  it("restricts the search to Angola and maps results", async () => {
    vi.stubEnv("GEOCODER_URL", "https://nominatim.test");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify([{ display_name: "Viana, Luanda, Angola", lat: "-8.9", lon: "13.37" }])),
      );
    vi.stubGlobal("fetch", fetchMock);
    expect(await geocode("Viana", "pt")).toEqual([{ label: "Viana, Luanda, Angola", lat: -8.9, lng: 13.37 }]);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("countrycodes")).toBe("ao");
  });
});
