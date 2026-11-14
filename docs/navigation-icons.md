# Navigation icons

The navigation and Home card glyphs use the Tabler outline icon system as their source,
with wide adaptations for this app. Original source SVGs are retained in
`navigation-icons/`; the MIT license is shipped in
`app/src/main/assets/TABLER-LICENSE.txt`.

Source: https://github.com/tabler/tabler-icons/tree/main/icons/outline

- Search: binoculars, with the two optical groups spaced farther apart.
- Graph: a horizontal adaptation of git-fork, with rounded branch junctions.
- Home: home-2, with a wider roof/body and a central doorway.
- Databases: the upper server-2 storage unit, retaining its status dot and slot.
- Settings: two rows of adjustments-horizontal, with extended control tracks.
- Since 0.9.2, the Home DNS/history cards use app-specific wide browser-window
  and event-journal glyphs, styled to match the same 2px outline system. The
  circular and experimental elliptical variants were replaced.

SVGs preserve their intrinsic aspect ratio in a 40x24 CSS viewport. Paths use
`vector-effect: non-scaling-stroke` and a consistent 2px screen-space stroke.
There is no bitmap upscaling or nonuniform SVG stretching. The navigation
selection plates retain their separate 16:9 aspect ratio.
Home card icons use a 40x28 viewport and the same 2px stroke. Navigation and
cards reuse shared SVG artwork for Search, Graph, Databases and Settings.

Since 0.10.0 the same factory also renders icons in every internal page:
search/DNS forms, result badges, history rows, storage tabs and graph nodes.
The previous independent path collection is removed. Domain and history aliases
always resolve to the shared browser-window and journal glyphs.

Utility icons come from Tabler's id, player-play, arrow-right, plus, minus,
arrows-maximize, stack-2, check, x and chevron-right sources, retained alongside
the earlier source files. The graph's embedded query glyph uses this factory
as well. Functional icon strokes stay 2px; decorative vectors and the OSINT
wordmark keep their separate rendering rules.
