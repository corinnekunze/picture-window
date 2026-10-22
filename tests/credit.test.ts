import { describe, expect, it } from "vitest";
import { displayCredit } from "../src/credit.ts";
import { placeName } from "../src/places.ts";

// Real Artist fields from the 2026-10 batch, and what a TV should show for each.
const cases: [string, string][] = [
  ["Giles Laurent", "Giles Laurent"],
  ['Daniel Lu (<a href="https://commons.wikimedia.org/wiki/User:Dllu">User:dllu</a>)', "Daniel Lu"],
  ["Daniel Lu (User:dllu) (with special thanks to Bastian Kratzke for help with cloning out the lights)", "Daniel Lu"],
  ['<p><b>Original: </b> <a href="//commons.wikimedia.org/wiki/User:Argenberg">Vyacheslav Argenberg</a></p><small><b>Derivative work: </b> <a href="//commons.wikimedia.org/wiki/User:UnpetitproleX">UnpetitproleX</a></small>', "Vyacheslav Argenberg"],
  ["<table><tr><td>This Photo was taken by Timothy A. Gonsalves. Feel free to use my photos, but please mention me as the author. I would much appreciate if you send me an email tagooty@yahoo.com</td></tr></table>", "Timothy A. Gonsalves"],
  ["NASA ESA CSA / Science leads and image processing: M. McCaughrean S. Pearson", "NASA ESA CSA / M. McCaughrean S. Pearson"],
  ["(c) NASA, ESA, CSA / Science leads and image processing: M. McCaughrean, S. Pearson, CC BY-SA 3.0 IGO", "NASA, ESA, CSA / M. McCaughrean, S. Pearson"],
  ["DESI Collaboration/DOE/KPNO/NOIRLab/NSF/AURA/L. Tyas", "DESI Collaboration / DOE / KPNO / NOIRLab / NSF / AURA / L. Tyas"],
  ["NSF–DOE Vera C. Rubin Observatory", "NSF–DOE Vera C. Rubin Observatory"],
  ["Smailtn Camera location36° 47′ 48.25″ N, 10° 16′ 18.45″ E View this and other nearby images on: OpenStreetMap 36.796735; 10.271791", "Smailtn"],
  ["Eugene A. CernanPhotomontage by User:Grunpfnul", "Eugene A. Cernan"],
  ["Felipe Valduga from Porto Alegre, Brazil", "Felipe Valduga"],
  ["Photograph by Mike Peel (www.mikepeel.net).", "Mike Peel"],
  ["JJ Harrison (https://www.jjharrison.com.au/)", "JJ Harrison"],
  ["Joana Kruse joanaimages.com", "Joana Kruse"],
  ["Ximonic (Simo Räsänen)", "Simo Räsänen"],
  ["Achim Lammerts (Syntaxys)", "Achim Lammerts"],
  ["John D. from Pasadena, USA", "John D."],
  ["Юрий Д.К.", "Юрий Д.К."],
  ["Dominicus Johannes Bergsma.", "Dominicus Johannes Bergsma"],
  ["Precisionviews; edits (perspective correction and colour correction) made by Cmao20 (talk).", "Precisionviews"],
  ["Dietmar Rabich", "Dietmar Rabich"],
];

describe("on-screen credits", () => {
  it.each(cases)("%s", (artistHtml, expected) => {
    expect(displayCredit(artistHtml)).toEqual({ credit: expected, problem: null });
  });

  it("credits the uploader when the Artist field is only a panorama notice and the photo is their own work", () => {
    const notice = "<b>NOTE:</b> This image is a panorama consisting of multiple frames that were merged or stitched in software. As a result, the image content may be slightly different from reality. This manipulation is often required due to lens, perspective, and parallax distortions.";
    expect(displayCredit(notice, { creditHtml: '<span class="int-own-work">Own work</span>', uploader: "Roy Egloff" }).credit).toBe("Roy Egloff");
    expect(displayCredit(notice).credit).toBeNull();
  });

  it("withholds whole-word profanity but not names that merely contain it", () => {
    expect(displayCredit("Shit Photographer")).toEqual({ credit: null, problem: "possible profanity" });
    expect(displayCredit("Mono Abo-Abda").credit).toBe("Mono Abo-Abda");
  });

  it("withholds anything too long to fit", () => {
    expect(displayCredit("A".repeat(81)).problem).toMatch(/too long/);
  });
});

describe("place names", () => {
  it("keeps to town and country, falling back to region", () => {
    expect(placeName({ city: "Zug", state: "Zug", country: "Switzerland" })).toBe("Zug, Switzerland");
    expect(placeName({ county: "Mariposa County", state: "California", country: "United States" })).toBe("Mariposa County, United States");
    expect(placeName({ country: "Iceland" })).toBe("Iceland");
    expect(placeName({})).toBeNull();
  });
});
