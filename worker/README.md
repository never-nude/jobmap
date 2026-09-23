# Private drafting backend

A small Cloudflare Worker for Jobs for Dave. The public map stays on GitHub Pages. This API checks a private access code, looks up the chosen job in the live map, fetches its current employer description, and asks Workers AI for an editable cover letter. It never applies to a job or sends a message.

## Deploy

Use Node 22 or later and a Cloudflare account with Workers AI enabled. The checked-in SQLite Durable Object configuration supports the Workers Free plan; no paid upgrade is required. Stay on that plan if you want Cloudflare to stop requests when its free allowance is exhausted. Other applications on the account share its allowances.

From this `worker/` directory:

```sh
npm ci
npm test
npm run check
npx wrangler login
npm run deploy
npx wrangler secret put ACCESS_CODE
```

The final command prompts for the secret without putting it in source. Use a unique password-manager-generated code of at least 32 random characters (maximum 256). Keep it private and share it directly with Dave. Never put it in GitHub, a URL, browser localStorage, a screenshot, or the public frontend configuration. Redeploying is not needed after `secret put`; Wrangler updates the deployed secret. The API refuses to draft before this is configured.

Set the root `backend-config.js` exported `API_BASE_URL` to the deployed HTTPS Worker origin, with no trailing slash. For example, use the `workers.dev` origin that Wrangler reports, not a guessed URL. Check `<origin>/health`; it should return `{"status":"ok","ready":true}`. This checks configuration, not a paid inference. A real draft can still fail if the model is unavailable or the account quota is exhausted. Commit and publish the public API URL with the frontend. Do not add the access code there.

To rotate access, run `npx wrangler secret put ACCESS_CODE` again and provide the replacement privately. The global daily draft allowance survives rotation. To immediately disable drafting, delete the secret with `npx wrangler secret delete ACCESS_CODE`.

Production browser access is restricted to the exact origin `https://never-nude.github.io`. For local frontend development only, set `LOCAL_DEV_ORIGIN` to one exact loopback origin such as `http://127.0.0.1:4173`. The optional variable rejects non-loopback hosts and does not allow wildcards. Copy `.dev.vars.example` to the ignored `.dev.vars` and fill it locally if needed. Workers AI uses Cloudflare inference even during Wrangler development: use the mock tests for free offline verification rather than trying drafts with personal data during development.

## API contract

`GET /health` is public and returns `{"status":"ok","ready":true|false}`. It exposes no secrets and checks that the access code, AI and usage guard bindings exist.

`POST /api/draft` requires:

- `Origin: https://never-nude.github.io` (or the configured exact local development origin).
- `Authorization: Bearer <private access code>`.
- `Content-Type: application/json`.

Request:

```json
{
  "profileText": "The applicant's own CV or career background as plain text.",
  "job": {
    "id": "lever:employer:posting-id",
    "title": "Optional client display title",
    "company": "Optional client display company",
    "url": "https://jobs.lever.co/employer/posting-id"
  },
  "notes": "Optional preferences about tone or emphasis."
}
```

Success is `{"draft":"Plain text letter to review and edit"}`. Failures are `{"error":"Safe, user-facing explanation"}` with the appropriate HTTP status. The frontend should render draft and error text as text, never HTML, and keep the code only in memory or sessionStorage. A `429` response includes `Retry-After`. CORS permits only POST with Authorization and Content-Type; the browser performs OPTIONS preflight first.

Only `job.id` selects a position. Optional client title, company and description fields are bounded but ignored for AI grounding. The Worker fetches the fixed public map URL, requires the ID to exist there, then constructs a URL on Greenhouse, Lever, Ashby or SmartRecruiters' official API. It never fetches a user-provided URL. Optional application URLs must use HTTPS and one of the supported ATS or existing employer career hosts. LinkedIn links can appear in profile text, but are never visited or scraped.

Missing/closed jobs, expired employer application deadlines and private/inactive SmartRecruiters postings are rejected. Upstream failures do not fall back to a fabricated description. The current description is converted to text and bounded to 12,000 characters before generation. The prompt treats profile, notes and employer content as untrusted data. Applicant qualifications must come only from the profile, with an explicit negative example preventing job requirements such as ASME/API standards from becoming claimed experience. Signatures use only a name explicitly labeled `Name:`, `Full Name:` or `Applicant Name:` in the profile; otherwise they use `[Your name]`.

Before returning the letter, a separate model call checks applicant claims against the profile. It does not receive employer requirements or user notes as qualification evidence. Only an unambiguous approval allows the letter through; unsupported or uncertain drafts are withheld with HTTP 422. A deterministic check additionally rejects selected engineering-standard identifiers absent from the profile, including the ASME/BPVC/B31/API error observed in testing. These are safeguards, not proof of factual accuracy: the model checker can also make mistakes. Dave must review and edit every letter before using it.

## Limits and privacy

- Request body: 32 KiB, including streamed bodies regardless of Content-Length.
- Public employer response: 16 MiB, with streamed decoding to avoid duplicating a full byte buffer. Ashby's public API supplies a whole board; larger boards fail safely with an error instead of using unbounded Worker memory.
- Profile: 40–16,000 characters. Notes: up to 2,000. Combined model input: 30,000 UTF-8 bytes. Long non-English text may hit the byte limit before the character limit.
- Draft: at most 900 generated tokens and 5,000 returned characters, plus one separate grounding check limited to 200 generated tokens. Thinking and tools are disabled; no autonomous browsing or submission. Truncated, tool-call and malformed completions are rejected.
- Usage: up to 5 authenticated attempts per rolling minute and 20 per UTC day. One SQLite Durable Object enforces the daily cap across locations and secret rotation. Validated attempts reserve capacity before employer fetches/AI, so failed drafts may count too. A missing or failing usage guard blocks all drafting.
- The backend does not store CVs, notes, prompts, letters or access codes in its database and does not log them. Responses use `Cache-Control: no-store`. Wrangler observability is disabled; do not add body logging or an AI Gateway that records prompts.
- The only stored data is one replaceable usage record: UTC date, count, SHA-256 token hash and up to five timestamps. The code itself remains a Cloudflare Worker secret. Personal text is processed transiently by the Worker and Workers AI, under [Cloudflare's data policy](https://developers.cloudflare.com/workers-ai/platform/data-usage/).

The pinned model is [`@cf/google/gemma-4-26b-a4b-it`](https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/), a documented Cloudflare-hosted model used with `chat_template_kwargs.enable_thinking: false`. Its documented input/output rates are $0.10/$0.30 per million tokens; both generation and checking consume the shared Workers AI allowance. The Free plan includes a daily allowance; consult [current pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/). The app's caps bound its own draft volume and are not a billing cap for an account already on a paid plan.

## Verification

`npm test` uses Node's test runner with mocked network and AI. It covers authentication, origin checks, input/output limits, fixed ATS fetches, closures, prompt boundaries, safe errors and concurrent/daily usage limits. It makes no remote AI request. `npm run check` bundles via the exact locked Wrangler version and validates the deployment bindings without deploying. SQLite Durable Object support on Free is documented in [Cloudflare's pricing guide](https://developers.cloudflare.com/durable-objects/platform/pricing/).

Do not commit `node_modules`, `.wrangler`, `.dev.vars` or environment files. The local ignore file excludes them. Deployments require the account owner's Cloudflare authorization; a successful dry run alone does not make this API live.
