# How to Contribute a Guide

> **Audience:** Anyone who wants to contribute a guide using the visual Guide Builder. No coding required. If you prefer to write JSON directly, see `SCHEMA.md` instead.

Pull Requests are welcome, but manual file submissions from known users through the Discord are also accepted until an automated pipeline is established.

---

## Before You Start

You'll need:

- The **RetroAchievements (RA) Game ID** for the game you're writing a guide for. Find it in the URL on the game's RA page: `retroachievements.org/game/33047` → ID is `33047`.
- The **Guide Builder** open in your browser (`builder.html`).
- A basic sense of what tabs and panels you want — a rough outline on paper or in a notes app helps a lot before you start clicking.

> **Important:** The builder has no auto-save. Your work lives in memory only — closing the tab or refreshing the page will lose everything. **Use the Export ZIP button as your save mechanism.** Export early and often, and re-import if you need to resume a session (see [Importing an Existing Guide](#importing-an-existing-guide)).

---

## The Builder at a Glance

When you first open the builder you'll see an empty state. Once you load or start a guide, the screen splits into two areas:

- **Left/top controls** — a sticky header with buttons to manage your guide.
- **Live preview** — the guide as it will appear to users, rendered in real time. Every change is reflected immediately.

Hovering over any panel in the preview reveals editing controls (↑ ↓ to reorder, ✎ Structure to edit, 🗑 to delete).

---

## Step 1 — Set Game Metadata

Click **Game Meta** in the header. Fill in:

| Field | What to enter |
|---|---|
| **RA Game ID** | The integer ID from retroachievements.org. Required before you can export. |
| **Game Title** | Full name as it appears on RA. |
| **System** | Primary platform (e.g. PSP, Switch, PC). |
| **Alt Systems** | Comma-separated if the game is on multiple platforms. |
| **Series** | Leave blank for standalone games. |
| **Year** | Release year. |
| **Icon** | One emoji — shown in the game list. |
| **Author** | Your name or handle. |
| **Subtitle** | Short description shown under the title. "Completion tracker — progress saved in your browser" works well. |
| **Theme** | Controls shape and fonts. See the theme list for options. |
| **Palette** | Controls colors. Dark palettes suit most retro games; light palettes suit cheerful ones. |

Click **Save Meta** when done. Both **Theme** and **Palette** should be set — leaving either blank means no styling is applied.

---

## Step 2 — Add Tabs

Tabs appear as navigation buttons across the top of the guide. Click **+ Add Tab** in the tab bar and enter a label. Convention is emoji + short name: `🏆 Achievements`, `📖 Walkthrough`, `💰 Sales`, etc.

You can rename or delete tabs later by hovering over them in the preview.

Plan your tabs before adding panels — it's easier to add all tabs first, then fill each one with panels.

---

## Step 3 — Add Panels

With a tab selected, click **+ Add Panel** at the bottom of the preview. You'll be asked to pick a panel type and fill in its structure.

### Choosing a Panel Type

| Panel type | Use it for |
|---|---|
| **Text** | Introductions, tips, story summaries, anything that's just written explanation. Supports basic Markdown. |
| **Key/Value** | Quick-reference lookups: controls, stat breakdowns, settings, two-column comparisons. |
| **Checklist** | Anything users want to track — items, achievements, collectibles, events seen. Progress is saved in the browser. |
| **Table** | Reference tables where you don't need checkboxes: routes, stat charts, step-by-step sequences. Supports Markdown in cells. |
| **Cards** | Character rosters, companion lists, enemy profiles — anything with a consistent set of fields per entry. |

### Panel Structure vs. Row Data

The builder separates **structure** (what columns exist) from **rows** (the actual data). When you create a checklist or table panel, you first define the columns, then click **+ Add Row** to fill in each row one at a time.

This matters because you can always add more rows later without touching the panel structure.

---

## Step 4 — Configure Each Panel Type

### Text Panel

Fill in the **Panel Title** and optionally a **Tip Box** (appears as a highlighted callout). Then write your content in the text area. Basic Markdown is supported:

- `**bold**` → **bold**
- `*italic*` → *italic*
- `` `code` `` → `code`
- `### Heading` → a section header
- `- Item` → a bullet point
- `[text](tab)` → a link to another tab. `tab` must be an integer, and tabs start at 1
- `[text](tab, panel)` → a link to another panel. `tab` and `panel` must be integers, and they both start at 1

The toolbar buttons above the text area will insert formatting around your selection.

### Key/Value Panel

Fill in the **Panel Title** and save. Then use **+ Add Row** to add pairs one at a time. Each row has a Key (left) and Value (right). The Value field supports Markdown.

### Checklist Panel

1. Fill in **Panel Title** and optionally a **Tip Box**.
2. Add **Columns** — click **+ Add Column** for each extra column you want. Every checklist already has a built-in Number column and a checkbox; you're adding columns for things like Location, Price, Notes, etc. Each column needs a label and a style:
   - **Standard** — regular text
   - **Accent (gold)** — for prices, rewards, key data
   - **Dim (muted)** — for secondary info; hidden on narrow screens
3. Click **Create Panel**.
4. Click **+ Add Row** to fill in items. Each row has a Name field and one field per column you defined. The optional **Note** field adds small secondary text under the item name — good for warnings or tips.

> **Tip on IDs:** The builder auto-generates item IDs. If you're migrating an existing guide and need to preserve user progress, you'll want to edit the exported JSON directly to match the old IDs. See `SCHEMA.md`.

### Table Panel

1. Fill in **Panel Title** and add **Column Headers** — one per column (e.g. Route, Days, Silver/Day, Details).
2. Click **Create Panel**.
3. Click **+ Add Row** to fill in each table row. Fields are labeled with your column headers.

Markdown works in all cells, so you can use `**bold**` for item names or `*italic*` for notes.

### Cards Panel

1. Fill in **Panel Title** and add **Card Fields** — one per field each card will have. The first field becomes the card's title/name.
2. Click **Create Panel**.
3. Click **+ Add Row** to fill in each card. Fields with no value are hidden automatically.

---

## Step 5 — Editing and Reordering

- **Reorder panels:** Hover the panel and click ↑ or ↓.
- **Edit panel structure** (columns, title, tip box): Click ✎ Structure.
- **Edit or reorder rows:** Click **✎ Edit / Reorder Rows** below any panel that has rows.
- **Delete a panel:** Click 🗑 and confirm.

---

## Step 6 — Export

When your guide is ready, click **⬇ Export ZIP** in the header. The builder will:

1. Validate that you've set an RA Game ID and title.
2. Generate all the JSON files in the correct directory structure.
3. Bundle them into a ZIP file named `{raId}_{slug}_submission.zip`.

The ZIP contains:

```
{raId}_submission/
├── games_index_entry.json        ← Add this to the root games_index.json
├── README.txt                    ← Instructions for the maintainer
└── games/
    └── .../
        └── {raId}/
            ├── {raId}_00.json
            ├── {raId}_01.json
            └── ...
```

Open `README.txt` inside the ZIP — it has the exact file paths and merge instructions.

---

## Step 7 — Submit

**Via Discord (recommended for most contributors):**

Send the ZIP directly to the guide maintainer on the Discord server. Known contributors can submit files this way until an automated pipeline is in place.

**Via Pull Request:**

If you're comfortable with Git:

1. Fork the repository.
2. Place the files at the paths described in `README.txt`.
3. Merge the `games_index_entry.json` object into the root `games_index.json` array.
4. Open a pull request with a brief description of the game and what the guide covers.

---

## Common Mistakes

**"My export button is greyed out / gives an error."**
Make sure you've set a valid RA Game ID (an integer) and a game title in Game Meta.

**"The guide looks unstyled / has no colors."**
Both Theme and Palette need to be set in Game Meta. If either is missing, the guide renders with no styling applied.

**"I forgot to add a column and now my rows are missing a field."**
Click ✎ Structure on the panel to add the column. Existing rows won't have a value for the new column — use ✎ Edit / Reorder Rows to fill them in.

**"I want separate sections within one checklist (like categories)."**
The format doesn't support categories inside a single checklist panel. Instead, create one panel per section — e.g. "Spring Fish", "Summer Fish", "Fall Fish" as three separate checklist panels on the same tab.

**"I made a checklist but I actually need a table (no checkboxes)."**
Delete the panel and recreate it as a Table panel. Unfortunately there's no panel type conversion — you'll need to re-enter the rows.

**"The preview looks wrong / a panel isn't rendering."**
Check that every item in a checklist has a unique `id`. Duplicate IDs cause silent rendering issues. The builder generates IDs automatically so this mainly applies if you've edited the JSON by hand.

---

## Tips

- **Export often** — the builder has no auto-save. Treat every Export ZIP as a manual save. There is no undo beyond your last export.
- **Sketch first** — decide on tab names and panel types before you start. Restructuring later is doable but tedious.
- **Checklist vs Table** — if users need to track completion, use a Checklist. If it's pure reference, use a Table. Don't use Checklists for walkthrough steps or static data users won't want to tick off.
- **Tip Boxes** — use these sparingly. One per panel is usually enough. They're best for "read this before you start" warnings, not general info.
- **Dim columns** — mark secondary info (town names, categories, dates) as Dim so the important columns stand out. Dim columns are also hidden on mobile, so don't put critical info in them.
- **One panel per category** — if your content naturally groups into sections (e.g. fish by season, crops by season), split them into separate panels rather than trying to cram everything into one large panel. The guide renders each panel as a collapsible card, so more panels = easier navigation.
