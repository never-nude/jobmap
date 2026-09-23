# Jobs for Dave · Jobmap

A public, permanently dark U.S. map of mechanical engineering and related physical engineering openings posted within the past 30 days with employer-published base salary minima of **$100,000/year or more**. No API keys or paid services are required.

- Position, company, salary, location, work setting, skills / experience, and direct employer application links.
- Age colors: **green: past 7 days → yellow: 8–14 days → red: 15–30 days**. Older, undated, and future-dated postings are excluded. Colored pins represent individual jobs. City circles use proportional pie slices for each age band, with the total job count in the center. Hover or open one for exact age counts and its newest jobs first. Slices use the currently filtered jobs, using only verified postings within 30 days. A steady pale-green halo highlights locations with at least one job posted within the last seven days; the city detail gives the exact recent count. The halo uses the employer posting date, not first discovery/import time.
- Search, work-setting, minimum base pay ($100k/$150k/$200k/$250k), and **Energy & related only** filters; **Newest listed** by default; mobile layout.
- GitHub Actions checks employer feeds every half hour, at :07 and :37 UTC. Scheduling is best effort and can be delayed by GitHub. The browser fetches the newest snapshot every 30 minutes and on return to the tab.

## Run locally

Requires Node 22+ and Python 3. No npm dependencies.

```sh
node scripts/refresh.mjs
node --test scripts/*.test.mjs
python3 -m http.server 4173
```

Open http://localhost:4173. Source configuration is in `data/sources.json`.

## Map view

The map opens with the contiguous 48 states in view, including on narrow phone screens. **U.S. overview** restores that view. State outlines are bundled with the website so the background does not depend on a separate tile server. Alaska and Hawaii remain available by panning or selecting their jobs. Resizing refits the overview but preserves a manually chosen view. At closer zoom levels, overlapping city circles spread apart locally, with thin lines pointing back to their mapped locations. The layout adapts to the current zoom and viewport; circles with enough space stay in place. Pie slices, counts, recent-posting halos, and job selection are preserved.

To regenerate the outlines, download the unprojected `states-10m.json` from [us-atlas 3](https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json), then run `node scripts/build-states.mjs path/to/states-10m.json`. The converter validates all 50 states plus D.C., closed rings, and Alaska’s date-line continuity.

## Publishing

The workflow `.github/workflows/refresh.yml` fetches jobs, checks normalization rules, commits the snapshot, then deploys the static website to GitHub Pages. Published styles and first-party module imports receive a shared commit version so updates request fresh assets instead of reusing previously cached URLs. Set **Settings → Pages → Source → GitHub Actions** once. Manual refresh is available through **Actions → Refresh jobs and deploy map → Run workflow**. It also runs when source changes are pushed to main.

The workflow uses the repository's automatic `GITHUB_TOKEN`; no personal token is needed. Source commits made by the workflow do not recursively trigger another workflow. Scheduled data commits also keep the repository active, though GitHub can still disable schedules or Actions because of account policies. The UI flags snapshots older than 75 minutes.

## Application profile and Cloudflare drafts

**My application profile** opens a private profile editor. CV text is kept on the device unless the user explicitly generates a cover letter; remembering a profile is optional. LinkedIn information can be pasted into the editable profile. The Cloudflare API verifies the selected active job, reads its original employer description, and drafts a letter based on supplied experience. The user edits and downloads/copies the letter, then applies through the employer’s site. It never submits applications.

Cloudflare Worker code and deployment instructions are in `worker/`. After deployment and access-code setup, set the public Worker origin in `backend-config.js`; never commit credentials or CVs. Until that origin is configured, drafting remains disabled with a setup notice. The map and local profile still work.

## Recent additions

A compact **Added this week** sidebar lists the six most recently discovered active jobs, with a link to filter all additions from the past seven days. On smaller screens it becomes a collapsed panel below the map and results. This is the date first seen on this map, separate from the employer posting date used by pin colors. `firstSeenAt` persists through updates, outages, and removal/reappearance using the snapshot’s `firstSeenById` history. Existing listings are seeded from their prior snapshot timestamp when tracking is introduced.

## Optional energy filter

All qualifying mechanical engineering openings are visible by default, sorted by newest posting date. There are no energy-priority rankings or badges. **Energy & related only** optionally narrows the list and map together.

The filter matches verified energy-employer sectors or explicit energy terms in the job title. Generic terms such as “power” or “thermal” alone do not qualify. Employer evidence and matching rules live in `energy.mjs`. These are sector signals, not qualification or personal-fit scores.

## Data rules and limits

This is an expanding list of directly monitored employer feeds, **not a complete index of every U.S. job**. Employers outside these feeds and salaries that cannot be verified are absent. All feeds and their statuses are visible under Sources & coverage.

Mechanical, mechanisms, mechatronics, electromechanical, and optomechanical engineering titles qualify. Related physical engineering roles (including thermal, structures, fluids, manufacturing, reliability, and hardware design) also qualify when the employer explicitly calls for mechanical engineering education, experience, or ownership. Core disciplines such as thermal and fluids also qualify when the description demonstrates physical engineering work, even if the degree requirement is general engineering. Software and unrelated engineering titles are excluded. Internships, technicians, hourly pay, undisclosed pay, non-USD structured compensation, and any published salary band whose lower bound is below $100,000 are excluded. Multiple published levels are combined conservatively using the lowest minimum and highest maximum. Salaries are employer ranges, not guarantees; separate locations or levels may have different applicable compensation. Always consult the original listing.

Work arrangement is read from employer fields or explicit language. It is **Not specified** when unclear; a city address alone does not prove on-site work. No recruiter email addresses are invented. Each card links to the employer's application form and full description.

Greenhouse first-published, Ashby published/republished, SmartRecruiters released, Lever first-listed, Workday start-of-posting, and direct employer posting dates drive age; the UI labels which date a provider supplies. Feed retrieval and update timestamps do not make an old opening appear new. Employer re-posts can reset dates. Apple location variants with the same position ID are merged into one job; the map combines their verified U.S. locations and salary ranges conservatively and retains the earliest posting date.

Locations use a bundled GeoNames U.S. city dataset and are approximate. Multiple listed locations are supported. U.S. jobs lacking reliable city coordinates remain in the list without a pin. No applicant location is collected.

The 30-day cutoff is enforced both when publishing the snapshot (including failed-feed fallbacks) and in the browser, so cached jobs age out even if a later refresh fails.

A successful feed replaces that employer's previous openings, removing closed jobs. If one feed fails, its previous jobs remain visibly marked stale for at most 24 hours. If all feeds fail, publication stops and the previous live snapshot remains, with its timestamp intact. Data parsing tests cover pay thresholds, currencies, work settings, dates, locations, and closure/outage behavior.

## Sources and attribution

- [Greenhouse Job Board API](https://docs.greenhouse.io/job-board.html)
- [Ashby public Job Postings API](https://developers.ashbyhq.com/docs/public-job-posting-api)
- [Lever Postings API](https://github.com/lever/postings-api)
- [SmartRecruiters Posting API](https://developers.smartrecruiters.com/docs/posting-api) — public U.S. postings with pagination and per-posting details.
- [GeoNames cities1000](https://download.geonames.org/export/dump/) — CC BY 4.0; compact U.S. subset included. Rows contain name, state, latitude, longitude, population.
- [U.S. Census boundaries via us-atlas](https://github.com/topojson/us-atlas) — bundled vector state outlines, ISC license in `vendor/US-ATLAS-LICENSE`. No external map tiles or tile API keys.
- [Leaflet](https://leafletjs.com) 1.9.4, BSD-2-Clause; license in `vendor/LEAFLET-LICENSE`.

Job facts and application links belong to their respective employers. The application makes no hiring decisions and accepts no applications itself.

## Sharing

Share https://never-nude.github.io/jobmap/. Open Graph and Twitter metadata use **Jobs for Dave**, with a 1200 × 630 JPEG card. Messaging services choose how to display and cache previews. The card’s map uses us-atlas state boundaries (ISC license in `vendor/US-ATLAS-LICENSE`); it is an illustrative snapshot and the website has the current listings.
