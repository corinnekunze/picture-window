// A vague place name for where a photo was taken ("Zug, Switzerland"), from the camera coordinates
// Commons records. Looked up with OpenStreetMap's Nominatim, following its usage policy: one request
// a second, a descriptive User-Agent, and every answer cached in state/places.json so a spot is only
// asked about once. Place data © OpenStreetMap contributors (ODbL), credited on the credits page.
import { existsSync } from "node:fs";
import { z } from "zod";
import { USER_AGENT } from "./config.ts";
import { readJson, writeJson } from "./io.ts";
import { PATHS } from "./paths.ts";

const REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
/** Town or city level; anything finer would say more about where someone stood than a TV needs. */
const ZOOM = "10";
const REQUEST_GAP_MS = 1100;

const Address = z.object({
  city: z.string().optional(),
  town: z.string().optional(),
  village: z.string().optional(),
  municipality: z.string().optional(),
  county: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
}).passthrough();
const ReverseResponse = z.object({ address: Address.optional(), error: z.string().optional() });

/** Coordinates rounded to two decimals (about a kilometre) → place name, or null for "nowhere". */
const PlaceCache = z.record(z.string(), z.string().nullable());
type PlaceCache = z.infer<typeof PlaceCache>;

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function cacheKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
}

/** "Town, Country", else "Region, Country", else "Country"; null at sea or when OSM has nothing. */
export function placeName(address: z.infer<typeof Address>): string | null {
  const locality = address.city ?? address.town ?? address.village ?? address.municipality;
  const area = locality ?? address.county ?? address.state;
  if (!address.country) return area ?? null;
  return area ? `${area}, ${address.country}` : address.country;
}

export class PlaceLookup {
  private readonly cache: PlaceCache;
  private lastRequestAt = 0;
  private lookups = 0;

  constructor() {
    this.cache = existsSync(PATHS.places) ? readJson(PATHS.places, PlaceCache) : {};
  }

  async find(latitude: number | null, longitude: number | null): Promise<string | null> {
    if (latitude === null || longitude === null) return null;
    const key = cacheKey(latitude, longitude);
    if (key in this.cache) return this.cache[key]!;
    const place = await this.reverse(latitude, longitude);
    this.cache[key] = place;
    if (++this.lookups % 25 === 0) this.save();
    return place;
  }

  save(): void {
    const sorted = Object.fromEntries(Object.entries(this.cache).sort(([left], [right]) => left.localeCompare(right)));
    writeJson(PATHS.places, sorted);
  }

  private async reverse(latitude: number, longitude: number): Promise<string | null> {
    await sleep(Math.max(0, this.lastRequestAt + REQUEST_GAP_MS - Date.now()));
    this.lastRequestAt = Date.now();
    const query = new URLSearchParams({
      format: "jsonv2", lat: latitude.toFixed(2), lon: longitude.toFixed(2), zoom: ZOOM, "accept-language": "en",
    });
    const response = await fetch(`${REVERSE_URL}?${query}`, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) throw new Error(`Nominatim ${response.status} for ${latitude},${longitude}`);
    const body = ReverseResponse.parse(await response.json());
    return body.address ? placeName(body.address) : null;
  }
}
