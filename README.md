# doof + bolts

This repository is an npm-workspaces monorepo. **Doof** remains at the repository
root to preserve its existing development commands and imports. **Bolts** is an
independent Next.js app in `apps/bolts` for collecting ideas and gradually adding
dated notes and discoveries. It has its own layout, styles, manifest, iPhone
home-screen icon and engine-free Prisma client.

The shared Docker image runs both Next.js servers behind Nginx in **one container
and one replica**. Nginx routes `/bolts/` and its assets to Bolts; all other paths
continue to Doof. Both apps share the replica's
CPU/memory and deploy/restart together. They are not security-isolated workloads.
Bolts has a dedicated password login at `/bolts/login/`, with its own signed,
HTTP-only session cookie scoped to `/bolts`. Signing in or out of either app
does not sign in or out of the other. The live password currently uses Doof's
existing password secret; the session-signing secrets remain separate.
The production database is `bolts`, accessed through its own `bolts_app` database role;
development uses `bolts_dev`. Both use the existing PostgreSQL server, so no
additional server, compute replica, domain or certificate is needed.
Doof's database and schema are unchanged.

## Trying Bolts locally

```powershell
npm install
npm run db:migrate --workspace=@doof/bolts
npm run dev:bolts           # http://localhost:3001/bolts/
```

Before migrating, create a gitignored `apps/bolts/.env` containing
`BOLTS_DATABASE_URL`, pointing to the **bolts_dev** database (not Doof's database).
Use the existing server's credentials with the database name changed to
`bolts_dev`, and preserve its SSL connection options. `BOLTS_DATABASE_URL` is
deliberately separate from Doof's `DATABASE_URL`; there is no fallback between
them. The database is already provisioned for this development setup.
For another environment, create an empty PostgreSQL database before migrating.
Also set `BOLTS_APP_PASSWORD` and an independent `BOLTS_COOKIE_SECRET` of at
least 16 characters. These are server-only variables; keep them out of source
control. Production stores them as Azure Container App secret references.

The home page (`/bolts/`) shows only due bolts, ordered by due time, then creation
time (older first), then ID for stable ties. It initially loads 10 and loads the
next 10 as you scroll; **Load more** also works without automatic scrolling.
Each card
previews the latest entry (up to three lines) and the date that entry was added,
using the same UTC date format as the idea page. Ideas without entries show no
preview or entry date. **New bolt**, marked with a lightning bolt beside **Search bolts** in the bottom navigation,
opens a dedicated idea widget at `/bolts/ideas/new/`, focused on the entry editor.
Titles are optional: use the top-right three-dot menu's **Add title** option,
or **Edit title** on a titled bolt. Clearing a title leaves the bolt untitled.
Nothing is saved until **Add entry** is used; **Due bolts** returns to the feed
without creating an idea. Saving creates the bolt and its first entry together and
opens `/bolts/ideas/<id>/`. Untitled feed cards are labelled **Untitled bolt**.
Each idea page shows its title, when present, and entries in oldest-first order,
with a focused **Add to this idea** form. Changing a title leaves entries and
scheduling unchanged. Entries
are dated automatically when saved (displayed as ISO calendar dates in UTC).
Swipe right on an open bolt or blank new-bolt page to return to **Your bolts**.
Only the rounded bolt panel follows your finger; the page background stays fixed.
Releasing after at least 80 pixels of mostly horizontal movement automatically
slides the panel the rest of the way out and returns home, even for slow swipes.
Short or cancelled swipes slide back. Reduced-motion
preferences disable the sliding animation.
The gesture ignores controls, open menus, vertical scrolling and multi-touch.
Ordinary taps do not start or reset the swipe animation, so links and controls
retain their normal single-tap behavior.
It is disabled while editing or while text, images or an optional
new-bolt title are unsaved. **Due bolts** sits on the left of the rounded panel's
header, with the logo centered and the three-dot menu on the right, and remains
available for normal navigation. The home logo is also centered, and the home panel
has no outline border. Bolt and home panels share the same top position
so navigating between them does not shift the panel vertically.
Text and line breaks are preserved; entries are plain text, not HTML.
Start an entry with `[]` to make the whole entry a to-do, for example
`[] Read this article`. A **To-do** indicator appears while typing; the prefix is
removed when saved. To-do entries have a checkbox to complete or reopen them,
and completed text is struck through. Completion is saved without changing the
bolt's schedule or **Done for now** state. Entries without the prefix remain
notes, including existing entries. To-dos can contain multiple lines, links and
images; their links still appear in the **Links** tab.
Use an entry's three-dot menu and **Edit entry** to edit its text. Attached images appear as
thumbnails with an **x** in the top-right to stage removal. **Save entry** applies
the text edits and image removals together, keeping the original date and any
remaining images; **Cancel** leaves everything unchanged. An entry must retain
some text or at least one image. Adding or removing the
leading `[]` changes it between a to-do and a note. Editing a completed to-do
keeps it completed unless it is converted to a note.
The same menu offers **Break out**. Confirm, change or clear the optional
suggested title, then choose **Create bolt**. The entry moves into a new bolt, retaining its
original date, text, images and to-do completion state. Its old position keeps
the original text and date, marked with a lightning bolt without an underline.
Double-tap the text (double-click with a mouse) to open the new bolt; keyboard
users can focus it and press Enter. It also appears in **Links** and feed
previews. The original bolt's schedule is unchanged; the new bolt follows the
usual new-bolt schedule. Bolt links cannot be broken out again.
The **Archive** option in each active bolt's top-right three-dot menu returns to the due feed
after archiving. Archived bolts remain searchable and offer **Reactivate** instead.
Paste images into the entry field to attach them, with or without a text note.
The trash icon beside each preview removes it before **Add entry**; failed saves retain text and images
for retrying. Each entry accepts up to four PNG, JPEG, GIF or WebP images with a
combined limit of 4 MB. These limits appear in the form only as errors when exceeded.
Saved images appear inline in their original order;
click one to open it full size. The feed previews the latest entry's first image.
Images are stored in the Bolts database, served only to signed-in users, and
become inaccessible when their bolt is deleted. Clipboard images are supported
on both new and existing bolts.
HTTP/HTTPS addresses and `www.` links are clickable in entries and feed previews,
opening in a new tab while leaving Bolts open. Feed cards still open the idea
when clicked outside an external link. Surrounding punctuation is not linked.
Each bolt has **Entries**, **To-dos** and **Links** tabs. **To-dos** collects all
to-do entries, including completed ones, in entry order. Tasks can be checked or
edited there as well as in **Entries**. **Links** lists web addresses and breakout
bolt links from all saved entries in entry order, with their labels and entry dates. Repeated
links remain listed where they were shared; no external previews are fetched.
Web links open in a new tab; bolt links open in the same tab.
Switching views preserves unsaved entry drafts.
Opening a bolt does not change its schedule. After adding an entry, **Done for
now**, beside **Add entry**, dismisses it until midnight the next calendar day in **Europe/London** and
resets its snooze sequence. Adding an entry alone does not dismiss the bolt.
**Done for now** is hidden while there is an unsaved entry draft or the bolt is archived.
Swipe left on a home-feed card to reveal **Snooze** and **Archive**, or use its
three-dot **Actions** button with a mouse or keyboard. Swiping only reveals the
actions; it never commits one automatically. Swipe right, tap elsewhere or press
Escape to close them. Normal vertical scrolling and entry links remain available.
**Snooze** hides a due bolt for successively 1, 3, 7, 14, 30 and 60 calendar days;
further snoozes stay at 60 days. All intervals run from the action's London date,
not the old due date, and respect daylight saving time. New ideas first surface
the next day; existing ideas are immediately eligible after migration.
The feed uses a fixed due-time cutoff while scrolling; refresh to see newly due
bolts. There are no catch-up appearances after time away.
The floating **Search bolts** and **New bolt** buttons stay side by side at the
bottom of the viewport over the feed, above the device's safe area, with space to
scroll the last card clear. **Search bolts** opens `/bolts/search/`, with case-insensitive literal matching
against titles and all entries, including older entries and snoozed or archived bolts.
Search results are also paged in batches of 10; deleted bolts are excluded.
**Archive** stops automatic resurfacing without deleting the bolt or its entries.
Archived bolts remain searchable and readable, can still receive new entries, and are labelled
**Archived**. **Reactivate** on the bolt's detail page returns it to the due feed
immediately and resets its snooze sequence.
There is no separate all-bolts section on the home page. Scheduling is shared
across devices using the app's existing single-password access.
Titles are limited to 200 characters and entries to 20,000 characters.
Empty states guide first use; no example data is inserted automatically.
Saved entries appear directly on the bolt, without a separate success message.
Save failures show an error and preserve your text for retrying.
**Delete idea** at the bottom of an idea page opens a confirmation. Confirming
sets `Idea.deletedAt`; the idea and all entries remain stored, but the idea is
hidden from the feed, its old URL returns not-found, and stale entry submissions
are rejected. There is no restore UI yet.
The user menu beside the wordmark contains **Settings** and **Sign out**.
Settings offers **Light** and **Dark** appearance. Light is the default; the
choice is remembered for a year in a Bolts-scoped browser cookie, applies across
Bolts (including login), and does not change Doof's appearance or either database.
Both themes pair cool slate typography and neutral, borderless buttons with
small lightning-yellow accents. Links and keyboard focus remain clearly visible
against each theme's surfaces.
Editing entries is not implemented yet.

In another terminal, run Doof as usual with `npm run dev` (port 3000 by default).
If Doof is already running on another port, leave it running. The apps have
separate development servers and can be worked on independently.
Bolts explicitly uses Next.js' supported Webpack bundler for dev and build:
with the current Next.js version, Turbopack picks up Doof's root-level proxy
when building this nested app. Doof retains its existing Turbopack setup.

To try the shared production-style routing with Docker Desktop running:
Use unquoted `KEY=value` lines in files passed to Docker's `--env-file`.

```powershell
docker build -t doof-bolts .
# Use a development DATABASE_URL: startup applies Doof's pending migrations.
docker run --rm --name doof-bolts --env-file .env --env-file apps\bolts\.env -p 127.0.0.1:8080:3000 doof-bolts
```

- Doof: `http://localhost:8080`
- Bolts: `http://localhost:8080/bolts/`

Bolts' `/bolts` base path is fixed at build time. Next.js handles its internal
navigation and assets beneath that prefix, and Nginx preserves it when proxying.
Keep the proxy's explicit `/` matcher alongside its subroute matcher: development
also checks the slash-stripped base-path root, otherwise the home page can be blank.
Login requests have a small ingress rate limit in addition to the wrong-password
delay. Unauthenticated page and mutation requests cannot access stored ideas.

### iPhone home-screen installation

Bolts supplies its own standalone manifest, app title and Apple touch icon.
Open `https://doof-app.icydesert-05217ed8.uksouth.azurecontainerapps.io/bolts/`
in Safari, sign in, and
choose **Share > Add to Home Screen**. This creates a separate Bolts icon from
Doof. A computer's `localhost` address is not reachable as that computer from
the phone; local desktop preview does not validate installation on iOS.
The manifest has its own ID, start URL and scope beneath `/bolts/`, and its
Apple touch icon is independent of Doof's.
Offline support is not included.

---

## Doof

A personal meal-planning web app: manage a catalog of dishes (ingredients, tags,
images), plan upcoming meals, generate a shopping list from them, and see a
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
card. Longer titles and tags remain accessible by scrolling. Each meal scroller
contains its layout and paint overflow so scrolling past the final card continues
down the page to Leftovers rather than scrolling the horizontal carousel vertically.
Triple-tap any saved-dish card to add a persistent recipe tag using the same
autocomplete as Plan, or focus a meal card and press **T**. Freeform meals cannot
be tagged. Single taps retain recipe-title and adjacent-day navigation, with a
400 ms pause to distinguish multi-taps; swiping cancels pending taps.
Double-tap/click a meal card (including freeform meals), or focus it and press
**R**, to reschedule that occurrence using the same scrolling day picker as Plan.
It offers the previous seven days, today and the next seven days, based on the
real current date even when browsing another day. It starts on the meal's current
date when available, otherwise today. Saving moves the
existing entry, including across weeks, without replacing other meals or changing
its cooked/skipped status or cleared-leftovers flag. A duplicate saved dish on
the destination day is rejected. Today refreshes after saving, recalculating
automatic leftover dates and countdowns from the new meal date; moving a meal to
today or the future removes it from automatic leftovers until it becomes a past meal.

Scroll past the last recipe card to reach **Leftovers** below Today's recipes.
Use **Add leftovers** to enter a name and cooked date for something outside your
meal plan; no saved recipe is required. The date defaults to today and can be
backdated up to ten days. These entries appear immediately, persist across devices,
and do not change the meal plan, shopping list or recipe cooking counts. Today's
entries show a full green bar, then follow the same timing as automatic leftovers.
Saved recipes planned for
the previous ten calendar days appear automatically (except skipped meals),
with the oldest first. Yesterday is day 1 (green, four days left), followed by
yellow, orange and red (day 4, last fresh day). On days 5-10, the color bar is
replaced with a vomiting emoji and an **Expired** label; the recipe remains
dismissible and disappears automatically on day 11. Meals that had already
expired under the old four-day window stay hidden when this change is applied.
This always
uses the real current date, even while browsing another day, and refreshes at
midnight. Separate occurrences of the same recipe are tracked independently.
Each bar shows its planned date (or cooked date for manually added leftovers)
underneath, alongside the remaining time.
Leftovers include a small saved-recipe thumbnail, or a utensil placeholder when
the recipe has no photo.
Swipe a leftover left or right, or use its **Eaten** button, to dismiss it
persistently across devices. This does not delete the recipe or change the meal
plan; failures keep the row visible with a retryable error. Dates are a reminder
based on the planned or entered cooked date, not a food-safety guarantee.

On a dish's detail page, double-tap its title or photo to open the same 30-day
planning picker as Plan, or triple-tap to add a persistent tag with autocomplete.
A single pointer tap does nothing. Scrolling, dragging or cancelling the pointer
cancels a pending gesture. On the title or photo, Enter/Space opens planning and
**T** opens tagging; there are no separate calendar or tag buttons.
Ingredients, notes, source/tag links and editing retain their
normal interactions. Planning adds dinner without replacing existing meals;
tagging preserves existing tags, and repeated additions are safe no-ops.

Saved dishes have an optional rating: **dud** (muted red), **eh** (amber),
**yum** (emerald), or **delish** (purple), always displayed with its text label.
On dish detail, Today, Plan and Dishes, the rating is the first pill in the
recipe's tag row. It remains separate from tags and is not a tag filter.
On dish detail and Today cards, tap **Rate dish** or the current rating to open
a four-choice picker. Choosing a rating saves immediately; **Clear rating**
restores the unrated state. Failed saves keep the picker open with an error so
you can retry. The new/edit dish form also has an optional rating, saved with
**Save dish**; importing ingredients does not change it.
Plan cards, the Dishes list, Most cooked, and linked adjacent desktop Today
cards show read-only badges; unrated dishes have no badge in these locations.
Ratings belong to the dish, shared across every planned occurrence, and are
separate from tags. They do not affect search, filters, recommendation order,
or cooking counts. Leftovers, Shop and the meal calendar do not show ratings.
Existing title/photo planning and tagging gestures are unchanged; rating
controls use explicit buttons instead.

The bottom tabs are **Today**, **Meals**, **Plan**, **Dishes** and **Shop**.
**Meals** (`/meals`) opens in **Day** view with today and the next six days.
Scrolling to the bottom loads another seven consecutive days, across week,
month and year boundaries. A **Load next 7 days** button also supports keyboard
navigation and manual loading; failed loads keep the existing days and offer a retry.
There are no week-navigation controls. **Day / Month** switches to the monthly
calendar, whose previous/next month controls remain available. A date with one
dish opens that recipe; a date with multiple dishes opens a recipe chooser.
Empty dates and freeform-only dates have no recipe link. Returning to Day starts
at today. Legacy week URLs also show the rolling Day view.
Meals remain stored against their own calendar weeks. Misc shopping extras and Saved plans
are no longer displayed on Meals; their components, actions and stored data are
retained for possible reuse elsewhere.
**Shop** automatically includes ingredients from non-skipped dishes planned for
today or any future date, without a week selector or an end-date cutoff. Its
**By dish / By aisle** toggle defaults to By dish and changes grouping only:
quantities and checkmarks are shared between the views. Identical ingredients
are totalled per dish, or across dishes in aisle view; a partially checked aisle
ingredient is shown with a mixed checkbox. Manual extras and checkmarks persist.
Deleted ingredients and cleared checked ingredients stay hidden during automatic
updates while their planned dish still requires them.
The **Produce box** persists across weeks until **Reset** is confirmed, which
empties both checked and unchecked contents. Individual additions, checks and
removals remain available; there is no weekly carry-over control.
On first use, the current or most recent past shopping list and produce box are
retained as the persistent lists; older weekly records remain stored.
In the Meals dish editor, selected dishes appear as removable chips above search
and remain available to deselect even when the search hides their result rows.
The popup heading shows only the date, without the meal-slot label.
**Plan** (`/plan`) browses saved dishes in a horizontal photo-card carousel.
Photos cover a positioned frame within an explicitly sized card link, avoiding
percentage-height sizing differences in Safari's flex layout.
Keyboard focus underlines the recipe title instead of outlining the card edges.
Scroll below the Plan carousel for **Most cooked**, a thumbnail list of the ten
saved recipes added to the meal plan most often. Each plan entry counts once,
across all past and future dates, regardless of any stored cooked/skipped status.
Only recipes with at least one plan entry appear; ties sort by recipe name then
ID. Each row shows its count and opens the recipe. This list is independent of
the carousel's tag/search filters and recommendation order.
Suggestions use past, non-skipped plan dates as a proxy for cooking history.
Dishes planned in the previous 14 days appear after eligible suggestions;
dishes scheduled for today or any future date appear last. Eligible familiar
dishes are ranked by the number of distinct planned days in the previous 90
days, with an untried recipe inserted after every three familiar recipes where
available. Older history still distinguishes tried from untried recipes.
Ties use a deterministic daily shuffle, so unchanged data gives the same order
throughout the day. Cooldown dishes are oldest-planned first. Every saved dish
remains accessible; short pools are filled from the remaining recipes.
Tag chips above the carousel show the ten tags used on the most saved recipes,
ordered by recipe count (alphabetically for ties), or all tags if fewer than ten
exist. Counts use the full saved-recipe collection, not the current filtered
results. Other tags remain available through the search field and tagging
autocomplete. Tag chips filter recipes by any selected tags. Tapping a
selected tag again clears that filter. Changing tags starts at the first
matching recipe and cancels any pending single-tap navigation.
The search field adds temporary, removable filter chips with **Add filter** or
Enter. Each chip matches dish names, ingredients or tags, ignoring case and
surrounding whitespace and allowing substring matches. Recipes must match every
positive chip and tag, and must not match any negative chip or tag: all filters
combine with AND. Multiple positive and negative tags may be active together.
Single-tap a tag to include it; double-tap/click any tag or custom-filter bubble
to exclude matches. Exclusions turn red and show a minus icon. A single tap
clears an active tag or removes a custom bubble, including exclusions.
Single taps wait 400 ms so double-tapping a custom bubble does not remove it first.
Keyboard users can press **N** on a bubble to exclude it, or Enter/Space to select
or clear it. Gesture and keyboard guidance is available to screen readers without
a visible help line. Suggestions cover all three fields; duplicate custom bubbles
are rejected, including when excluded. **Clear filters** clears every mode and
cancels pending filter taps. These filters do not change saved recipe tags.
Changing chips also resets the carousel and cancels pending navigation. Filtering keeps
the recommendation order; it does not rerank or reshuffle recipes.
Tap a card to view its recipe; double-tap (double-click with a mouse) to open a
scrolling picker covering Today and the next 29 days. Triple-tap opens a compact
quick-tag popup with existing-tag suggestions. Single-tap navigation waits
400 ms; the day picker waits 400 ms after the second tap to distinguish a triple-tap.
Scrolling, cancelling the pointer, changing filters or using a keyboard shortcut
cancels a pending gesture. Keyboard users can focus a card and press Enter to view
the recipe, Space to choose a day, or T to add a tag. Quick tags are saved on the
recipe without replacing existing tags, using the same lowercase, trimmed names
as the dish editor (up to 40 characters). Repeating an existing tag is a no-op.
Tag confirmations are announced to screen readers without visible status text;
saved tags update the carousel and its filter/suggestion lists. Errors remain visible.
Quick tagging and the dish editor share a custom autocomplete dropdown with up to
eight matching existing tags and an option to create a new tag. Use touch/click
or Up/Down and Enter to select a suggestion; in the quick popup, **Add tag** then
saves it. Suggestions exclude tags already assigned to the recipe.
Suggestion presses keep input focus until selection so clicking a full tag does
not commit the typed prefix as a separate tag.
Touch presses remain uncancelled so Safari can deliver selection clicks, and
suggestions appear above the sticky Save dish controls. The editor groups tags
in a fieldset rather than a wrapping label, preventing Safari from immediately
activating a newly added tag's Remove button.
In the day picker, scroll, tap a date, or use
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
│   │   ├── meals/        # rolling day/monthly meal schedule
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
- `ShoppingList` → `ShoppingListItem` (auto-generated from upcoming meals or manual,
  with `category`, `checked` and `dismissed` state). The active list has unique
  `scope = "rolling"`; legacy weekly records retain their original dates.
- `ProduceBox` → `ProduceBoxItem` uses the same rolling scope to keep contents
  independent of calendar weeks. Reset removes items, not the active box record.
- `PlanTemplate` → `PlanTemplateEntry` + `PlanTemplateMiscItem` for reusable
  weekly plans.

### Dish notes

On **New dish** and **Edit dish**, the multiline **Notes** box below Ingredients
holds cooking instructions, tips, substitutions, equipment and reminders.
Notes are shown on the saved dish page and never added to the shopping list.
Only ingredient rows contribute to shopping.
Each ingredient also has an optional note to its right (up to 200 characters),
for details such as "finely chopped" or "room temperature". These notes are
shown beside the ingredient on the dish page, preserved when editing, and
excluded from the shopping list.

### Peeking at a recipe (prototype)

On **Dishes**, choose **Peek**, paste a recipe URL and press **Preview**. The
read-only reader shows the recipe title, source, ingredients and numbered method
steps. It uses a tall bottom sheet on mobile and a centred panel on desktop,
with **Add to my dishes** fixed below the scrollable content. Pages containing
several recipes offer a selector. Closing the reader saves nothing.

**Add to my dishes** opens the full New dish form with the selected recipe's
name, source URL, image (when available), prepared ingredient fields and method
(in Notes). The same ingredient word-selection editor used for URL imports opens
with the original sentences, letting you assign words to Quantity, Unit,
Ingredient and Notes, remove/undo lines, then apply your changes with **Use recipe**
(or **Replace ingredients** for an untitled recipe). The carried-over image is
already selected and can be removed or replaced using the existing image controls.
It does not fetch the recipe again. Review the suggested ingredient splits before saving;
ambiguous text is preserved rather than discarded. The draft stays only in that
browser tab's session storage, survives refresh, and is not saved to the database
until **Save dish**. Images stay out of the lightweight reader but carry into the add form.
Unavailable or blocked browser storage produces an explicit error. An expired
or invalid draft link offers a return to Dishes or a manual add.

Preview uses the existing signed-in, public-URL-only fetch path. Method extraction
supports JSON-LD text, arrays, `HowToStep` and nested `HowToSection` values.
Missing ingredients or methods are labelled explicitly with an **Open original**
link; steps are never invented. Unsupported method details produce a warning.
Methods over 200 steps or 19,000 formatted characters (including numbering and
section headings) are omitted with a warning rather than
silently truncated. Normal URL ingredient import below remains unchanged.

### Importing ingredients from a recipe URL

On either **New dish** or **Edit dish**, paste the recipe's **Source URL** to
load its preview automatically. Typed URLs load when you leave the field or
press Enter. Paste again or press Enter to retry. Existing URLs do not fetch
just from opening an edit form. Doof reads `Recipe.recipeIngredient`
from Schema.org JSON-LD embedded in the page, including arrays, `@graph` and
nested recipes. If there are multiple recipes, choose one in the preview.

The conversion widget makes a best-effort split into **Quantity**, **Unit** and
**Ingredient** for both URL and AI imports. For example, `2 tablespoons olive oil`
prefills `2`, `tablespoons` and `olive oil`. Fractions, ranges, attached measurements
and common units are recognized without converting measurements or changing unit
spelling. Ambiguous package sizes and alternative measurements stay intact in the
ingredient field for review; obvious section headings start omitted.
Each original ingredient sentence remains available as selectable words.
Select one or more words, then assign them to a field to correct the suggestion.
The Quantity, Unit, Ingredient and Notes assignment buttons are equal-width and span
the card, with large mobile tap targets. Tap a selected word again to deselect it.
Each import row includes optional ingredient notes (up to 200 characters), which
can be typed or assigned from selected words. Notes carry into the dish form,
survive removing and undoing a row, and stay out of shopping. Assigning words
copies them; edit the ingredient name separately to remove any preparation text.
Attached measurements such as `200g` or `cup/57` are separately selectable,
while fractions and hyphenated ingredient names remain intact. You can edit
the fields directly. Sentences with a blank ingredient name are automatically
omitted, even if quantity or unit has been entered. Clear the ingredient name
to skip a sentence, or tap the red trash-can button in its top-right corner.
Ingredient cards use normal scrolling and text editing without swipe gestures.
**Undo** restores a removed row with its edits and original position. Rows have
no numbered "Sentence" headings. Quantity and unit are optional.
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
| `npm run dev:bolts` | Start Bolts on port 3001. |
| `npm run build` | Production build (`.next/standalone`). |
| `npm run build:bolts` | Build Bolts' independent standalone bundle. |
| `npm run build:apps` | Build both apps for the shared image. |
| `npm run db:generate --workspace=@doof/bolts` | Generate Bolts' engine-free Prisma client. |
| `npm run db:migrate --workspace=@doof/bolts` | Apply only Bolts' migrations using `BOLTS_DATABASE_URL`. |
| `npm run start` | Run the production server (after `build`). |
| `npm run lint` | ESLint. |
| `npm test` | Recipe extraction, ingredient conversion and URL import tests. |
| `npm run test:container` | Docker-based ingress, shutdown and failure tests using fixture servers; no database needed. |
| `npm run test:bolts:db` | Test persistence against `bolts_dev`; creates and cleans up only its own test records. |

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
| `doof-pg-4828` | Postgres Flexible Server | v16, Burstable B1ms, 32 GB. Public access enabled, gated by firewall rules. Contains production `doof` and `bolts`, plus development `doof_dev` and `bolts_dev` databases. |
| `workspace-…` | Log Analytics Workspace | Container Apps logs. |

### Container App runtime configuration

- Image: `ghcr.io/ihorton1/doof:<commit-sha>`
- Env vars (all backed by Container App secrets, not plaintext):
  - `DATABASE_URL` ← secret `database-url`
  - `APP_PASSWORD` ← secret `app-password`
  - `COOKIE_SECRET` ← secret `cookie-secret`
  - `BOLTS_DATABASE_URL` ← secret `bolts-database-url`
  - `BOLTS_APP_PASSWORD` ← secret `app-password`
  - `BOLTS_COOKIE_SECRET` ← secret `bolts-cookie-secret`
- `NODE_ENV=production`
- `BOLTS_DATABASE_URL`: Bolts' own PostgreSQL connection string, required for its
  pages. Configure as a separate secret before enabling Bolts in a deployed
  environment; never point it at Doof's database or reuse `bolts_dev` for production.
- Ingress target port remains **3000**; internal app ports are not exposed.

### Container image

Built from the multi-stage `Dockerfile`:

1. **deps** – `npm ci` on `node:20-bookworm-slim`.
2. **builder** – copies source, runs `prisma generate` (with a dummy
   `DATABASE_URL` so codegen succeeds without a live DB) and `npm run build:apps`,
   producing separate standalone server bundles.
3. **runtime-base** – Node.js plus Nginx, Tini and configuration tools; can be
   built independently for the container integration tests.
4. **runner** – extends `runtime-base` with `.next/standalone`,
   `.next/static`, `public/`, the Prisma migrations, the generated Prisma
   client, and a self-contained `prisma` CLI installed at `/opt/prisma`.
   Bolts' standalone bundle lives separately at `/opt/bolts`, alongside Nginx
   for path routing and Tini for process reaping/signal forwarding.

### Container startup

`entrypoint.sh` runs under Tini on every container start:

```sh
mkdir -p /data
prisma migrate deploy     # apply any pending migrations
# Start Doof on loopback port 3002 and Bolts on loopback port 3001.
# Start Nginx on public port 3000, routing /bolts/ to Bolts, others to Doof.
```

The entrypoint validates Bolts' required configuration and Nginx before applying
migrations. It also applies Bolts'
separate migration history before starting either server; a failed migration
or missing configuration prevents startup, rather than silently using Doof's
database or starting an unprotected application.
It supervises all three processes: if any exits, it logs the failure,
stops the others and exits nonzero so Azure can restart the replica. Container
shutdown signals stop all services. Doof's database URL, password and cookie
secret are removed from Bolts' process environment, and Bolts' database/session credentials are
removed from Doof's process environment.

(`/data` is a holdover from the SQLite era and is harmless under Postgres.)

### CI/CD

`.github/workflows/deploy.yml` runs on push to `main`:

Manual runs build and publish without deploying by default, allowing a branch
image to be validated first. Manual deployment requires the `deploy` input and
the `main` branch so the existing Azure OIDC trust remains unchanged.

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
