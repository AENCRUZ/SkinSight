# Dermatologist directory: scope and expansion recommendations

*Written 2026-11-22. This is a recommendation document only. Nothing here has been implemented: no new API, no paid
service, no backend or database change.*

## 1. What the finder does now

- The page is titled **"Find a Dermatologist"**. It no longer names a place in the heading.
- **Coverage today is Batangas Province, Philippines only**, and the page says so in a visible note ("Current coverage … demo directory").
- The directory is the **27 clinic entries** in `frontend/js/clinics-data.js`. They are untouched: no entry was removed, added or edited.
- Users can search or pin **any place** (typed place name, the map picker, or GPS). If the place is inside the covered area, clinics are listed as before. If it is outside, the list is replaced by an explanation, a link to search Google Maps for that place (labelled as not reviewed by SKINSIGHT), and a button back to the Batangas directory. Far-away clinics are never shown as if they were nearby.
- Coverage is defined in one place, `SkinsightClinics.COVERAGE` in `clinics-data.js` (a name, a country and a rough bounding box per region). Adding a region plus its clinic entries is all the UI needs to start listing it.
- Nothing claims worldwide coverage, and all directory details are still labelled unverified (see `docs/clinic-data-review.md`).

Known limit of the current design: the covered area is a *rough rectangle*, so a place just inside it but outside the province (for example Tagaytay, Cavite) is treated as covered and then shows "No listed clinics in Tagaytay" with the nearest listed clinic, which is honest but not ideal. A real boundary polygon, or a list of covered towns, would be more precise.

## 2. Do we need an external API, a curated database, or something else?

**Short answer: a curated database is needed for anything you want to call "listed" or "verified". External APIs can help with discovery and with live details, but no API gives a reliable, worldwide list of *dermatologists*.**

Reasons, from what each source can and cannot do:

| Option | What it is good for | Main limits | Cost / terms (verify before deciding) |
|---|---|---|---|
| **Curated database** (e.g. a `clinics` table in the Supabase project you already use, filled by your team) | The only way to attach *your own* verification: source, date checked, who checked it. Works for any country you are willing to research. Full control over what is shown. | Manual effort per place. Data goes stale (phones, hours) and needs periodic re-checks. | No new service if it lives in the existing Supabase project; uses the free tier's storage. |
| **Google Places API (New)** | Broad worldwide discovery of clinics near a location; live hours/phone/ratings; photos. | Google's categories are not a dermatology credential. A "skin clinic" or "doctor" result may be a spa, a general practice, or closed. It cannot confirm the doctor is a dermatologist. Display and storage rules apply (attribution, limits on caching content). Needs a billing account and an API key that must be protected. | Paid, usage-based. Google replaced the old monthly credit with per-SKU free thresholds on 1 March 2025. Pages I could read list, for example, free caps of 5,000 (Text/Nearby Search Pro) and 10,000 (Place Details Essentials) and then per-1,000 charges, but two pages disagreed, so **check the current price list**. I could **not** confirm Google's caching and place-ID storage rules from search results; read those terms before storing anything. |
| **OpenStreetMap data (Overpass API or a Geofabrik extract)** | Free discovery. The tag `healthcare:speciality=dermatology` exists (approved), so skin specialists can be queried where volunteers have mapped them. | Coverage is uneven and often sparse for small clinics, especially outside big cities; tagging quality varies; no verification. Licence is ODbL: you must credit OpenStreetMap, and a database you build from it and publish stays under ODbL (share-alike). | Free. The public Overpass servers also have fair-use limits (I did not verify their numbers). |
| **National registries / professional bodies** (e.g. the US NPI Registry; the Philippine Dermatological Society's list of fellows; national medical councils) | The only *authoritative* way to confirm that a named person is a licensed dermatologist. | Country-specific, different formats and rules, many have no public API. In the US the NPPES NPI Registry has a public API and a dermatology taxonomy code (207N00000X); I confirmed the code but **not** the API's access terms, so check CMS's documentation. I have not verified what the Philippine Dermatological Society or PRC offer; this needs a direct check. | Usually free to look up; no worldwide equivalent. |
| **Other places/POI APIs** (Foursquare, HERE, Mapbox, TomTom) | Alternatives to Google with different pricing and coverage. | Same weakness as Google: category ≠ credential. Terms differ by vendor. | Paid beyond free tiers; compare before choosing. |

### What the geocoder situation looks like today
The finder already calls the **public Nominatim** service directly from users' browsers (place search on Enter/Search and reverse geocoding for GPS). From what I could read of its usage policy and community guidance: the limits apply to the whole application's traffic combined (a documented 1 request per second), the public server is not meant for autocomplete or heavy use, and the policy can change without notice. The current usage (one request per explicit user action, no autocomplete) is on the light side, but it will not scale. I could not confirm from the policy page whether results must be shown with an OpenStreetMap attribution line; **please check and, if required, add it**. When traffic grows, plan to move to a hosted geocoder or self-hosted Photon/Nominatim.

## 3. Recommended path (nothing below has been started)

1. **Keep the demo honest as it is** (done): any location can be searched, coverage and "unverified" are stated plainly, and only entries you have are listed.
2. **Verify the 27 existing entries first** using `docs/clinic-data-review.md`. This is the foundation for any "verified" label and costs nothing.
3. **Move the directory to a curated table** in the existing Supabase project when you want to grow it, instead of a JS file. Suggested columns (proposal only; **not applied**, and it needs your approval):
   - `id`, `name`, `address`, `city`, `region`, `country`, `lat`, `lng`
   - `phone`, `email`, `website`, `hours_text`, `consultation_types`
   - `source` (where the details came from), `source_url`, `verified_on`, `verified_by`, `status` (`unverified` | `verified` | `closed`)
   - Row-level security: public read of `verified` rows; writes only for your team's role.
   - The UI shows a "Confirmed on <date>" badge only for rows that have `verified_on`.
4. **Grow region by region** (e.g. add Metro Manila, then Cebu). Each region needs: a researched clinic list, verification, and one entry in `COVERAGE`. Use the Philippine Dermatological Society's and clinics' own pages as sources, and record the URL.
5. **Optional later: use an external API for discovery only.** For example, a tool for *your team* that queries OpenStreetMap or Google Places to produce *candidate* clinics, which a person then verifies and adds. Do not show unreviewed API results to patients as "listed dermatologists". If you ever show live Google data in the app, follow Google's attribution and storage terms and budget for the paid tier.
6. **Decide the product position on other countries.** The consultation summary is generic and works anywhere, but "find a dermatologist" needs local data. For uncovered places the current fallback (a labelled Google Maps search) is the honest minimum.

## 4. Decisions needed from you
- Do you want the covered-area check to use towns or a real boundary instead of the rough rectangle?
- Is a curated Supabase table acceptable when you decide to expand? (It would be a new table, so I will ask again before creating it.)
- Which region would you add first after Batangas?
- Who on the team will own verification and the periodic re-checks?

## Sources checked
- Google Maps Platform pricing and billing: [Places API Usage and Billing](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing), [March 2025 billing changes](https://developers.google.com/maps/billing-and-pricing/march-2025), [pricing list](https://developers.google.com/maps/billing-and-pricing/pricing)
- Nominatim: [OSMF Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/), [OSM wiki: Nominatim](https://wiki.openstreetmap.org/wiki/Nominatim)
- OpenStreetMap tag and licence: [healthcare:speciality=dermatology](https://wiki.openstreetmap.org/wiki/Tag:healthcare:speciality=dermatology), [OSM copyright and licence](https://www.openstreetmap.org/copyright), [attribution guide](https://www.openstreetmap.org/copyright/attribution-guide/)
- Dermatology taxonomy code 207N00000X: [NUCC code detail](https://www.datalabs.health/medical_billing/coding/healthcare.provider.taxonomy.code.set/207N00000X) (the NPI Registry API terms themselves were **not** confirmed)

Search results can be outdated or incomplete. Treat every price, limit and term above as something to confirm on the vendor's own page before you rely on it.
