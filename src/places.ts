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

/**
 * Coordinates rounded to two decimals (about a kilometre) → OpenStreetMap's address there, or null
 * for "nowhere". Keeping the address, not the finished name, lets the naming rules change without
 * asking OpenStreetMap again.
 */
const PlaceCache = z.record(z.string(), Address.nullable());
type PlaceCache = z.infer<typeof PlaceCache>;
type Address = z.infer<typeof Address>;

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function cacheKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
}

/** Words that make a district's official name ("Sujangarh Tehsil", "gmina Świecie") read like paperwork. */
const ADMINISTRATIVE_WORDS =
  /\b(?:Tehsil|Tahsil|Rayon|Raion|Regional Unit|Municipal Unit|Municipal District|Urban Municipality|Municipality(?: of)?|Settlement Hromada|Urban Okrug|Subdivision|Subdistrict(?: Municipality)?|Mandal|Kabupaten|gmina|Grad|vald|linn|kommun|Sveitarfélagið|Parroquia|Xã|Merkez)\b|-si$|\s*\([^)]*\)/giu;
const LATIN_TEXT = /^[\p{Script=Latin}\p{N}\s.,'’&/-]+$/u;

/**
 * "Town, Country", else "Region, Country", else "Country"; null at sea or when OpenStreetMap has
 * nothing. Only real towns count as the first part (districts and counties have bureaucratic names),
 * and any part a viewer couldn't read (not in Latin script, or still administrative) gives way to the
 * next one up.
 */
export function placeName(address: Address): string | null {
  const country = readable(address.country);
  const area = [address.city, address.town, address.village, address.state].map(readable).find(Boolean);
  if (!country) return area ?? null;
  if (!area || area === country) return country;
  return `${area}, ${country}`;
}

function readable(name: string | undefined): string | null {
  if (!name || !LATIN_TEXT.test(name)) return null;
  // Bilingual names ("Prags - Braies", "Bonifacio / Bunifaziu") keep their first form.
  const firstForm = name.split(/\s+[-/]\s+/)[0]!;
  const cleaned = firstForm.replace(ADMINISTRATIVE_WORDS, "").replace(/\s+/g, " ").trim();
  if (!cleaned || /\b(?:District|Area [A-Z]|No\.|Section|Sección|Forst)\b/i.test(cleaned)) return null;
  return cleaned;
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
    if (!(key in this.cache)) {
      this.cache[key] = await this.reverse(latitude, longitude);
      if (++this.lookups % 25 === 0) this.save();
    }
    const address = this.cache[key];
    return address ? placeName(address) : null;
  }

  save(): void {
    const sorted = Object.fromEntries(Object.entries(this.cache).sort(([left], [right]) => left.localeCompare(right)));
    writeJson(PATHS.places, sorted);
  }

  private async reverse(latitude: number, longitude: number): Promise<Address | null> {
    await sleep(Math.max(0, this.lastRequestAt + REQUEST_GAP_MS - Date.now()));
    this.lastRequestAt = Date.now();
    const query = new URLSearchParams({
      format: "jsonv2", lat: latitude.toFixed(2), lon: longitude.toFixed(2), zoom: ZOOM, "accept-language": "en",
    });
    const response = await fetch(`${REVERSE_URL}?${query}`, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) throw new Error(`Nominatim ${response.status} for ${latitude},${longitude}`);
    const body = ReverseResponse.parse(await response.json());
    if (!body.address) return null;
    const { city, town, village, municipality, county, state, country } = body.address;
    return { city, town, village, municipality, county, state, country };
  }
}
