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
