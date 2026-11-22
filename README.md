# MW4 Player Report

A static competitive player report built with React, D3 and Vite. Player profiles, event and mode filters, comparisons, tiers and the BushAi Report use the published JSON in `public/data/player-report.json`.

## Run locally

Use Node.js 22 or later.

```sh
npm ci
npm run dev
```

## Build

```sh
npm run build
```

The static site is generated in `dist/`. The GitHub Actions workflow builds and publishes it to GitHub Pages when changes are pushed to `main`. In repository settings, select GitHub Actions as the Pages source.

To update player statistics, replace `public/data/player-report.json` with a newly generated dataset and push the change. The workbook importer and raw source files are maintained separately.

## Data and ratings

Data by [@ChallengerStats](https://x.com/ChallengerStats). Ratings are descriptive comparisons within each selected mode and event. Each measure requires at least three recorded maps and each mode needs two measures. K/D contributes 40%, kills per map 30% and damage per map 30%. Qualifying modes are weighted equally. Scores do not adjust for sample size, opponents or differences in mode coverage. Event dates are not available, so event order and performance trends are not inferred.
