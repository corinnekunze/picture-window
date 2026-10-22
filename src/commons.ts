import { SOURCE_CATEGORY, USER_AGENT } from "./config.ts";
import type { FileInfo } from "./filters.ts";

const API = "https://commons.wikimedia.org/w/api.php";

export interface CommonsFile extends FileInfo {
  pageId: number;
  author: string;
  licenseUrl: string | null;
  sourceUrl: string;
  originalUrl: string;
  thumbUrl: string;
  bytes: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET with Wikimedia's etiquette: User-Agent, maxlag, and backoff on 429/503. */
export async function getWithRetry(url: string, attempts = 5): Promise<Response> {
  for (let i = 0; ; i++) {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (res.ok) return res;
    if (i + 1 >= attempts || ![429, 500, 502, 503, 504].includes(res.status)) {
      throw new Error(`${res.status} ${res.statusText} for ${url}`);
    }
    const wait = Number(res.headers.get("retry-after")) * 1000 || 2000 * 2 ** i;
    await sleep(wait);
  }
}

async function api(params: Record<string, string>): Promise<any> {
  const query = new URLSearchParams({ action: "query", format: "json", formatversion: "2", maxlag: "5", ...params });
  const res = await getWithRetry(`${API}?${query}`);
  const body: any = await res.json();
  if (body.error) throw new Error(`Commons API: ${body.error.code} ${body.error.info}`);
  return body;
}

/** Every page ID in the Featured Pictures category, newest promotion first. */
export async function listFeatured(): Promise<number[]> {
  const ids: number[] = [];
  let cont: Record<string, string> = {};
  do {
    const body = await api({
      list: "categorymembers", cmtitle: SOURCE_CATEGORY, cmtype: "file", cmlimit: "500",
      cmsort: "timestamp", cmdir: "desc", cmprop: "ids", ...cont,
    });
    for (const m of body.query.categorymembers) ids.push(m.pageid);
    cont = body.continue ?? {};
  } while (cont.cmcontinue);
  return ids;
}

/** Metadata for up to 50 files per request, in the order asked. */
export async function fileInfo(pageIds: number[]): Promise<CommonsFile[]> {
  const out: CommonsFile[] = [];
  for (let i = 0; i < pageIds.length; i += 50) {
    const chunk = pageIds.slice(i, i + 50);
    const body = await api({
      pageids: chunk.join("|"), prop: "imageinfo", iiprop: "url|size|mime|extmetadata", iiurlwidth: "500",
      iiextmetadatafilter: "LicenseShortName|LicenseUrl|Artist|Restrictions|Categories",
    });
    const byId = new Map<number, any>(body.query.pages.map((p: any) => [p.pageid, p]));
    for (const id of chunk) {
      const page = byId.get(id);
      const ii = page?.imageinfo?.[0];
      if (!ii) continue;
      const meta = (key: string): string => ii.extmetadata?.[key]?.value ?? "";
      out.push({
        pageId: id,
        title: page.title,
        mime: ii.mime,
        width: ii.width,
        height: ii.height,
        bytes: ii.size,
        license: meta("LicenseShortName"),
        licenseUrl: meta("LicenseUrl") || null,
        restrictions: meta("Restrictions"),
        categories: meta("Categories"),
        author: meta("Artist"),
        sourceUrl: ii.descriptionurl,
        originalUrl: ii.url,
        thumbUrl: ii.thumburl,
      });
    }
    await sleep(300);
  }
  return out;
}

/**
 * URL for a copy at least `minWidth` wide. Commons pre-renders a few standard widths
 * (3840 is one); anything wider comes from the original.
 */
export function sizedUrl(file: { originalUrl: string; thumbUrl: string; width: number }, minWidth: number): string {
  if (minWidth <= 3840 && file.width > 3840) {
    return file.thumbUrl.replace(/\/\d+px-([^/]+)$/, "/3840px-$1");
  }
  return file.originalUrl;
}
