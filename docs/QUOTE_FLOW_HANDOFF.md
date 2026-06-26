# Custom Quote Flow — Handoff (for Task 7: verify end-to-end)

Status: **built, unpushed, unverified-in-runtime** (2026-06-26). This is the
request → quote → confirm flow across all four repos. Companion to
`PRICING_AND_QUOTE_PLAN.md` (the design) — this doc is the *operational* handoff:
branches, migrations, env, run steps, verify checklist, and what's deferred.

---

## 1. Branches (all local, nothing pushed or merged)

| Repo | Branch | Where |
|---|---|---|
| `spattoo-api` | `worktree-custom-quote-flow` | worktree at `.claude/worktrees/custom-quote-flow` |
| `spattoo-core` | `worktree-custom-quote-flow` | worktree at `.claude/worktrees/custom-quote-flow` |
| `spattoo-web` | `custom-quote-flow` | the **main checkout** (branch, not a worktree) |

`spattoo-core` `main` also has doc-only commits (this file + `PRICING_AND_QUOTE_PLAN.md` updates).

The `spattoo-web` `main` got a WIP-snapshot commit first (`chore(web): linkedin cover tools…`),
then the monorepo restructure + features on `custom-quote-flow`.

---

## 2. Supabase migrations (run in the SQL editor, from `spattoo-api/supabase/`)

| File | Task | Status |
|---|---|---|
| `customer_auth_link.sql` | 1 | ✅ run |
| `order_statuses.sql` | 2 | ✅ run |
| `order_design_versions.sql` | 3 | ✅ run |
| `notification_design_updated.sql` | 3 | ✅ run |
| `notification_quote_issued.sql` | 9 | ⏳ **run this** |
| `notification_quote_accepted.sql` | 6 | ⏳ **run this** |

The two pending ones only gate *emails* (quote issued / accepted); the endpoints work without them.
No capability migration was needed — the RBAC seed already grants the `customer` role
`design:create` + `order:place`.

---

## 3. Env

**`spattoo-web/apps/app/.env.local`** (create it — not committed):
```
NEXT_PUBLIC_API_URL=<spattoo-api base, e.g. http://localhost:4000 or the Render URL>
NEXT_PUBLIC_SUPABASE_URL=<your Supabase project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your Supabase anon key>
```
**`spattoo-api`** — its usual env (Supabase URL/service key, SMTP, R2, etc.). Run the API on the
`worktree-custom-quote-flow` branch so the new routes exist.

---

## 4. Run locally

```sh
# API (on its branch, with its env)
cd spattoo-api/.claude/worktrees/custom-quote-flow && npm run dev    # or your usual start

# Web app surface (monorepo)
cd spattoo-web && npm install        # vendored @spattoo/designer tarball is committed
npm run dev:app                      # apps/app (storefront + designer)
# marketing, if needed: npm run dev:marketing
```

URLs in dev (subdomain middleware only fires on `*.spattoo.com` / `*.localhost`):
- **Baker app** (sign in → order management + Send quote): `http://localhost:3000` (the app-surface root)
- **Customer storefront**: `http://localhost:3000/<baker-slug>` (or `http://<baker-slug>.localhost:3000`)
  - designer at `…/<slug>/design`, quotes view at `…/<slug>/orders`

The baker logs in with their Supabase email/password (the account created at onboarding).

> **`@spattoo/designer` link:** vendored tarball (`spattoo-web/vendor/spattoo-designer-*.tgz`).
> If you change `spattoo-core`, re-pack: `cd <core> && npm run build && npm pack --pack-destination=<spattoo-web>/vendor`, bump the filename in `apps/app/package.json`, `npm install`. See `apps/app/LINKING.md`.

---

## 5. End-to-end verify checklist

Prereqs: a baker with a **published storefront** + slug, and a **customer invite** for that baker
(create via the baker/admin tooling → gives the `?invite=<id>` link).

1. **Login** — open `…/<slug>?invite=<id>` → OTP → session set (persists on this origin).
2. **Design + request** — `…/<slug>/design`, place a few decorations, **Request quote**.
   - Verify an order row appears with status `requested`, `customer_id` resolved **from the token**
     (the request payload carries no customer identity), and a `order_design_versions` v1.
3. **Baker quote** — open the **baker app** (`localhost:3000`), sign in, open the request in the
   order-details screen → enter a price → **Send quote**.
   - status → `quoted`, `quoted_version_id == current_version_id`, customer emailed.
4. **Customer accept** — `…/<slug>/orders` → "Quote ready" + price → **Accept** → `confirmed`,
   `final_price` set, baker emailed.
5. **Stale-quote path** — after a quote, edit the design → quote shows **stale**; customer Accept is
   blocked; baker **"Price holds"** re-pins (status back to a fresh quote, same price).
6. **Lock-after-confirm** — once `confirmed`, a design edit returns 409; delivery logistics
   (date/address) still editable by the baker.

---

## 6. Runtime risks to watch (couldn't be caught at build time)

- **React/three peer versions** — core's build vs `apps/app` (React 19, three 0.184). A mismatch may
  only surface when the designer actually renders.
- **CORS** — `spattoo-api` must allow the storefront origin (`*.spattoo.com` / `localhost:3000`).
- **`resolveCustomer` picks the most-recent valid invite** — if a customer holds invites from multiple
  bakers, the designer's catalog could resolve the wrong baker. Fine for single-invite v1; tighten later.
- **`sign-upload` for a customer token** — thumbnail upload; **non-fatal** (the order still submits).

---

## 7. Known gaps / deferred (NOT done — roadmap)

- **Baker app surface (`app.spattoo.com`)** — ✅ **built (Task 11):** `apps/app` root mounts core
  `OrdersPanel` behind a Supabase login, with a baker apiClient (incl. `issueQuote`). Bakers review +
  Send quote from the order-details screen. Remaining: **in-app 3D design edit is a no-op** there
  (`onEditDesign` alerts "coming soon") — the baker can't yet open/refine the cake in 3D from the order
  screen; status/details/quote all work.
- **Customer re-open/refine after submit** — the design-edit route is baker-authed; a customer
  refining a submitted design needs a customer design-edit endpoint (+ host wiring).
- **Counter-offers** — Task 6 shipped accept + decline only; the negotiation/counter loop (§1a) is its
  own task.
- **Suggested-price algorithm + itemized pricing (§2)** — quoting is manual entry (Phase 0).
- **Core publish strategy** — replace the vendored tarball with a published `@spattoo/designer`.
- **Deploy** — two Vercel projects (`apps/marketing`, `apps/app`) + wildcard DNS `*.spattoo.com`.
- **`middleware.ts` → `proxy.ts`** — Next 16 deprecation warning on `apps/app/middleware.ts`.

---

## 8. Commits (by repo/branch)

- **spattoo-api** `worktree-custom-quote-flow`: auth'd customer order route; order_statuses table +
  quote columns; design versioning + stale + design-lock guard + baker-edit email; quote-issue
  endpoint; customer quote view + accept/decline.
- **spattoo-core** `worktree-custom-quote-flow`: OrderModal mode split; OrdersPanel on new lifecycle;
  baker QuotePanel. (`main`: plan doc + this handoff.)
- **spattoo-web** `custom-quote-flow`: monorepo restructure; customer storefront + designer mount +
  customer apiClient; "your quotes" view.
