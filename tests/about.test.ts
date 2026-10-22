import { describe, expect, it } from "vitest";
import { describePhoto } from "../src/about.ts";

const english = (html: string) => ({ html, taggedEnglish: true });
const untagged = (html: string) => ({ html, taggedEnglish: false });

// Real descriptions from the 2026-10 batch, and the line a TV should show.
const cases: [string, string][] = [
  ["Great Grey Shrike (Lanius excubitor, Laniidae, Passeriformes) in Bhigwan, Maharashtra, India.", "Great Grey Shrike in Bhigwan, Maharashtra, India"],
  ["Chapel Bridge, a covered wooden footbridge spanning the river Reuss in the city of Lucerne in central Switzerland. Named after the nearby St. Peter's Chapel, the bridge is unique.", "Chapel Bridge, a covered wooden footbridge spanning the river Reuss"],
  ["This image shows the full survey of the inner Orion Nebula and Trapezium Cluster made using the NIRCam instrument on the NASA/ESA/CSA James Webb Space Telescope.", "The full survey of the inner Orion Nebula and Trapezium Cluster"],
  ["The Cathedral of the Holy Trinity (French: Sainte-Trinité) is the cathedral of the Anglican Diocese of Quebec and home to two parishes: the Parish of Quebec and la Paroisse.", "The Cathedral of the Holy Trinity"],
  ["art002e009288 (April 6, 2026) – Earthset captured through the Orion spacecraft window at 6:41 p.m. EDT, April 6, 2026, during the Artemis II crew's flyby of the Moon.", "Earthset captured through the Orion spacecraft window at 6:41 p.m. EDT, April 6, 2026"],
  ["View of the <a>Grund</a> at dawn, the quarter located in the valley below the centre of <a>Luxembourg City</a> on the banks of the Alzette river with the Abbey in the foreground.", "View of the Grund at dawn"],
  ["Lake Tahoe at morning, Speedboat beach, 2023.", "Lake Tahoe at morning, Speedboat beach"],
  ["Open wing basking upon cemented floor of Bassarona durga - Blue Duke_WLB_IMG 4446", "Open wing basking upon cemented floor of Bassarona durga - Blue Duke"],
  // "TransPennine" is a name, not two paragraphs run together.
  ["Royal Border railway Bridge, with a TransPennine Express train crossing", "Royal Border railway Bridge, with a TransPennine Express train crossing"],
  ["Great tit standing on flowering Wisteria in Glâne District, Switzerland", "Great tit standing on flowering Wisteria in Glâne District, Switzerland"],
  ["Basilica of the National Shrine of Our Lady of Aparecida, Sao Paulo, Brazil", "Basilica of the National Shrine of Our Lady of Aparecida, Sao Paulo, Brazil"],
];

describe("about lines", () => {
  it.each(cases)("%s", (html, expected) => {
    expect(describePhoto(english(html))).toEqual({ about: expected, problem: null });
  });

  it("skips template notices for the photographer's own sentence", () => {
    expect(describePhoto(english("This is a photo of a monument in Armenia identified by the ID 1-23. Haghpat Monastery at dusk.")).about).toBe("Haghpat Monastery at dusk");
    expect(describePhoto(english("This is a photo of a monument in Iran identified by the ID")).about).toBeNull();
  });

  it("leaves out credit lines, other languages and sentences about the photographer", () => {
    expect(describePhoto(untagged("Crédito: Vitor Bernabe Barbosa Arquivo liberado pela Marinha do Brasil")).about).toBeNull();
    expect(describePhoto(untagged("Desde Mérida, las fotos se tomaron entre las 5 y 6:15 h")).about).toBeNull();
    expect(describePhoto(untagged("Mont Saint Michel and sheep")).about).toBe("Mont Saint Michel and sheep");
    expect(describePhoto(english("I centered myself at the courtyard of the mosque")).problem).toBe("about the photographer");
  });

  it("keeps grim details off the TV", () => {
    expect(describePhoto(english("African white-backed vultures feeding on wildebeest carcass, Serengeti")).problem).toBe("blocked word");
  });

  it("falls back to the most specific depicts tag", () => {
    expect(describePhoto(null, ["landscape", "Toujane", "Matmata"]).about).toBe("Toujane");
    expect(describePhoto(null, ["solar eclipse"]).about).toBe("Solar eclipse");
    expect(describePhoto(null, ["bridge", "landscape", "architecture"]).about).toBeNull();
  });
});
