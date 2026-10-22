import { describe, expect, it } from "vitest";
import { themeCredits } from "../src/theme.ts";

describe("themeCredits", () => {
  it("credits each photo by name, license and source", () => {
    const credits = themeCredits([
      { id: "wmc-1", title: "Mountain lake", author: "Vyacheslav Argenberg", license: "CC BY 4.0", sourceUrl: "https://commons.wikimedia.org/wiki/File:Lake.jpg" },
    ]);
    expect(credits).toContain("wmc-1.webp");
    expect(credits).toContain("Photo by Vyacheslav Argenberg, CC BY 4.0");
    expect(credits).toContain("https://commons.wikimedia.org/wiki/File:Lake.jpg");
    expect(credits).toContain("/credits.html");
  });
});
