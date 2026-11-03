---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["src/styles.css","src/components.tsx"]
---

# NBA analysis screen

Mode: Operate. Scope: the live single-page NBA analysis application at `/`.

User choice: “sports editorial is great”, confirming the editorial study in `design-previews/editorial.html` and its desktop/mobile captures. Build directly in code from that approved study.

## Direction contract

THESIS: Explain the score through one signed impact table and a running gap, rather than a generic dashboard of repeated cards.

OWN-WORLD: Midnight navy chrome, cool paper, white score strip, vermilion costs, green offsets, Barlow typography, thin aligned rules and tabular figures. No decorative icon tiles or eyebrow labels.

STORY: Choose a date, game and team; read the result and biggest factor; inspect the ranked contributions; expand a calculation or close a gap with a slider.

FIRST VIEWPORT: A 60px navy wordmark bar; compact native date/game controls; the wide team-and-score strip; the biggest-factor sentence and team selection; a factor table with costs left of zero, offsets right, and a running gap in the final column. Preserve this order on phones, stacking factor labels above each plot.

FORM: Sports editorial, the user's approved grounded candidate; seed:6e87e0a809325ad4. The signature interaction is the impact bar shrinking and the running gap updating continuously as a what-if slider closes a cost. Keep native controls, cached game switching and interruptible panel/sheet motion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
