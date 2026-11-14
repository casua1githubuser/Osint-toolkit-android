# Navigation icons

The 0.9.1 navigation and Home card glyphs use the Tabler outline icon system as their source,
with wide adaptations for this app. Original source SVGs are retained in
`navigation-icons/`; the MIT license is shipped in
`app/src/main/assets/TABLER-LICENSE.txt`.

Source: https://github.com/tabler/tabler-icons/tree/main/icons/outline

- Search: binoculars, with the two optical groups spaced farther apart.
- Graph: a horizontal adaptation of git-fork, with rounded branch junctions.
- Home: home-2, with a wider roof/body and a central doorway.
- Databases: the upper server-2 storage unit, retaining its status dot and slot.
- Settings: two rows of adjustments-horizontal, with extended control tracks.
- Home card DNS/history: world and history from the same source set.

SVGs preserve their intrinsic aspect ratio in a 40x24 CSS viewport. Paths use
`vector-effect: non-scaling-stroke` and a consistent 2px screen-space stroke.
There is no bitmap upscaling or nonuniform SVG stretching. The navigation
selection plates retain their separate 16:9 aspect ratio.
Home card icons use a 40x28 viewport and the same 2px stroke. Navigation and
cards reuse shared SVG artwork for Search, Graph, Databases and Settings.
