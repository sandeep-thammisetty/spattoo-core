# spattoo — Pricing, Quote & Payments Plan

> Status: **planned / discussion** (drafted 2026-06-26; updated 2026-06-26 with the
> collaborative-design model + v1 entry/auth build). Living doc. Companion to
> `CORE_ARCHITECTURE_PLAN.md`.
>
> ⚠️ **The "Payments & settlement (India)" section is NOT legal, tax, or compliance advice.** It maps
> the landscape so we can make decisions, but Indian GST + RBI payment rules are intricate and change
> often (and this is written from general knowledge with a training cutoff). **Confirm every payments/GST
> point with a practising CA and the chosen payment-aggregator partner before collecting any money.**

---

## 1. The order model: request → review → quote → confirm

A custom cake is quote-based, not fixed-cart. The flow:

1. A design comes into being — **either** the customer designs it themselves, **or** the baker plants a
   base design and hands it over (see §1e). Customer **places a request** when happy.
2. Baker **reviews**: confirms makeability and sets a price → issues a **quote**.
3. Quote goes to the customer; customer **accepts / counters / rejects**.
4. On acceptance the order is **confirmed**.

**The key design decision — the price algorithm is baker-internal.** Spattoo can compute a suggested
price, but the **customer never sees a Spattoo estimate — only the baker's issued quote.** This
eliminates the "wrong estimate hurts the baker" risk and reframes the algorithm as a **baker
productivity tool** (a 10-second pre-filled starting point they override), not a customer-facing
pricing promise. A bad suggestion costs the baker a few seconds, never a lost order or a public wrong
number.

### 1a. The flow is a negotiation loop, not a line
Home bakers price by affordability *through conversation*, so the state machine must branch:
- **Baker review** resolves three ways: **quote**, **request a design change** ("can't do 3 tiers by
  Saturday — drop to 2?"), or **decline**.
- **Customer response to a quote**: accept, reject, or **counter** ("can you do ₹X?") → baker re-quotes
  → repeat. The quote is a **short revisable thread**, not a single immutable field.
- **Expiry**: tie quote validity to the delivery date (auto-expire a few days before).
- **Cancel** at any stage.

### 1b. Quotes are pinned to a design version
- A quote prices *this* design + weight + date (`orders.quoted_version_id`). When the design advances
  past that version the quote goes **stale** and the customer can't accept it — the baker re-affirms
  (re-pin, price holds) or re-quotes. See §1e/§1f for the full rule and why price-neutral edits don't
  force a fresh number in v1.
- Either side can edit pre-confirm (shared pen, §1e); a **baker** edit emails the customer. Once
  `confirmed` the design is locked (§1f) — nobody ends up with a different cake (or price) than they
  agreed to. The order audit log tracks every change.

### 1c. The quote is a transparent itemized artifact
Show line items — base (weight × flavour), decorations, delivery, packaging — not just a total. Reduces
sticker shock, makes negotiation concrete, becomes the confirmation/invoice, and yields the calibration
data (suggested vs quoted vs final-agreed).

### 1d. The baker review screen (where the algorithm earns its keep)
Design + **suggested price (override-able)** + itemized decoration breakdown + **makeability flags**
(too many tiers for the date, a decoration the baker hasn't enabled, structural concerns). This is the
same enumeration the X-Ray order-help feature does — one shared engine.

- **Implemented (Task 9 — manual price, no suggestion yet):** `POST /api/orders/:id/quote` captures the
  price (+ optional line items / valid-until), **pins it to the current design version**, flips status →
  `quoted`, audits, and emails the customer (`quote_issued_customer`). The baker UI is a **Quote panel**
  in `OrdersPanel` (quote phase only): price entry → **Send/Update quote**, current quote + stale badge,
  and a **"Price holds"** action that re-pins a stale quote without changing the number. Host baker app
  must implement `apiClient.issueQuote(orderId, { price })`. The **suggested-price algorithm + itemized
  breakdown (§2) is still deferred** — this is manual entry (Phase 0).

### 1e. Collaborative design — one evolving design, a shared pen
The design is not owned by one side and the flow is not one-directional. A design is a **single shared
artifact** that either party can originate and both can refine. This is where Spattoo beats the
WhatsApp status quo.

- **Why not "baker sends a few options to choose from"?** That's a workaround for a *static* medium
  (dead-end images you can't change). In Spattoo a design is *live*, so "send 5 options" collapses into
  "send 1 base, then refine." **Refinement replaces multiplicity** — there is **no candidate shortlist,
  no "pick one" step**. One design per order, with a version history.
- **Either side plants the seed.** Customer designs from scratch, **or** — for the (common) customer who
  freezes at a blank cake or "sees cake as just edible, not presentation" — the **baker plants a base
  design and hands it over**: *"here's a starting point, make it yours."* Same object, different
  originator.
- **The customer holds the pen and refines it themselves — on purpose.** "More pink, a taller top tier,
  another rosette" is done *by the customer*, because that joyful self-design moment **is the product we
  sell**. We do **not** restrict editing to the baker.
- **Why customer-edits is safe here (and wouldn't be on WhatsApp):** the designer is **config-driven** —
  the customer can only place baker-enabled elements in placement-config-allowed zones. The toolset
  *is* the guardrail; a customer literally cannot design something un-bakeable. Feasibility is bounded
  by the baker's catalog, not by trust.
- **Turn-based handoff, not live co-editing (v1).** The pen is held by one party at a time and handed
  off explicitly (send / submit). No real-time simultaneous editing in v1 — avoids conflict and keeps
  it simple. (A **screen-share "design together" mode**, where the baker can guide the customer live
  while one holds the pen, is a **separate future feature** — a strong communication moment, tracked
  outside this plan.)
- **Versions are append-only; quotes pin to a version (ties into §1b).** Each refinement is a new
  version, history preserved (audit/soft-delete friendly). A quote is bound to the version it priced.
  When the design advances past that version the quote is **stale** (`quoted_version_id != current_version_id`)
  and the customer **cannot accept it** — but a stale quote isn't auto-voided: the baker decides in one
  tap, **"price holds"** (re-pin to the current version, *no new number* — the price-neutral case) or
  **"update price"** (new quote). Fully-automatic skip of price-neutral edits needs Phase-1 auto-pricing
  to diff the price; until then the baker is the judge (the algorithm is baker-internal anyway). The
  baker-only action in the whole loop is **pricing** (→ "Send quote"); everyone *designs* in the one
  designer.

### 1f. Edit & lock rules (v1, locked 2026-06-26)
Both sides share the pen *before* confirmation; after confirmation the **design** is locked (the
cake/price the customer accepted), but **delivery logistics stay editable**.

| State | Customer edit | Baker edit | Effect |
|---|---|---|---|
| `initiated` / `requested` | yes | yes | versioned; a **baker** edit emails the customer ("design recommendations") |
| `quoted` | yes | yes | versioned; quote flagged **stale** → baker taps *price holds* (re-pin) or *update price* |
| `confirmed` and later | no | no (design) | **design locked** → cancel + recreate to change the cake |

- **Lock is field-scoped, not blanket.** After `confirmed`: the design route and the price-bearing
  fields (`weight_kg`, `flavours`) reject edits; **logistics** (`delivery_date/time/mode/address`) stay
  open to the baker — changing where/when it's delivered doesn't touch the cake or the agreed price, so
  no cancel-and-recreate for that.
- Enforced server-side: design edits + price fields require the order to be in the **quote phase**
  (`order_statuses.phase = 'quote'`); otherwise `409`.

---

## 2. Pricing model — we own the *structure*, the baker owns the *rates*

- **Base (exact):** `weightKg × per-flavour-per-kg`, baker-configured. No estimation risk.
- **Decorations (fuzzy):** the design snapshot lists every placed element, so we **enumerate and
  itemize**; each element type carries a price contribution — **admin seeds defaults, baker overrides**
  (seed-in-code + DB overlay). Math/counting is ours; rates are theirs. Optional complexity factors
  (tier count, total decoration count).
- **Delivery + packaging:** baker config (flat / distance / per-tier).
- **Minimum order value:** baker-set floor; protects the too-low case.
- Because it's the baker's own rates and the quote is baker-confirmed, an over/under suggestion is never
  binding and never customer-facing.

### Phasing
- **Phase 0 — price only what's exact.** Baker configures per-flavour/kg + delivery + packaging.
  Decorations shown to the baker as an itemized **list without prices**; baker fills the decoration
  price at review. Immediate value, zero estimation risk; builds the config UI, schema, and the
  baker-confirms-final flow.
- **Phase 1 — baker-tunable decoration suggestion (internal).** Per-element default prices + baker
  overrides; algorithm suggests a decoration subtotal **on the baker's review screen only**.
- **Phase 2 — calibration loop.** Store suggested vs quoted vs final-agreed per order; surface variance
  back to the baker ("your foil orders close ~15% above suggestion — raise the rate?"); optionally
  auto-tune. The long-term moat; only possible because Phase 1 captured the data.

---

## 3. Schema / API deltas (most order *management* already exists)
- **Status is a managed lookup TABLE, not free text** (decided 2026-06-26, shipped in the api worktree).
  `orders.status` was a free-text column policed only by a JS array (`VALID_STATUSES`). It is now an
  `order_statuses` lookup table (`supabase/order_statuses.sql`) carrying display metadata
  (`label, phase, sort_order, is_terminal, customer_visible, tone`), with `orders.status` kept as TEXT
  but FK-constrained to `order_statuses(key)`. Rationale: a real table + referential integrity + the
  metadata the UI needs, while keeping readable values so existing text queries / `status === 'x'`
  checks keep working and we avoid magic-number ids. (`subscription_plans` set the lookup-table
  precedent; we use a text natural key here rather than an int id because status is read/filtered as
  text everywhere — int ids would force churny rewrites for no gain.) Served to the UIs via
  `GET /api/order-statuses` so core stops hardcoding the lifecycle.
  - Merged lifecycle (quote phase + existing fulfillment phase, one timeline):
    `initiated → requested → quoted → confirmed → in_production → ready → completed`, with `declined` /
    `cancelled` / `expired` as terminal off-ramps.
    - `initiated` — a design thread exists (baker-seeded base, or customer mid-design) but no quote
      requested yet; the entry point for the collaborative-design model (§1e).
    - `requested` supersedes old `pending`; `confirmed` supersedes old `approved`; `in_production` /
      `completed` supersede old `in_progress` / `delivered` (existing rows backfilled).
    - `approved_at` stamps on `confirmed`; `priced_at` stamps on `quoted`.
    (`PATCH /orders/:id/status` + audit already exist; validation now reads the table.) The richer
    negotiation sub-states (under_review / changes_requested / negotiating) can be added later as rows
    without a migration.
- **Quote fields on the order**: `suggested_price` (algo, internal-only), `quoted_price` + `line_items`,
  `quote_valid_until`, `final_price`, `priced_at`.
- **Pricing config (DB, via API; never localStorage)**: `baker_flavour_prices` (per-kg),
  `baker_pricing_settings` (delivery, packaging, min order, display mode), element default price on the
  library + `baker_element_prices` overlay.
- **Net-new customer surface**: a **"your quote" view** in the storefront — does NOT exist today (the
  storefront has no order-status/quote screen). Main new customer-facing build.
- **Notifications**: request → baker, quote → customer, accept → baker. Set a visible "typical response
  time" to manage the human-in-the-loop latency.

### 3a. Order entry + the auth blocker (v1, build first)
Traced from current code (`OrderModal.jsx`, `CakeDesigner.jsx:3041-3096`, `spattoo-api orders.js`):

- **AUTH BLOCKER — fix first.** Today `POST /api/orders` is **public and trusts customer name/phone
  from the form payload** (no auth). The storefront already logs the customer in via OTP and holds a
  Supabase session, but **nothing uses it for ordering**. Required: an **authenticated customer order
  route** (or auth on the same route) that derives `customer_id` **from `req.user` (the token), never
  from the client payload**. Without this, "skip the customer search" is a security hole — a logged-in
  customer could submit as anyone. This is the prerequisite for the whole customer flow.
- **`OrderModal` is context-driven, not two modals (IMPLEMENTED — Task 4, core worktree).** A single
  `mode` prop drives the customer-search step's presence, the header text, the footer label, and the
  submit payload. *Context is an input, not a screen.* The hardcoded `0/1/2` steps were replaced with a
  mode-derived `STEP_DEFS` array, and `CakeDesigner` gained an `orderMode` prop (default `'baker'`,
  forwarded to `OrderModal` + routes `handleOrderSubmit`).
  - `mode='customer'` (storefront): **skips the customer-search step** (customer = session), footer =
    **"Request quote"**, payload carries **no** customer identity → `apiClient.requestQuote({…, bakerSlug})`
    → `POST /api/customer/orders` (server derives the customer from the token). Header "Request a Quote",
    success "Quote Requested!".
  - `mode='baker'` (`CakeDesigner`): keeps customer search, footer = **"Create order"** →
    `apiClient.placeOrder` (unchanged). **Baker price-entry → "Send quote" is a separate flow** (Task 9,
    §1d) that runs *after* design agreement — it needs a price step + a quote-issue endpoint, so it is
    NOT in `OrderModal`.
  - **Storefront must implement `apiClient.requestQuote(payload)`** (authenticated `POST /api/customer/orders`)
    and mount `CakeDesigner` with `orderMode="customer"` — that wiring is Task 5.
- **Persisted, re-openable design tied to the order, with versions.** `designSnapshot` JSON already
  exists; it becomes a saved, **addressable** entity the customer can re-open in their storefront
  session and refine (the designer already loads a snapshot — mostly plumbing + auth). Each refinement
  is a new version (§1e). Promoting a baker-seeded design → template/inspiration entry should be one
  step (the self-serve catalog flywheel), not a rebuild.
  - **Implemented (api worktree):** `order_design_versions` table (append-only: `order_id`,
    `version_no`, `design_snapshot`, `design_thumbnail_url`, `authored_by`); `orders.current_version_id`
    + `orders.quoted_version_id` pointers; `orders.design_snapshot` kept as a denormalized mirror so
    existing reads are untouched. Order-create seeds v1; `PATCH /orders/:id/design` appends a version
    (guarded to the quote phase) + emails the customer; `PATCH /orders/:id/status → quoted` pins the
    quote to the current version; `GET /orders/:id/versions` lists history; GET responses expose a
    derived `quote_stale`. **Designer-side (saving through the versioned endpoint, customer re-open) is
    deferred to Task 5 and gated on the `src/designer/` analysis rule.**

---

## 4. Payments & settlement (India) — landscape & decision

> ⚠️ Re-read the disclaimer at the top. Verify all of this with a CA + the PA partner.

### The core question
Should Spattoo **collect customer money and settle it to the baker**, or stay **software-only** with
payment happening **directly between customer and baker**? They have very different compliance weight.

### Model A — SaaS / lead-gen (Spattoo never touches the money) — RECOMMENDED START
Payment happens **directly customer → baker** (the baker's own UPI / payment link, or cash on
delivery). Spattoo facilitates design + quote + order and charges **bakers a subscription**.
- **Sidesteps** RBI payment-aggregator licensing, e-commerce-operator (ECO) GST collection, and TCS
  entirely — Spattoo is just software.
- **Fits home bakers with personal/savings accounts perfectly** — they receive money the way they
  already do.
- Trade-off: no transaction take-rate, weaker escrow/trust, no in-app deposit. Acceptable for v1.
- In the schema, payment is just **recorded** ("paid directly / COD / UPI ref"), not processed.

### Model B — Marketplace collect-and-settle (Spattoo collects, settles to baker)
Unlocks in-app deposits, escrow-style trust, refunds, and a transaction take-rate — but pulls in real
compliance:
- **You do NOT get your own RBI Payment Aggregator licence.** The bar is high (RBI authorisation +
  large net-worth requirements). Instead you build on an **authorised PA partner** —
  **Razorpay Route**, **Cashfree (Easy Split / marketplace)**, PhonePe, etc. — whose **split-settlement**
  product collects from the customer and settles to **linked/sub-merchant accounts**.
- **Savings-account fit (the make-or-break for home bakers):** PA partners commonly support **linked
  accounts for individuals with PAN-based KYC and a savings account** — a current account is **not
  always required**. ✅ This is promising, but **confirm current KYC norms with the specific partner**,
  as they tighten periodically.

### The Swiggy model — important correction
Swiggy/Zomato collecting and **paying GST on the restaurant's behalf** is a **specific carve-out for
notified *restaurant services* under GST Section 9(5)** (effective Jan 2022), where the ECO is deemed
the supplier for GST. **A cake/bakery supply is generally *goods*, not a 9(5) notified service** — so
that "we pay their GST" mechanism **likely does not apply to us**. Instead, an ECO that collects payment
typically falls under:
- **TCS (Section 52):** the ECO collects ~1% TCS on net taxable supplies and deposits it, filing
  **GSTR-8** — which requires **Spattoo itself to be GST-registered**. The baker remains liable for
  their *own* GST.
- ⚠️ Whether a *custom, made-to-order* cake is "goods" vs a "service" has genuine nuance — **CA call.**

### The GST-threshold trap for home bakers
- Most home bakers are **below the GST registration threshold** (~₹40L goods / ₹20L services) → **not
  GST-registered**.
- Historically, selling through an ECO **forced** GST registration regardless of turnover — a major
  adoption deterrent. **Recent relaxations (≈Oct 2023) exempt small intra-state goods suppliers below
  threshold** under conditions. **Verify whether onboarding a baker to "collect on their behalf" forces
  them into GST** — if it does, Model B becomes a hard sell to exactly our core users.

### Permissions / what we'd need for Model B
- A **registered Spattoo business entity** + **GST registration** (as the platform/ECO).
- A contract with an **authorised PA partner**; Spattoo onboarded as a platform, bakers as **linked
  sub-merchant accounts** (PAN + bank KYC; savings often OK — verify).
- **TCS collection + GSTR-8 filing** if treated as an ECO collecting consideration.
- Baker **KYC** capture (PAN, bank details, possibly Aadhaar/address).
- PCI/card-data scope is **offloaded to the PA partner** (we don't store card data).

### Recommendation (phased, low-regret)
- **P0: Model A.** Ship the full request→quote→confirm flow with payment **direct customer↔baker**
  (recorded, not processed). Zero fund-handling, zero new licensing, perfect home-baker fit. Spattoo
  monetises via the **baker subscription**.
- **P1 (later, optional): add a PA partner (Route/Easy Split)** for optional in-app **deposit/payment**,
  onboarding bakers as linked accounts (savings OK) — **only after** (a) a CA confirms the GST/TCS/ECO
  posture and the home-baker registration impact, and (b) the partner confirms savings-account KYC.
- Design the order/payment schema now so Model B can layer on without rework (a `payment_mode`:
  `direct | cod | gateway`, and nullable settlement fields).

### Open questions for the CA + PA partner (resolve before P1)
1. Does collecting on a home baker's behalf force them into GST registration (post-2023 relaxations)?
2. Is a custom made-to-order cake "goods" (TCS/Sec 52) or could any part be a 9(5) service?
3. Does the chosen PA partner settle to **individual savings accounts** with PAN-only KYC today?
4. If Spattoo is an ECO: TCS rate, GSTR-8 cadence, and our own GST-registration obligations.
5. Refunds/chargebacks/cancellation handling across the split settlement.
