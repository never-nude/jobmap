# Jobs for Dave · Jobmap

A public, permanently dark U.S. map of mechanical engineering openings with employer-published base salary minima of **$100,000/year or more**. No API keys or paid services are required.

- Position, company, salary, location, work setting, skills / experience, and direct employer application links.
- Age colors: **blue 0–7 days → green 8–14 → yellow 15–30 → red 31+**. Unknown dates are gray. A grouped pin uses its newest listing's color.
- Search, work-setting, and **Energy & related only** filters; a gentle energy-sector preference within each posting-age band by default; mobile layout. Choose **Newest listed** for strict date order.
- GitHub Actions checks employer feeds every half hour, at :07 and :37 UTC. Scheduling is best effort and can be delayed by GitHub. The browser fetches the newest snapshot every 30 minutes and on return to the tab.

## Run locally

Requires Node 22+ and Python 3. No npm dependencies.

```sh
node scripts/refresh.mjs
node --test scripts/*.test.mjs
python3 -m http.server 4173
```

Open http://localhost:4173. Source configuration is in `data/sources.json`.

## Publishing

The workflow `.github/workflows/refresh.yml` fetches jobs, checks normalization rules, commits the snapshot, then deploys the static website to GitHub Pages. Set **Settings → Pages → Source → GitHub Actions** once. Manual refresh is available through **Actions → Refresh jobs and deploy map → Run workflow**. It also runs when source changes are pushed to main.

The workflow uses the repository's automatic `GITHUB_TOKEN`; no personal token is needed. Source commits made by the workflow do not recursively trigger another workflow. Scheduled data commits also keep the repository active, though GitHub can still disable schedules or Actions because of account policies. The UI flags snapshots older than 75 minutes.

## Energy-sector emphasis

All qualifying mechanical engineering openings remain visible by default. **Recent + energy** puts energy-connected jobs first within each age band (0–7, 8–14, 15–30, 31+ days; undated last), then sorts by posting date. A newer age band always leads an older one. **Energy & related only** narrows the list and map together.

Labels come from verified energy-employer sectors or explicit energy terms in the job title. Each labeled job explains the connection in its details. These are sector hints, not qualification or personal-fit scores. Generic terms such as “power” or “thermal” alone do not qualify. Employer evidence and matching rules live in `energy.mjs`. Salary thresholds, work-setting labels, and posting-age colors are unchanged.

## Data rules and limits

This is an expanding list of directly monitored employer feeds, **not a complete index of every U.S. job**. Employers outside these feeds and salaries that cannot be verified are absent. All feeds and their statuses are visible under Sources & coverage.

Only relevant engineering job titles with explicit mechanical / mechanisms / mechatronics / electromechanical wording qualify. Internships, technicians, hourly pay, undisclosed pay, non-USD structured compensation, and any published salary band whose lower bound is below $100,000 are excluded. Multiple published levels are combined conservatively using the lowest minimum and highest maximum. Salaries are employer ranges, not guarantees; separate locations or levels may have different applicable compensation. Always consult the original listing.

Work arrangement is read from employer fields or explicit language. It is **Not specified** when unclear; a city address alone does not prove on-site work. No recruiter email addresses are invented. Each card links to the employer's application form and full description.

Greenhouse first-published, Ashby published/republished, SmartRecruiters released, or Lever first-listed dates drive age; the UI labels which date a provider supplies. Feed retrieval and update timestamps do not make an old opening appear new. Employer re-posts can reset dates.

Locations use a bundled GeoNames U.S. city dataset and are approximate. Multiple listed locations are supported. U.S. jobs lacking reliable city coordinates remain in the list without a pin. No applicant location is collected.

A successful feed replaces that employer's previous openings, removing closed jobs. If one feed fails, its previous jobs remain visibly marked stale for at most 24 hours. If all feeds fail, publication stops and the previous live snapshot remains, with its timestamp intact. Data parsing tests cover pay thresholds, currencies, work settings, dates, locations, and closure/outage behavior.

## Sources and attribution

- [Greenhouse Job Board API](https://docs.greenhouse.io/job-board.html)
- [Ashby public Job Postings API](https://developers.ashbyhq.com/docs/public-job-posting-api)
- [Lever Postings API](https://github.com/lever/postings-api)
- [SmartRecruiters Posting API](https://developers.smartrecruiters.com/docs/posting-api) — public U.S. postings with pagination and per-posting details.
- [GeoNames cities1000](https://download.geonames.org/export/dump/) — CC BY 4.0; compact U.S. subset included. Rows contain name, state, latitude, longitude, population.
- [OpenStreetMap](https://www.openstreetmap.org/copyright) map data and standard tiles; normal interactive use only, no bulk prefetching.
- [Leaflet](https://leafletjs.com) 1.9.4, BSD-2-Clause; license in `vendor/LEAFLET-LICENSE`.

Job facts and application links belong to their respective employers. The application makes no hiring decisions and accepts no applications itself.

## Sharing

Share https://never-nude.github.io/jobmap/. Open Graph and Twitter metadata use **Jobs for Dave**, with a 1200 × 630 JPEG card. Messaging services choose how to display and cache previews. The card’s map uses us-atlas state boundaries (ISC license in `vendor/US-ATLAS-LICENSE`); it is an illustrative snapshot and the website has the current listings.
