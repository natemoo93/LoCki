# LoCki

LoCki is a browser extension that creates Wikidata-compatible information from an LCNAF name record.  If a record already exists for a person, LoCki detects it and offers to add to it.

## Install

Chrome or Edge:

1. Open `chrome://extensions` or `edge://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**. Select this folder.

Firefox 115 or later:

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on**. Select `manifest.json`.
3. Do these steps again after Firefox restarts.

## Use

1. Open a record page on `id.loc.gov`, or type an LCCN (for example, `n79021164`).
2. Open the LoCki popup.
3. Examine the label, description, and aliases. Edit them if necessary.
4. Click **Create in Wikidata**. Examine the confirm panel. Click **Create item**.

To use QuickStatements, click **QuickStatements**. Then paste the text into QuickStatements.

## Chips

Below the fields, the popup shows one chip for each MARC tag that LoCki reads: `100`, `400`, `374`, `370`, `500`, `024`, and `053`. The color of a chip shows the status of the tag.

| Chip | Status |
|---|---|
| Green | The tag is in the record. It does not need a review. |
| Grey | The tag is not in the record. |
| Yellow `i` | The tag is in the record. Examine it before you save. |
| Red `!` | The record has a problem. LoCki cannot make a correct item from it without your help. |

A chip is yellow for these conditions:

- `100` or `400` has a fuller form of the name (`$q`).
- `400` has a title (`$c`).
- `374` has more than one occupation.
- `500` is in the record. LoCki does not use a related name. It can be a pseudonym or a different person.

A chip is red for these conditions:

- The record has no `100`, or more than one `100`.
- The record is a corporate name (`110`) or a meeting name (`111`).
- `100` has a title (`$c`). Make sure that the title is in the correct position in the label.

If a tag occurs more than one time, the chip shows the number (for example, `400 ×3`). Click a chip to show its fields and messages below the chips. Click the chip again to hide them. When the popup opens, it shows the first red chip. If there is no red chip, it shows the first yellow chip. If there is no yellow chip, it shows the first green chip.

The chips show the record as LC sent it. Text filters do not change the chips.

## Diff panel

When you click **Create in Wikidata** or **Add to Q...**, LoCki shows a diff panel. The panel shows each value before LoCki writes it. LoCki writes nothing until you click **Create item** or **Add**.

| Line | Meaning |
|---|---|
| Green `+` with a checkmark | LoCki writes this value. |
| Green `+` without a checkmark | LoCki does not write this value. Select the checkbox to write it. |
| Plain, with **Unchanged** | The item has this value or a different value for this field. LoCki does not change it. The panel shows the value that the item has. |

These lines start without a checkmark:

- **Aliases.** A `400` may be a romanization, an earlier form, or a form that is not correct. Select only the aliases that you can confirm.
- **P1149 (LC class number).** A `053` number can be a range of class numbers. Make sure that the number is correct before you select it.

All other additions start with a checkmark. On a new item, the label, the description, and the statements have no checkbox. On an item that already exists, each addition has a checkbox.

If you edit a field while the panel is open, click **Refresh** to show the panel again with the edits. LoCki cannot create an item that has no label and no description.

## Data

| Wikidata | Source |
|---|---|
| Label | `100 $a`, in direct order |
| Aliases | `400 $a`, in direct order |
| Description | `370 $c` country, `374 $a` occupations, and years |
| P244 | The LCCN |
| P31 | Q5 (human) |
| P214, P213, P496, P227 | `024` (VIAF, ISNI, ORCID, GND) |
| P1149 | `053` |

Dates come from `046`. If `046` is not there, dates come from `100 $d`. If there is no death date, LoCki shows the birth year only for a person born in 1915 or before.

## Duplicate check

Before you can create an item, LoCki searches Wikidata in this sequence:

1. P244 with the LCCN.
2. P214 with the VIAF number.
3. The label (also without diacritics) and the birth and death years.

A match at step 1 or 2 is a duplicate. A match at step 3 with identical dates is a duplicate. A match at step 3 with a difference of one year or less is a possible match.

If LoCki finds a duplicate, the button changes to **Add to Q...** or **Entry exists**. **Add to Q...** adds only the data that the item does not have. LoCki does not remove or replace data on Wikidata.

## Settings

Open **Settings** in the popup footer.

| Setting | Default | Function |
|---|---|---|
| How an item is saved | API | Save from the popup, or open a prefilled `Special:NewItem` form. |
| Exclude romanizations | Off | Do not add variant names that have ALA-LC romanization marks. |
| Get the VIAF number from VIAF | On | If `024` has no VIAF number, get it from viaf.org. |
| Text filters | None | Replace text in the record before LoCki makes the fields. |
| OAuth client | Built-in | Use a different Wikimedia OAuth client. |

## Sign in

Sign in to Wikidata on the settings page. If you do not sign in, Wikidata still records the edit, but with a temporary account.

## Test

```
npm install
npm test
```
