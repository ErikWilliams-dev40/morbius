import assert from "node:assert/strict";
import test from "node:test";

import {
  companies,
  primarySiteFor,
  siteByUrl,
  siteUrlKey,
  sites,
  sitesForCompany,
} from "../lib/domain.ts";

test("only a parked domain has no website link", () => {
  const unlinked = companies
    .filter((company) => sitesForCompany(company.id).length === 0)
    .map((company) => company.id);
  // Easy Tiger Botanicals' domain resolves to a parking page, so it has no
  // deployment to list. Any other company losing its links is a regression, and
  // adding Easy Tiger's first site means updating this expectation.
  assert.deepEqual(unlinked, ["tiger"]);
});

test("a company's domain is one of its own website links", () => {
  // The Companies view and the Websites panel read different fields, so a typo
  // in either would show one link in one place and a different link in another.
  for (const company of companies) {
    const owned = sitesForCompany(company.id);
    if (!owned.length) continue;
    const links = owned.map((site) => siteUrlKey(site.url));
    assert.ok(
      links.includes(siteUrlKey(company.url)),
      `${company.id} lists ${company.url} but its sites are ${links.join(", ")}`,
    );
  }
});

test("every website link belongs to a known company and is https", () => {
  const ids = new Set(companies.map((company) => company.id));
  for (const site of sites) {
    assert.ok(site.company === null || ids.has(site.company), `${site.id} has an unknown company`);
    assert.match(site.url, /^https:\/\//, `${site.id} is not an https link`);
    assert.ok(URL.canParse(site.url), `${site.id} is not a valid URL`);
  }
});

test("website ids and links are unique", () => {
  assert.equal(new Set(sites.map((site) => site.id)).size, sites.length);
  assert.equal(new Set(sites.map((site) => siteUrlKey(site.url))).size, sites.length);
});

test("a company's sites come live first, and the live one is the default", () => {
  const rank = { Live: 0, Staging: 1, Preview: 2 };
  for (const company of companies) {
    const owned = sitesForCompany(company.id);
    owned.forEach((site, index) => {
      assert.equal(site.company, company.id);
      if (index > 0) assert.ok(rank[owned[index - 1].stage] <= rank[site.stage]);
    });
    const primary = primarySiteFor(company.id);
    assert.equal(primary, owned[0] ?? null);
    if (owned.some((site) => site.stage === "Live"))
      assert.equal(primary?.stage, "Live", `${company.id} should default to its live site`);
  }
});

test("a saved reference link resolves to the site it names", () => {
  assert.equal(siteByUrl("https://houseofhelixpeptides.com")?.id, "helix-live");
  assert.equal(siteByUrl("https://HOUSEOFHELIXPEPTIDES.COM/")?.id, "helix-live");
  assert.equal(siteByUrl("https://example.com/"), null);
  assert.equal(siteByUrl(""), null);
});
