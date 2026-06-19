// Client-side geo-block for the Russian Federation.
//
// This is a static site (GitHub Pages) with no server, so the country can only
// be detected in the browser via a third-party IP geolocation API. That makes
// the check best-effort and trivially bypassable — it is a statement, not a
// security control. It also fails open: any network/API error leaves the site
// fully accessible so legitimate visitors are never blocked by a flaky lookup.

const REDIRECT_URL = "https://druh.ua/";
const COUNTRY_API = "https://api.country.is/";
const BLOCKED_COUNTRY = "RU";

export async function blockRussianFederation(): Promise<void> {
  try {
    const res = await fetch(COUNTRY_API, { method: "GET" });
    if (!res.ok) return;
    const data: { country?: string } = await res.json();
    if (data.country?.toUpperCase() === BLOCKED_COUNTRY) {
      window.location.replace(REDIRECT_URL);
    }
  } catch {
    // Fail open: never block a visitor because the lookup failed.
  }
}
