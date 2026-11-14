# OSINT / 2002 visual implementation

The supplied design handoff is a visual reference. Functional screens use real
HTML, CSS, inline vector icons, and the existing Android bridge rather than
screenshots as backgrounds. No fonts or photographs were extracted from the
reference mockups. The wordmark is an original inline SVG drawing.

`app/src/main/assets/images/editorial-atlas.png` is a new AI-generated photographic
asset created with the built-in imagegen tool. CSS selects distinct cells of a
3 by 3 atlas. The eye is used only on the home/splash surfaces.

Generation prompt:

> Create a production image asset atlas, a perfect 3 columns by 3 rows grid of nine equally sized rectangular photographs with absolutely zero gutters, no borders, NO typography, NO letters, no logos, NO UI. Overall canvas landscape 1536x1024. All nine pictures share cold muted petroleum teal / ice gray analog color grading, early 2000s corporate liminal editorial film photography, subtle real film grain and optical bloom, bleached off-white highlights, matte ink print, no neon, no illustration, no glassmorphism. Each tile must be full bleed in its exact cell, no elements crossing cell boundaries. Top left: extreme close up human eye, iris on right, bleached fade on left, subtle double exposure of distant silhouettes inside an empty glass transit corridor at lower left. Top center: empty glass-and-concrete airport corridor receding to a vanishing point, fluorescent lighting, no eye or people. Top right: diagonal modernist office glass facade. Middle left: large satellite dish against sky. Middle center: server racks in empty datacenter with overhead lights. Middle right: physical archival folders and transparent storage boxes. Bottom left: concrete stairwell looking up with geometric railings. Bottom center: empty elevated transit bridge and distant office block in haze. Bottom right: close-up abstract technical cables and patch panels. Keep desaturated cold blue ink and off-white print tones throughout, detailed photographic imagery, soft faded edges within each photograph. This is an asset sheet for a Russian OSINT 2002 editorial Android interface.

The graph is provisional. Edges mean a URL was checked for a query, or an IP
address was returned by DNS. They are not inferred personal relationships.
Unavailable integrations are described in the interface without fake records,
fake progress, or made-up source totals. The splash has no artificial delay.

## Blue palette correction (0.3.1-alpha)

The 0.5.0 revision adds `images/page-scenes.png`: an interior viewpoint of the
same pedestrian bridge shown outside in the search strip, a close storage-hardware
fragment for Databases, and curved concrete/glass architecture for Settings.
These are distinct photographs generated using built-in imagegen; the prompt is
in `docs/page-scenes-prompt.md`.

The current UI font is Unbounded, an extended geometric variable typeface with
Cyrillic, bundled with `fonts/Unbounded-OFL.txt`. Headings and selected accent
labels use a modest CSS oblique style. The reference font is inspiration; no
commercial font was extracted from the supplied picture.

Motion parameters and primary platform references are in `docs/motion-notes.md`.
`tools/package-preview.py [output-directory]` builds a self-contained preview:
photographs become short Blob URLs so large data URLs do not exceed Chromium's
CSS custom-property limit. Fonts remain embedded and no asset server is required.

The implemented 0.4.0 revision additionally uses `images/module-scenes.png`: a
three-cell photographic strip for profile search, the graph and DNS. Search uses
silhouettes behind glass; the graph uses people interwoven visually with thin
architectural columns and reflections; DNS uses network patch cables. It was
created with built-in imagegen. The generation prompt is recorded in
`docs/semantic-tiles-prompt.md`.

IBM Plex Sans is bundled from the official Google Fonts repository, with its
SIL Open Font License in `app/src/main/assets/fonts/OFL.txt`. Fonts are loaded
locally, including in the standalone HTML preview; no font service is contacted.

The approved preview is a visual reference, not a feature contract. The shipped
navigation explicitly includes History, DNS A/AAAA labels are non-interactive,
and unavailable imports/catalogs are plain availability descriptions. No mockup
records or fake progress are part of the APK. The decorative footer is removed.

The atlas was edited with built-in imagegen using the existing atlas as the edit
target and the user's two attached screenshots as color references. The layout
and nine scenes remain the same. CSS uses cooler neutral paper, icy blue
selection surfaces and deeper petroleum-blue ink. Reduced white overlays preserve
the color in photographs on tiles and internal page headers.

Color-correction prompt:

> Edit ONLY IMAGE 1, the 1536x1024 photographic atlas. Images 2 and 3 are COLOR GRADING REFERENCES ONLY, never put their text or UI in the output. Preserve the exact 3 columns x3 rows edge-to-edge grid, all nine scene compositions and object placement. Recolor and relight the atlas to match the much bluer icy cyan / deep petroleum-blue analog photo-print palette in references 2 and3. The original atlas is wrong: too muddy gray-green, olive, beige, dark neutral gray, brownish skin. Remove all olive/brown/warm gray casts. Apply distinctly cold cyan-blue photochemical monochrome with rich deep blue-teal shadows, luminous icy blue mist and neutral near-white paper highlights. Eye panel: blue skin, intense icy blue iris, bright bleached upper left, deep petrol-blue upper right. Corridor and datacenter: bright icy cyan lamps, blue hazy floors and teal-blue shadows. Other scenes similarly blue-cyan without mud. Moderate print grain ONLY within images, high key bleached photographic edges like the references. Palette target paper #eff2f2, icy blue #a6d4df, cyan midtone #69afc2, deep petrol #10566d. Preserve detailed photographic texture, no saturated electric neon, no glow UI, no text, no new objects, no borders, no gutters. Return ONLY the recolored atlas at original aspect and exact grid, not a screenshot or mockup.
