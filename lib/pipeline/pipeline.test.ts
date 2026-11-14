import { describe, expect, it } from "vitest";
import { parseFeed } from "./feeds";
import { matchCrashNews } from "./filter";
import { normalizeUrl } from "./normalize-url";
import { isAllowedByRobots } from "./robots";

// Every headline here is invented (CLAUDE.md: no real names in tests).

describe("matchCrashNews", () => {
  it.each([
    ["धादिङमा बस दुर्घटना, ५ जनाको मृत्यु"],
    ["बस र ट्रक ठोक्किँदा ३ जना घाइते"],
    ["जिप खसेर दुई जनाको मृत्यु"],
    ["मोटरसाइकल पल्टिँदा चालकको मृत्यु"],
    ["ट्रकले किचेर पैदलयात्रीको मृत्यु", "पैदलयात्री ट्रकले किचिएर मारिए"],
    ["Bus plunges into river in Dhading, 9 dead"],
    ["Two killed as truck and motorcycle collided on the highway"],
    ["Jeep skidded off the road near the bridge"],
    ["Road accident claims three lives"],
  ])("finds a road crash: %s", (title, summary = "") => {
    expect(matchCrashNews(title, summary).matched).toBe(true);
  });

  it.each([
    ["विमान दुर्घटनामा १८ जनाको मृत्यु"],
    ["Helicopter crash kills five in the mountains"],
    ["Stock market crash wipes out gains"],
    ["संसद बैठक आज बस्दै"],
    ["Budget session begins in parliament"],
  ])("leaves out: %s", (title) => {
    expect(matchCrashNews(title).matched).toBe(false);
  });

  it("matches English words whole, not inside other words", () => {
    expect(matchCrashNews("Crashing prices at the vegetable market").matched).toBe(false);
  });

  it("reports the words it found", () => {
    expect(matchCrashNews("Bus accident: vehicle overturned").terms.sort()).toEqual(["accident", "overturned"]);
  });
});

describe("normalizeUrl", () => {
  it("drops tracking tags, the fragment, www, a trailing slash and http", () => {
    expect(normalizeUrl("http://www.Example.com/news/123/?utm_source=fb&id=7&fbclid=x#top")).toBe("https://example.com/news/123?id=7");
  });
  it("gives one spelling whatever the parameter order", () => {
    expect(normalizeUrl("https://example.com/a?b=2&a=1")).toBe(normalizeUrl("https://example.com/a?a=1&b=2"));
  });
  it("keeps the root path", () => {
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com/");
  });
  it.each(["not a url", "javascript:alert(1)", "ftp://example.com/x", ""])("refuses %j", (u) => {
    expect(normalizeUrl(u)).toBeNull();
  });
});

describe("isAllowedByRobots", () => {
  const BOT = "SadakSmritiBot/0.1";
  it("allows when there is no rule", () => {
    expect(isAllowedByRobots("", BOT, "/feed")).toBe(true);
  });
  it("obeys a Disallow for everyone", () => {
    expect(isAllowedByRobots("User-agent: *\nDisallow: /feed", BOT, "/feed")).toBe(false);
  });
  it("uses our own group over the * group", () => {
    const txt = "User-agent: *\nDisallow: /\n\nUser-agent: SadakSmritiBot\nAllow: /feed";
    expect(isAllowedByRobots(txt, BOT, "/feed")).toBe(true);
    expect(isAllowedByRobots(txt, BOT, "/private")).toBe(true);
  });
  it("lets the longest rule win", () => {
    const txt = "User-agent: *\nDisallow: /news\nAllow: /news/feed";
    expect(isAllowedByRobots(txt, BOT, "/news/feed")).toBe(true);
    expect(isAllowedByRobots(txt, BOT, "/news/123")).toBe(false);
  });
  it("ignores an empty Disallow and comments", () => {
    expect(isAllowedByRobots("User-agent: * # all\nDisallow:\n", BOT, "/feed")).toBe(true);
  });
  it("understands * and $", () => {
    expect(isAllowedByRobots("User-agent: *\nDisallow: /*.xml$", BOT, "/feed.xml")).toBe(false);
    expect(isAllowedByRobots("User-agent: *\nDisallow: /*.xml$", BOT, "/feed.xml?x=1")).toBe(true);
  });
});

describe("parseFeed", () => {
  it("reads RSS 2.0, with CDATA, HTML in the summary and entities", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <rss version="2.0"><channel><title>Example</title>
        <item><title><![CDATA[बस दुर्घटना &amp; उद्धार]]></title><link>https://example.com/a/1</link>
          <description><![CDATA[<p>Five <b>injured</b>&nbsp;today</p>]]></description>
          <pubDate>Fri, 13 Nov 2026 05:45:00 +0545</pubDate></item>
        <item><title>No link here</title></item>
      </channel></rss>`;
    const items = parseFeed(xml);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("बस दुर्घटना & उद्धार");
    expect(items[0].url).toBe("https://example.com/a/1");
    expect(items[0].summary).toBe("Five injured today");
    expect(items[0].publishedAt?.toISOString()).toBe("2026-11-13T00:00:00.000Z");
  });

  it("reads Atom", () => {
    const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><title>Example</title>
      <entry><title>Truck overturned</title><link rel="alternate" href="https://example.com/b/2"/>
        <updated>2026-11-13T06:00:00Z</updated><summary>Two hurt</summary></entry></feed>`;
    expect(parseFeed(xml)).toEqual([
      { title: "Truck overturned", url: "https://example.com/b/2", summary: "Two hurt", publishedAt: new Date("2026-11-13T06:00:00Z") },
    ]);
  });

  it("refuses something that is not a feed", () => {
    expect(() => parseFeed("<html><body>Not found</body></html>")).toThrow(/not an RSS or Atom feed/);
  });
});
