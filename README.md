# doof

A personal meal-planning web app: manage a catalog of dishes (ingredients, tags,
images), build a weekly meal plan, generate a shopping list from it, and see a
"today" view of what's being cooked. Single-user, gated by a single password.

The plan's dish picker keeps a stable height while filtering and follows the
visible viewport above the mobile keyboard. Its results scroll independently;
on very short screens, the panel also scrolls to keep its controls reachable.
On new and edit dish forms, **Save dish** stays above the bottom navigation while
scrolling, with its position adjusted for the navigation's height and safe-area padding.

Saving a new or edited dish normalizes known ingredient-unit aliases to short,
recognizable forms: for example, `tablespoons` becomes `tbsp`, `teaspoon` becomes
`tsp`, `grams` becomes `g`, `ounces` becomes `oz`, and `cups` becomes `cup`.
Common British/American spellings, casing and trailing abbreviation periods are
accepted. Descriptive or unknown units are preserved (trimmed and lowercased),
and blank units stay empty. This also applies to imported ingredients when
**Save dish** is used. Existing recipes are not rewritten until saved again;
shopping lists, produce boxes and template items are not retroactively changed.

The Today view uses photo-led dinner cards with inset rounded images, bold
titles and recipe-tag pills in the existing emerald/slate palette. Swipe between
days on mobile, or use adjacent-day cards and arrows on desktop. Day labels are
centred above the cards in the same bold emerald typography as recipe titles,
without a duplicate ISO date. Each meal has its own box;
days with multiple meals use a vertical snap carousel with a peek of the next
card. Longer titles and tags remain accessible by scrolling.

The bottom tabs are **Today**, **Meals**, **Plan**, **Dishes** and **Shop**.
**Meals** (`/meals`) retains the weekly/monthly schedule, editing and templates.
**Plan** (`/plan`) browses saved dishes in a horizontal photo-card carousel.
Photos cover a positioned frame within an explicitly sized card link, avoiding
percentage-height sizing differences in Safari's flex layout.
Suggestions use past, non-skipped plan dates as a proxy for cooking history.
Dishes planned in the previous 14 days appear after eligible suggestions;
dishes scheduled for today or any future date appear last. Eligible familiar
dishes are ranked by the number of distinct planned days in the previous 90
days, with an untried recipe inserted after every three familiar recipes where
available. Older history still distinguishes tried from untried recipes.
Ties use a deterministic daily shuffle, so unchanged data gives the same order
throughout the day. Cooldown dishes are oldest-planned first. Every saved dish
remains accessible; short pools are filled from the remaining recipes.
Tag chips above the carousel filter recipes by a single tag. Tapping the
selected tag again clears the filter. Changing tags starts at the first
matching recipe and cancels any pending single-tap navigation. Filtering keeps
the recommendation order; it does not rerank or reshuffle recipes.
Tap a card to view its recipe; double-tap (double-click with a mouse) to open a
scrolling picker covering Today and the next 29 days. Single-tap navigation waits
400 ms to distinguish it from a double-tap. Keyboard users can focus a card and
press Enter to view the recipe or Space to choose a day. Scroll, tap a date, or use
the arrow keys, Home/End and Page Up/Down, then confirm **Add to ...**.
This adds dinner without replacing existing meals or freeform notes; adding the
same dish to the same day again is a no-op with an explicit confirmation.
**Dishes** remains the recipe-management tab. The carousel has no visible arrows
or count; left/right arrow keys remain available when the carousel is focused.
The Dishes search matches dish names, ingredients and tags together, ignoring
case and surrounding whitespace. Suggestions cover all three, and matching
ingredients appear beneath results. Existing tag filters still narrow the list.
Dish-detail ingredient names share one column, with space reserved for quantity
and unit even when neither is set.

## Tech stack

- **Next.js 16** (App Router, React 19, Turbopack)
- **Prisma 6** ORM over **PostgreSQL 16**
- **Tailwind v4** (`@tailwindcss/postcss`), `class-variance-authority`, `clsx`,
  `tailwind-merge`, `lucide-react`
- **Zod 4** for validation
- TypeScript 5

### Project layout

```
src/
├── app/
│   ├── (app)/            # authenticated route group
│   │   ├── dishes/       # dish CRUD (server actions in actions.ts)
│   │   ├── meals/        # weekly/monthly meal schedule
│   │   ├── plan/         # saved-dish carousel + scheduling actions/components
│   │   ├── shop/         # shopping list (generated from plan)
│   │   ├── today/        # daily cooking view
│   │   └── layout.tsx
│   ├── api/
│   │   ├── login/
│   │   └── logout/
│   ├── login/            # /login page
│   ├── layout.tsx
│   └── page.tsx
├── components/           # shared UI (bottom-nav, logout-button)
├── lib/
│   ├── auth.ts           # HMAC-signed session cookie
│   ├── prisma.ts         # Prisma client singleton
│   ├── ingredient-suggestions.ts
│   ├── tag-suggestions.ts
│   └── utils.ts
├── generated/prisma/     # generated Prisma client (gitignored)
└── proxy.ts              # Next.js middleware (auth gate)
prisma/
├── schema.prisma
└── migrations/
```

> ⚠️  In Next.js 16 the middleware file uses the `proxy` export name (not
> `middleware`). The file lives at `src/proxy.ts`.

### Authentication

Single-password access, no user accounts.

- `POST /api/login` (or the login server action) checks the submitted password
  against `APP_PASSWORD` using `timingSafeEqual`.
- On success a cookie `doof_session` is set: `<expiresMs>.<hmacSha256>`, signed
  with `COOKIE_SECRET`, valid for 30 days.
- `src/proxy.ts` runs on every non-static request; unauthenticated users are
  redirected to `/login?next=<path>`. Public paths: `/login`, `/api/login`,
  `/api/health`.

### Data model (Prisma)

- `Dish` — ingredients (`DishIngredient`), tags (`DishTag` ↔ `Tag`), image URL,
  notes, servings.
- `MealPlan` (keyed by `weekStartDate`) → `MealPlanEntry` (date + meal slot,
  optional `dishId` or `freeformText`, status `planned|cooked|skipped`).
- `ShoppingList` → `ShoppingListItem` (auto-generated from plan or manual,
  with `category`, `checked` state).
- `PlanTemplate` → `PlanTemplateEntry` + `PlanTemplateMiscItem` for reusable
  weekly plans.

### Importing ingredients from a recipe URL

On either **New dish** or **Edit dish**, paste the recipe's **Source URL** to
load its preview automatically. Typed URLs load when you leave the field or
press Enter. Paste again or press Enter to retry. Existing URLs do not fetch
just from opening an edit form. Doof reads `Recipe.recipeIngredient`
from Schema.org JSON-LD embedded in the page, including arrays, `@graph` and
nested recipes. If there are multiple recipes, choose one in the preview.

The conversion widget shows each original ingredient sentence as selectable
words. Select one or more words, then assign them to **Quantity**, **Unit** or
**Ingredient**. Fields start blank: Doof does not guess the website's format.
Attached measurements such as `200g` or `cup/57` are separately selectable,
while fractions and hyphenated ingredient names remain intact. You can edit
the fields directly. Sentences with a blank ingredient name are automatically
omitted, even if quantity or unit has been entered. Clear the ingredient name
to skip a sentence; no checkbox is needed. Quantity and unit are optional.
At least one named ingredient is required to apply an import.

**Use recipe** applies the JSON recipe title and replaces the ingredient rows.
If the JSON has no usable title, **Replace ingredients** leaves the dish name
unchanged; the preview uses "Untitled recipe" only as a display label.
URL imports leave Notes and the other dish fields unchanged. Nothing is persisted
until **Save dish**. Discarding the preview or a failed import leaves existing
fields untouched.
Changing the Source URL clears its preview and cancels any pending client request.

When the selected recipe includes an image, the preview also shows it with a
separate **Use image** button. This explicitly replaces the current form's image
without changing ingredients; applying the recipe never changes the image.
The button turns green and reads **Image selected** while that image is selected,
instead of showing a selection banner. Replacing or removing the form's image
updates the button state.
Neither is persisted until **Save dish**. Image metadata supports URL strings,
arrays and `ImageObject` values (`contentUrl` or `url`), including relative URLs
resolved against the final recipe page URL after redirects. Missing, invalid
or unloadable images do not prevent ingredient import. The original image URL
is stored, not a copy of the image; availability depends on the source website.
After saving, the shared dish-image endpoint serves uploaded data URLs directly
and redirects valid remote image URLs to their source with no referrer.

Imports require a signed-in session and a public HTTP(S) URL using the standard
port without embedded credentials. Private/reserved network addresses are
blocked, including DNS results and redirect targets. Requests have a 10-second
timeout, at most five redirects, and a 2 MB limit on both downloaded and
decompressed HTML. Up to 20 recipes with 200 ingredients each are supported.
Pages without embedded recipe JSON-LD, JavaScript-only metadata, login-protected
pages and sites that block automated requests cannot be imported.

### Importing a recipe from an AI chatbot

On **New dish** or **Edit dish**, select **Import from AI** at the top right to
reveal the formatting prompt and chatbot response above the recipe name.
The compact prompt box supports touch,
trackpad and keyboard scrolling with its scrollbar hidden. Click its copy icon to copy it for use in the
chatbot conversation containing your recipe. The icon also supports
keyboard activation. If clipboard access is blocked, the prompt is selected
for manual copying.

Paste the chatbot's JSON response to preview it immediately. Doof expects
one `Recipe` object with a `name`, `recipeIngredient` array of ingredient strings,
and `recipeInstructions` array of cooking-step strings. A surrounding JSON code
fence is accepted. Pasted responses are validated locally in the browser; Doof
does not contact an AI service or fetch any links from the response.

The preview shows the name and numbered cooking instructions, alongside the
same ingredient word-selection workflow used for URL imports. **Use recipe**
explicitly replaces the current dish name, Notes and ingredient rows. Cooking
instructions are stored in Notes; images, Source URL, servings, description and
tags are left unchanged. Nothing is persisted until **Save dish**. Editing the
pasted response rebuilds its preview and resets ingredient selections; invalid
or empty input clears the preview. Invalid responses or discarded previews do
not change the dish.

The prompt is maintained in `src/lib/ai-recipe.ts`. Responses are limited to
100,000 characters, names to 200, ingredients to 200 lines of 2,000 characters
each, and cooking steps to 200 entries with a combined numbered Notes length of
20,000 characters. Oversized or incomplete recipes are rejected rather than
silently truncated.

---

## Local development

### Prerequisites

- Node.js ≥ 20 (Node 22+ recommended)
- A PostgreSQL 16 database the dev machine can reach. The simplest option is to
  reuse the deployed Azure server (see below) with a dedicated `doof_dev`
  database; alternatively install Postgres locally.

### Environment variables

Create `.env` in the repo root (gitignored). Required:

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string, e.g. `postgresql://USER:PASSWORD@HOST:5432/doof_dev?sslmode=require`. URL-encode special chars in the password (`@` → `%40`, etc.). |
| `APP_PASSWORD` | Single password the app accepts at `/login`. |
| `COOKIE_SECRET` | 16+ char random string used to HMAC-sign session cookies. |

Generate a fresh `COOKIE_SECRET`:

```powershell
$b = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
[Convert]::ToBase64String($b)
```

### First-time setup

```powershell
npm install
npx prisma generate         # writes src/generated/prisma
npx prisma migrate deploy   # applies migrations to the DB in DATABASE_URL
npm run dev                 # http://localhost:3000
```

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Next.js dev server (Turbopack). |
| `npm run build` | Production build (`.next/standalone`). |
| `npm run start` | Run the production server (after `build`). |
| `npm run lint` | ESLint. |
| `npm test` | Recipe extraction, ingredient conversion and URL import tests. |

### Pointing local dev at the Azure database

If you want to reuse the deployed Postgres server instead of installing locally:

1. Make sure your current public IP is in the firewall (`az postgres
   flexible-server firewall-rule list -g doof-rg -n doof-pg-4828`). Add it with
   `az postgres flexible-server firewall-rule create` if needed.
2. Create an isolated database to avoid touching prod data:
   `az postgres flexible-server db create -g doof-rg -s doof-pg-4828 -d doof_dev`
3. Put the connection string in `.env` (point the database name at `doof_dev`,
   keep `sslmode=require`).

---

## Deployment (Azure Container Apps)

### Resource topology

All resources live in resource group **`doof-rg`** (UK South).

| Resource | Type | Notes |
|---|---|---|
| `doof-app` | Container App | Pulls image from GHCR; public ingress on port 3000. |
| `doof-env` | Container Apps Environment | Hosts `doof-app`. |
| `doof-pg-4828` | Postgres Flexible Server | v16, Burstable B1ms, 32 GB. Public access enabled, gated by firewall rules. Contains the production `doof` database (and `doof_dev` for local dev). |
| `workspace-…` | Log Analytics Workspace | Container Apps logs. |

### Container App runtime configuration

- Image: `ghcr.io/ihorton1/doof:<commit-sha>`
- Env vars (all backed by Container App secrets, not plaintext):
  - `DATABASE_URL` ← secret `database-url`
  - `APP_PASSWORD` ← secret `app-password`
  - `COOKIE_SECRET` ← secret `cookie-secret`
- `NODE_ENV=production`

### Container image

Built from the multi-stage `Dockerfile`:

1. **deps** – `npm ci` on `node:20-bookworm-slim`.
2. **builder** – copies source, runs `prisma generate` (with a dummy
   `DATABASE_URL` so codegen succeeds without a live DB) and `next build`
   producing the standalone server bundle.
3. **runner** – minimal `node:20-bookworm-slim` containing `.next/standalone`,
   `.next/static`, `public/`, the Prisma migrations, the generated Prisma
   client, and a self-contained `prisma` CLI installed at `/opt/prisma`.

### Container startup

`entrypoint.sh` runs on every container start:

```sh
mkdir -p /data
prisma migrate deploy     # apply any pending migrations
exec node server.js       # start Next.js standalone server
```

(`/data` is a holdover from the SQLite era and is harmless under Postgres.)

### CI/CD

`.github/workflows/deploy.yml` runs on push to `main`:

1. Builds the Docker image with Buildx (gha cache).
2. Pushes `latest` and `<commit-sha>` tags to GHCR
   (`ghcr.io/ihorton1/doof`).
3. Azure login via OIDC federated credential (no stored secrets — uses
   `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` repo secrets).
4. `az containerapp update` rolls the app to the new image tag.

### Operational cheatsheet

```powershell
# Tail container logs
az containerapp logs show -n doof-app -g doof-rg --follow

# View the deployed image / config
az containerapp show -n doof-app -g doof-rg

# Read a secret value (e.g. to copy DATABASE_URL into local .env)
az containerapp secret list -n doof-app -g doof-rg --show-values `
  --query "[?name=='database-url'].value | [0]" -o tsv

# Manual restart
az containerapp revision restart -n doof-app -g doof-rg `
  --revision (az containerapp revision list -n doof-app -g doof-rg `
    --query "[0].name" -o tsv)
```

---

## Notes

- **History:** The project originally used SQLite. Commit `dcc298b`
  (12 May 2026) switched the Prisma datasource to PostgreSQL and regenerated
  the initial migration. Some leftover artefacts in `.gitignore`
  (`prisma/dev.db*`, `dev.db.backup-pre-postgres`) are intentional and harmless.
- **Secrets are never in the repo.** All real values live in the Azure Container
  App secrets store and in the local `.env` (gitignored). `.env*` is excluded
  by `.gitignore` and has never been committed.
