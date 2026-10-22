// Wikimedia Commons API client. Follows Wikimedia's etiquette: a descriptive
// User-Agent, maxlag, backoff on 429/503, and only standard thumbnail widths.
import { z } from "zod";
import { SOURCE_CATEGORY, USER_AGENT } from "./config.ts";
import type { FileInfo } from "./filters.ts";

const API_URL = "https://commons.wikimedia.org/w/api.php";
const WIKIDATA_API_URL = "https://www.wikidata.org/w/api.php";
const RETRYABLE_STATUSES = [429, 500, 502, 503, 504];
const METADATA_FIELDS = "LicenseShortName|LicenseUrl|Artist|Credit|Restrictions|Categories|GPSLatitude|GPSLongitude";
/** Thumbnail width the review grid shows; 1280 for the zoom view, 3840 for rendering. */
const REVIEW_THUMB_WIDTH = 500;
const BATCH_SIZE = 50;

export interface CommonsFile extends FileInfo {
  pageId: number;
  /** The Artist field as Commons gives it: HTML, sometimes with templates and notes mixed in. */
  author: string;
  /** The Credit field ("Own work", a source) and who uploaded the file: a fallback for the credit. */
  creditHtml: string;
  uploader: string;
  /** Where the camera stood, when the file records it. */
  latitude: number | null;
  longitude: number | null;
  licenseUrl: string | null;
  sourceUrl: string;
  originalUrl: string;
  thumbUrl: string;
}

const ApiError = z.object({ error: z.object({ code: z.string(), info: z.string() }) });

const CategoryPage = z.object({
  query: z.object({ categorymembers: z.array(z.object({ pageid: z.number() })) }),
  continue: z.record(z.string(), z.string()).optional(),
});

const MetadataValue = z.object({ value: z.unknown() }).optional();
const ImagePage = z.object({
  pageid: z.number(),
  title: z.string(),
  imageinfo: z.array(z.object({
    mime: z.string(),
    user: z.string().optional(),
    width: z.number(),
    height: z.number(),
    url: z.string(),
    descriptionurl: z.string(),
    thumburl: z.string(),
    extmetadata: z.record(z.string(), MetadataValue).optional(),
  })).optional(),
});
const ImageInfoResponse = z.object({ query: z.object({ pages: z.array(ImagePage) }) });

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function fetchWithRetry(url: string, attempts = 5): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (response.ok) return response;

    const retryable = RETRYABLE_STATUSES.includes(response.status);
    if (!retryable || attempt >= attempts) {
      throw new Error(`${response.status} ${response.statusText} for ${url}`);
    }
    const retryAfterSeconds = Number(response.headers.get("retry-after"));
    await sleep(retryAfterSeconds * 1000 || 2000 * 2 ** attempt);
  }
}

export async function downloadBuffer(url: string): Promise<Buffer> {
  const response = await fetchWithRetry(url);
  return Buffer.from(await response.arrayBuffer());
}

async function queryApi(params: Record<string, string>): Promise<unknown> {
  const query = new URLSearchParams({ action: "query", format: "json", formatversion: "2", maxlag: "5", ...params });
  if (params.action === "wbgetentities") query.delete("formatversion");
  const response = await fetchWithRetry(`${API_URL}?${query}`);
  const body: unknown = await response.json();

  const apiError = ApiError.safeParse(body);
  if (apiError.success) {
    throw new Error(`Commons API: ${apiError.data.error.code} ${apiError.data.error.info}`);
  }
  return body;
}

/** Every page ID in the Featured Pictures category, newest promotion first. */
export async function listFeaturedPageIds(): Promise<number[]> {
  const pageIds: number[] = [];
  let continuation: Record<string, string> = {};
  do {
    const page = CategoryPage.parse(await queryApi({
      list: "categorymembers", cmtitle: SOURCE_CATEGORY, cmtype: "file", cmlimit: "500",
      cmsort: "timestamp", cmdir: "desc", cmprop: "ids", ...continuation,
    }));
    pageIds.push(...page.query.categorymembers.map((member) => member.pageid));
    continuation = page.continue ?? {};
  } while (continuation.cmcontinue);
  return pageIds;
}

/** Metadata for the given files, in the order asked. Files Commons can't describe are left out. */
export async function fetchFileInfo(pageIds: number[]): Promise<CommonsFile[]> {
  const files: CommonsFile[] = [];
  for (let start = 0; start < pageIds.length; start += BATCH_SIZE) {
    const batchIds = pageIds.slice(start, start + BATCH_SIZE);
    const response = ImageInfoResponse.parse(await queryApi({
      pageids: batchIds.join("|"), prop: "imageinfo", iiprop: "url|size|mime|user|extmetadata",
      iiurlwidth: String(REVIEW_THUMB_WIDTH), iiextmetadatafilter: METADATA_FIELDS,
    }));
    const pagesById = new Map(response.query.pages.map((page) => [page.pageid, page]));
    for (const pageId of batchIds) {
      const file = toCommonsFile(pagesById.get(pageId));
      if (file) files.push(file);
    }
    await sleep(300);
  }
  return files;
}

function toCommonsFile(page: z.infer<typeof ImagePage> | undefined): CommonsFile | null {
  const imageInfo = page?.imageinfo?.[0];
  if (!page || !imageInfo) return null;

  const metadata = (field: string): string => String(imageInfo.extmetadata?.[field]?.value ?? "");
  return {
    pageId: page.pageid,
    title: page.title,
    mime: imageInfo.mime,
    width: imageInfo.width,
    height: imageInfo.height,
    license: metadata("LicenseShortName"),
    licenseUrl: metadata("LicenseUrl") || null,
    restrictions: metadata("Restrictions"),
    categories: metadata("Categories"),
    author: metadata("Artist"),
    creditHtml: metadata("Credit"),
    uploader: imageInfo.user ?? "",
    latitude: coordinate(metadata("GPSLatitude")),
    longitude: coordinate(metadata("GPSLongitude")),
    sourceUrl: imageInfo.descriptionurl,
    originalUrl: imageInfo.url,
    thumbUrl: imageInfo.thumburl,
  };
}

function coordinate(value: string): number | null {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const DescriptionResponse = z.object({
  query: z.object({
    pages: z.array(z.object({
      pageid: z.number(),
      imageinfo: z.array(z.object({ extmetadata: z.record(z.string(), MetadataValue).optional() })).optional(),
    })),
  }),
});

const MediaInfoResponse = z.object({
  entities: z.record(z.string(), z.object({
    statements: z.record(z.string(), z.array(z.object({
      mainsnak: z.object({ datavalue: z.object({ value: z.unknown() }).optional() }),
    }))).or(z.array(z.never())).optional(),
  })),
});

const WikidataItem = z.object({ id: z.string().regex(/^Q\d+$/) });

const WikidataLabels = z.object({
  entities: z.record(z.string(), z.object({ labels: z.record(z.string(), z.object({ value: z.string() })).optional() })),
});

/** A file's description (HTML), and whether Commons marked it as English rather than leaving it untagged. */
export interface Description {
  html: string;
  taggedEnglish: boolean;
}

/**
 * Each file's English description, by page ID. Asked separately from fetchFileInfo because the
 * multi-language option would turn other fields, such as Artist, into per-language maps too. Untagged
 * descriptions are kept but marked, since they can be in any language; tagged non-English ones are left out.
 */
export async function fetchEnglishDescriptions(pageIds: number[]): Promise<Map<number, Description>> {
  const descriptions = new Map<number, Description>();
  for (let start = 0; start < pageIds.length; start += BATCH_SIZE) {
    const response = DescriptionResponse.parse(await queryApi({
      pageids: pageIds.slice(start, start + BATCH_SIZE).join("|"), prop: "imageinfo", iiprop: "extmetadata",
      iiextmetadatafilter: "ImageDescription", iiextmetadatamultilang: "1",
    }));
    for (const page of response.query.pages) {
      const english = englishValue(page.imageinfo?.[0]?.extmetadata?.ImageDescription?.value);
      if (english) descriptions.set(page.pageid, english);
    }
    await sleep(300);
  }
  return descriptions;
}

function englishValue(value: unknown): Description | null {
  if (typeof value === "string") return { html: value, taggedEnglish: false };
  if (value && typeof value === "object" && "en" in value) {
    return { html: String((value as Record<string, unknown>).en), taggedEnglish: true };
  }
  return null;
}

/** English names of what each file is tagged as showing (Commons "depicts", P180), by page ID. */
export async function fetchDepictedLabels(pageIds: number[]): Promise<Map<number, string[]>> {
  const depictedIds = new Map<number, string[]>();
  for (let start = 0; start < pageIds.length; start += BATCH_SIZE) {
    const batchIds = pageIds.slice(start, start + BATCH_SIZE);
    const response = MediaInfoResponse.parse(await queryApi({
      action: "wbgetentities", ids: batchIds.map((pageId) => `M${pageId}`).join("|"), props: "claims",
    }));
    for (const [entityId, entity] of Object.entries(response.entities)) {
      const statements = Array.isArray(entity.statements) ? {} : entity.statements ?? {};
      const items = (statements.P180 ?? []).flatMap((claim) => {
        const parsed = WikidataItem.safeParse(claim.mainsnak.datavalue?.value);
        return parsed.success ? [parsed.data.id] : [];
      });
      if (items.length) depictedIds.set(Number(entityId.slice(1)), items);
    }
    await sleep(300);
  }
  const labels = await fetchWikidataLabels([...new Set([...depictedIds.values()].flat())]);
  return new Map([...depictedIds].map(([pageId, items]) => [pageId, items.flatMap((item) => labels.get(item) ?? [])]));
}

async function fetchWikidataLabels(itemIds: string[]): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  for (let start = 0; start < itemIds.length; start += BATCH_SIZE) {
    const query = new URLSearchParams({
      action: "wbgetentities", format: "json", maxlag: "5", props: "labels", languages: "en",
      ids: itemIds.slice(start, start + BATCH_SIZE).join("|"),
    });
    const response = WikidataLabels.parse(await (await fetchWithRetry(`${WIKIDATA_API_URL}?${query}`)).json());
    for (const [itemId, entity] of Object.entries(response.entities)) {
      const label = entity.labels?.en?.value;
      if (label) labels.set(itemId, label);
    }
    await sleep(300);
  }
  return labels;
}

/** The same Commons thumbnail at another standard width (500, 1280, 3840). */
export function thumbnailAtWidth(thumbUrl: string, width: number): string {
  return thumbUrl.replace(/\/\d+px-([^/]+)$/, `/${width}px-$1`);
}

/**
 * A copy at least `minWidth` pixels wide. Commons pre-renders 3840; anything wider,
 * or a file that is exactly that size, comes from the original.
 */
export function downloadUrlFor(file: { originalUrl: string; thumbUrl: string; width: number }, minWidth: number): string {
  const thumbnailIsEnough = minWidth <= 3840 && file.width > 3840;
  if (!thumbnailIsEnough) return file.originalUrl;
  return thumbnailAtWidth(file.thumbUrl, 3840);
}
