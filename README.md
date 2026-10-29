# fg-payroll

Builds the weekly tech-pay grid from FieldGroove's *Dispatcher by Truck* view.

- `fg-payroll.js` — the logic. Loaded fresh on every click by the **FG Payroll** loader bookmark.
- `RULES.md` — the pay rules and data notes; start here when changing anything.
- Names, trucks and pay rates are **not** stored here; they live in the loader bookmark (`window.FGP_CFG`).

Run it from a logged-in FieldGroove tab (All Locations), then paste the output at A2 of the pay tab.
