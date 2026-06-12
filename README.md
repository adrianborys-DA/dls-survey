# DLS Survey Dashboard

React/Vite dashboard prototype using the real DLS CSV exports from `public/data`.

## Important install note

This clean package intentionally does **not** include `package-lock.json`. Generate a fresh lock file in your own dev environment so npm uses your public/default registry, not a registry from another machine.

## Run locally

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal.

## Build

```bash
npm run build
npm run preview
```

## Data files

The dashboard currently reads:

- `public/data/DLS_NPS_06102026.csv`
- `public/data/DLS_Responses_06102026.csv`

This matches the current public-folder approach. When moving to Supabase later, the same transformation functions in `src/utils/data.js` can be replaced with Supabase query results.

## If install/build feels stuck

Run this from the project folder:

```bash
rm -rf node_modules package-lock.json
npm cache verify
npm install --registry=https://registry.npmjs.org/
npm run dev
```

The CSV files are in `public/data`, so Vite does not bundle them during build. A slow install is usually dependency resolution, not the dashboard code.


## Fix in v2
Experience and Foundations rows use `Display_Value` for scale responses instead of `ResponseNumeric`. The loader now derives numeric scale values from the leading number in `Display_Value`, so Experience and Foundations charts render correctly.


## v4 updates

- Experience and Foundations now render as horizontal 100% stacked response-distribution bars.
- Each question shows prior period and current period side-by-side when comparison is enabled.
- Response segments are calculated as count of answer choice divided by total responses for that question and period.
- Added persona-specific filters for Students, Parents, Staff, and Alumni.
- NPS now includes a bright overall comparison chart, a current-period persona summary table, and a drill-down selector for detailed YoY comparison.


## v5 update notes

This version updates the NPS, Experience, and Foundations pages based on the latest QA feedback.

- NPS now starts with a stakeholder summary table.
- NPS cells distinguish a valid 0.0 score from true no-data / N/A.
- NPS summary cells show current score plus YoY variance.
- NPS charts now show current/prior bars and label the current value with YoY variance.
- Experience now includes a summary section before the distribution charts.
- Foundations now includes a summary section before the distribution charts.
- Experience and Foundations summary cards show average score, status circle, response count, and YoY variance.
- Experience and Foundations still use horizontal 100% stacked bars for answer distribution.

For Experience and Foundations, lower average score is better because 1 is the strongest positive answer and 5 is the weakest answer.
