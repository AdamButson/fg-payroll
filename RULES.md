# FG Payroll — rules

How the weekly tech-pay grid is built. Names, trucks and pay rates are **not** in this repo; they live in the
loader bookmark as `window.FGP_CFG` (`cols`, `rigs`, `flat`, `trucks`, `rides`). Keep this repo free of names and wages.

## Data source
- FieldGroove **Dispatcher by Truck**: `/Calendar/DispatcherByTruck?date=MM/DD/YYYY` (server-rendered HTML).
- Each truck row lists that day's work orders as `Work Order #NNNNNN … X% of $LABOR`. `$LABOR` is the full work-order labor.
  The `X%` field is unreliable (dispatch leaves defaults) — ignore it.
- **Job #** = `Project #` on the visit page (`/Calendar/_Edit/{eventId}`).
- A multi-day work order = separate visits (events), one per day, same WO #. Every visit is usually marked "Complete",
  so status can't tell production from return trips.
- Location dropdown must be **All Locations** or rigs disappear.

## Pay week & sheet
- Pay week runs **Wednesday → Tuesday**; the pay tab is named for the following Wednesday (pay date), e.g. `11.04.2026`.
- Tab layout: row 1 headers (tech columns, a marker column, Notes). Rows 2–22 = 7 days × 3 rows
  (`<Day> M/D/YYYY` amounts · `Job Number` · `Allocation`). Row 23 Week Total, row 26 Daily averages (formulas — never overwrite).
- Script output is pasted at **A2** and covers rows 2–22 only.
- Notes column: amount row (marker `S`) = notes for rig 1; job row (marker `L`) = notes for rig 2.
- Allocation is filler (Gainesville / Weekend); the CFO allocates at month end.

## Rig leads (production pay)
- Pay = the **full labor of the work orders on their rig that day** — no daily floor.
- A rig with a helper: lead's day pay = production − helper's day rate; **never below $0** (no negatives, no carry-over).
- Multiple jobs in a day: add them; list job #s as `job / job`; per-job amounts in Notes.
- **Day rate (`floor`) applies to the weekly average, not per day.** Average = week total ÷ days with an entry
  (same as the sheet's Daily averages row, which counts $0 weekdays). Below → flag the shortfall; don't auto-adjust.

## Multi-day work orders
- **Production days** = first visit + visits on the immediately following workdays (Mon–Fri). Labor split evenly across them,
  each share paid on the day worked — even if that day is in another pay period (script looks back 14 days, ahead 7).
- **Return trip** = any visit after a gap in the schedule → lead $0 (no floor); helper still gets their day rate.
- Known limit: a fix-up visit on the very next workday looks like production. Every multi-visit WO is listed for review.

## Helpers & box-truck crews
- Helper: flat day rate on weekdays; job # = their lead's job #s.
- Box-truck techs: flat day rate on weekdays; job # = jobs on their truck. Partners (`rides`) copy their partner's job #s.
  Pairings sometimes change — fix by hand.
- Floater: job # only from their own truck.

## Weekends
- Weekend crews are one-offs (e.g. a box-truck tech riding in a spray rig). The truck a job is scheduled on is **not** trusted.
- Script asks who worked each weekend job (labor > $0) and splits labor evenly; extra cent to the first name. Blank = NOT ASSIGNED note.

## Manual-only adjustments
- Deductions FieldGroove doesn't know about (e.g. a cleanup crew sent after a job) — enter by hand and note it.

## History (Apps Script in the pay sheet, not in this repo)
- Payroll menu: New pay period tab · Log this tab / ALL tabs to History · Archive tabs older than 2026.
- History = one row per tech per day (pay tab, date, tech, amount, job #, notes); skips blank/$0; work dates from 1/1/2026.
- Tab names vary (`11.04.2026`, `1.07.2026`, `7.22.26`); older tabs may have blank spacer columns and a "More Notes" column.
- Validation: each tech's History total must equal the tab's Week Total.

## Testing
Set `window.FGP_CFG`, `window.__FGP_INPUT='MM/DD/YYYY'` (week start) and optionally `window.__FGP_WEEKEND={job:'Name, Name'}`,
eval the script on a logged-in FieldGroove tab, then read `window.__FGP_OUT` (TSV + REVIEW). Runs ~30–60 s (28 dispatcher pages).
