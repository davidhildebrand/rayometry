# RAYometry

Open **index.html** in a browser. No installation, server, internet connection, or build is needed. Keep the files together when moving the app. Nothing is uploaded or saved between sessions.

## Using the bench

- Drag the source or block to move it. Drag the incident ray to rotate the source, or select an item and drag its circular handle. You can also enter a board orientation (0° right, positive clockwise).
- Reset starts with a source inside glass: its ray hits the top at 50°, reflects internally, then exits a side face.
- Rotate the source to explore the critical angle. Drag it outside the glass to explore entry and exit refraction.
- Select one, three, or five parallel rays. For five rays, the middle ray supplies the live first-surface annotations.
- To rotate around an entry point, select **Surface entry point**. The middle ray’s first intersection becomes the pivot automatically. The source moves around that pivot and stays aimed at it. Rotation stops before the point would cease to be its first hit. Dragging the source keeps its direction fixed and updates the pivot to the new first intersection. Moving/rotating the block also updates the pivot. Only the dropdown (or Reset) changes the rotation mode. If the ray misses the block, reposition it to establish a pivot before rotating. The ray and white handle behave the same in both modes; only the center of rotation changes.
- Change both refractive indices in Media. Values must be finite and greater than zero.
- **Inspect** freezes editing. Click any marked intersection to see its normal, angles, and indices. **Edit** restores movement. Normal and angle switches control live annotations; The Normals and Angles checkboxes also control Inspect annotations.
- All optical angles are measured from the normal. `i` is incidence, `t` is transmission/refraction, and `r` is reflection. These differ from the board orientation control.
- Reset restores the entire original scene.

## Exploring triangular prisms

1. Under **Optical element**, choose **45°–45°–90° prism**. Its upper corner is labeled **45° apex**; the preset aims the source at the midpoint of the vertical left face.
2. Set surroundings to **1.00** and prism to **1.49** for plastic or **1.523** for glass. Select **1 ray**.
3. Select the ray source and choose **Surface entry point** so each trial uses the same entry point.
4. With the prism in its preset orientation, set source board orientation to **−10°, −20°, −30°, −40°, −50°**. These correspond to **10°, 20°, 30°, 40°, 50° incidence** at the left face. This shortcut applies only while the prism stays unrotated.
5. Use **Inspect** and click the second intersection to read the emergent angle. **Total deviation · δ** is the angle between the original incident direction and final emerging direction, shown for the middle ray's direct two-surface path. Return to **Edit** for the next trial.
6. Set source orientation to **0°** to investigate normal entry and TIR at the next face. The subsequent reflection and exit are traced too; there is no direct two-surface deviation readout for this path.
7. Starting near normal entry, drag the incident ray toward a slightly negative source orientation to locate the critical condition at the second face. It gently snaps, the grazing ray darkens, and the critical angle is highlighted. Inspect that second intersection for its values.
8. Explore minimum deviation by varying incidence with the surface pivot fixed. At the minimum, incident and emergent angles are equal.

Also available: **30°–60°–90°** and **equilateral** triangle presets. Corner labels identify their geometry. Reset still returns to the original rectangular-block TIR demonstration.

The Risley prism, retinal/apparent image demonstrations, graphing, and saved configurations are not implemented yet.

## Photon billiards

Choose **🎱 Billiards** in the bench toolbar. The ray source becomes a billiard cue with a photon ball, and a dark hole labelled **target** appears somewhere on the bench. Everything you set up in Edit (block, prism or curved block, both refractive indices, source position, rotation mode) is kept; Billiards only changes how the middle ray is presented.

- **Before the shot** only the incident leg is drawn: the ball, its path up to the first surface, that surface's normal and the incidence angle **i**. The refracted or reflected continuation is hidden, and the readout shows the incident angle and indices only.
- **Aim** by dragging the incident ray or the white handle (rotation is always about the ball in this mode), or type a board angle in the **Aim** box. **Drag the ball** itself to move it, for example out of the glass to shoot in from outside; its aim is kept.
- **Shoot** by pulling the cue back and releasing it, or press **Shoot**. The pull distance is shown but ignored: a photon's speed is fixed by the medium, so only the direction matters.
- The ball then travels the real traced path at **v = c/n**, visibly slower inside the block than outside, leaving its path behind it and revealing each surface's angles as it passes. It sinks when its center passes within the hole radius (20 board units, 6 mm); otherwise it leaves the bench and a dashed line shows the closest approach in millimeters. The full path, all angles, the readout and the **Deviation δ** arc (if enabled) are revealed either way.
- **Retry** re-arms the same hole; re-aiming after a shot does the same automatically. **New target** places a new hole. Attempts are counted per target, and each target is counted as sunk once.
- **New target** chooses a random aim within ±20° of the current aim that passes through the block and places the hole on the emerging leg, so a solution always exists, needs only a small adjustment, and usually cannot be reached by a straight shot around the block. If no such aim exists for the current scene, any direction is used. You can also drag the hole; it cannot overlap the block or leave the bench. After the ball or the hole is moved, the status reports whether a sinking aim exists for the new arrangement (scanning 0.25° steps).

The Normals and Angles checkboxes apply to the revealed annotations. Ruler and protractor stay available. Reset returns to Edit and clears the game. `BenchScene` exposes the pure parts: `randomTarget`, `hitTest`, `billiardLegs`, `shotPlan`, `ballAt`, `moveHole`, `holeFits` and `findSolution`; `app.js` adds the cue gesture and the `requestAnimationFrame` loop.

## Small architecture

- `physics.js`: pure vectors, polygon and exact semicircle boundary intersections, vector Snell law, and path tracing. Angles are radians, coordinates are board units with y downward. It exposes `Optics`; no DOM dependencies.
- `scene.js`: shape presets, defaults, ray-bundle creation, deviation readouts, critical-angle snapping, pivot constraints, and the photon-billiards target, hit test and timing. It exposes `BenchScene`.
- `measurements.js`: physical scale, ruler snapping, radius input conversion, and internal-ray extensions, separate from ray tracing.
- `app.js`: SVG rendering and pointer/form interactions. `index.html` and `styles.css` provide the interface.

Ordinary scripts work with local file URLs and static hosting. No hosting setup is included.

## Verification

Open **tests.html**, or run `node tests.js` if Node is installed. The same physics code is tested in both environments. `node tests-controls.cjs` checks control handlers with a small DOM fixture; it does not replace visual browser testing.

## Deliberate limits

One solid object (rectangle, triangular prism, or semicircle preset) and one source. Choosing another preset replaces that object and aims the source at it; indices and rotation mode are preserved. The semicircle starts with three rays; other presets retain your ray count. Only the transmitted branch is drawn below the critical angle; at TIR only reflection is drawn. A critical-angle ray follows the tangent to the workspace edge. Corner hits and sources exactly on boundaries require repositioning. Trapped paths stop after 20 interactions with a visible message. The physical bench scale is 0.3 mm per board unit (300 × 195 mm overall). The default semicircle has a 90 mm (9 cm) diameter and 45 mm (4.5 cm) radius. No intensity, wave optics, image formation, other curved shapes, thin elements, or multiple simultaneous objects are modeled yet.

When dragging the source ray or handle, rotation gently snaps when a source-angle adjustment of at most 0.35° reaches a critical interaction on the middle ray’s path, including a prism’s exit face. Continue dragging to leave the snap. The grazing exit ray darkens and the angle is highlighted as θc. Numerical orientation entry stays exact and does not snap.

Triangular prisms also gently snap within 0.35° of minimum deviation during source-ray/handle dragging, in either pivot mode. A highlighted δmin readout marks equal incidence and emergence for direct two-face transmission through a prism denser than its surroundings. Continue dragging to release; numeric angles do not snap. Rectangular blocks have no minimum-deviation snap.

Use **Minimum deviation** or **Critical angle** in the properties panel to jump to the exact condition. Both buttons keep the middle ray’s current first entry point fixed and preserve the manual rotation dropdown. Critical angle targets the first higher-to-lower index transition on the current path (usually the second face for an external prism source). If the condition cannot be reached on the current faces within the board, the scene is left unchanged and a message explains why.

In **Inspect**, choose **Show all angles** to reveal angles and normals at every traced interaction, for all rays. Click an intersection to keep updating its sidebar readout. **Show selected only** restores the focused view. Show all angles checks Normals and Angles; Hide all angles unchecks them (and Deviation). Each checkbox can be re-enabled independently, and its setting carries back to Edit.

The **Deviation δ** checkbox draws an angle arc at the middle ray’s exit point. Its dashed purple reference is parallel to the original incoming ray, so δ measures total change in direction, not an angle to the surface normal. It works in Edit and Inspect for direct two-surface transmitted paths; at minimum deviation the label reads δmin.

## Exploring a curved block

Choose **Optical element → Semicircular block**. Three parallel rays enter the flat face normally and converge after leaving the curved face. Set the material to **1.49** for plastic or **1.53** for glass. **C** marks the circle's center and **A** its curved vertex; the dotted line is the optical axis.

Select the semicircle and enter **180°** orientation to put the curved face toward the source. Refraction occurs at both boundaries, including the flat exit. In Inspect, **Show all angles** shows the curved-surface normals along the radii. The boundary uses an exact circle, not polygon facets.

Internal-ray extensions and millimeter measurements are available under Measure & explore. Automatic dioptric-power calculations and a lens clock are not implemented. Do not use the final emerging-ray crossing as the isolated curved surface's secondary focus: the flat exit has refracted those rays again.

Select the curved block in Edit mode and drag the **gold diamond** at its vertex. Moving inward flattens the circular face (larger radius); moving outward rounds it back to a semicircle (smaller radius). The flat face retains its height and position. Curve depth ranges from one fifth of the half-height to the full half-height. The radius shown in properties is in millimeters and can be entered exactly (45–117 mm). Refraction, normals, center of curvature, and bounds update with the true circular geometry; selecting the semicircle preset restores the original curve. Inspect hides the shaping handle.

## Distance and focal-point exploration

- **Dot grid** toggles dots spaced **5 mm** apart. The **20 mm** scale bar remains visible, independent of browser zoom or window size.
- Select a curved block to enter its **Radius** in millimeters. This changes curvature while keeping the flat face 90 mm high, matching the gold-handle adjustment. Its unsigned radius ranges from 45 mm (semicircle) to 117 mm (flatter cap).
- Use the **Ruler** button at the upper-left of the bench. Drag either endpoint to measure; drag the ruler's middle to translate it without changing length. It remains usable in **Inspect**, where optical elements stay locked.
- **Snap ruler to points** snaps near A, C, surface hits, and visible ray crossings. With internal extensions enabled, their crossings are also available. Snapping happens while dragging an endpoint; the ruler does not follow elements when they move.
- **Extend internal rays** works for curved-face-first transmission through a curved block's flat exit. Blue dashed lines continue the internal direction without applying the exit refraction. The solid rays still show the real two-surface path.
- To locate a secondary focus for the curved surface, use the intersection of the extended internal rays, not the solid emerging rays. Use narrow parallel rays aligned to the optical axis; a general crossing is not automatically labeled a focal point.
- Measure from A to the relevant crossing, or A to C for radius. The ruler reports an **unsigned length**. Apply the appropriate sign convention yourself when using focal lengths or radii in equations, and convert mm to meters when calculating diopters. A small spread in crossings can occur with exact circular-surface tracing; no automatic focal-point or power calculation is imposed.

## Bench tool buttons

**Ruler** and **Protractor** at the upper-left of the bench toggle independently. Hiding a tool preserves its position; Reset hides both and restores their initial positions. Both tools remain movable in Inspect without moving the optical elements.

For the protractor, drag the center or transparent face to position it. Drag the outer teal handle to rotate its baseline, and the gold arm to read an angle from 0° to 180°. For an incidence or refraction measurement, place the center at the surface intersection and align the baseline with the relevant normal. The tool measures the angle you set; it does not automatically reveal an optical answer.

This tool was designed by Kim Meier and created with Codex.

## Binocular Vision

Open **binocular.html**, or choose **Binocular Vision** in the header. **Optical Bench** returns to the existing bench. Both pages work offline, without installation or a server.

Drag the black star left/right or nearer/farther. Drag the blue left-eye or pink right-eye circular handle to change that eye's direction independently. The labeled numeric controls provide a keyboard alternative. Target movement never turns the eyes automatically. While dragging, eye directions snap to the star’s apparent direction within 1.5°, and the target snaps to horizontal zero within 0.12 schematic units. Continue dragging beyond these thresholds to release. Numeric inputs are never snapped; unreachable fixation outside the ±45° eye range is not snapped. Reset returns both eyes to pointing at the centered target and restores both visibility toggles.

The world view uses a closer framing with larger eyes and a deeper, pale shaded band. Dashed lines continue each visual axis upward beyond the target plane (farther away in world space); no extensions run below the eyes. The world framing follows the target plane, leaving less room above it and more visible separation from the eyes without changing the geometry. The framing widens as needed to keep extreme target-plane intersections visible. The orange target plane passes through the star. Small colored dots mark the fixation intersections. The eye panels show **target-plane slices, centered where each eye points**, at the same spatial scale. They are not angular visual-field displays: increasing target distance does not necessarily move the star toward the panel center. The green/yellow split follows the physical target, matching the supplied teaching PDF. Plane and intersection toggles affect the world view only.

Coordinates use schematic units: x increases rightward and z forward (upward on screen). Eyes stay at x = −1 and +1, z = 0. Target x ranges from −3 to +3 and z from 2 to 10. Eye angles range from −45° to +45° from straight ahead; positive turns right. The default target is (0, 6), with each eye aimed directly at it.

`binocular-geometry.js` is a pure module exposed as `BinocularGeometry` in browsers and through CommonJS in Node. `defaults()` returns fresh state; `bearing(eyeX, target)` returns radians; `evaluateEye(eyeX, angle, target)` and `evaluate(state)` return target-plane intersections, target bearings, signed angular offsets, and slice offsets. For each eye, intersection x = eye x + target z × tan(angle). Without a prism, panel displacement = target x − intersection x; with a prism, use the apparent target-plane position instead. Negative displacement appears left, positive right. Geometry has no DOM or bench-engine dependency. `binocular-app.js` handles controls and SVG rendering; `binocular.css` scopes the new layout.

### Binocular checks

Open **binocular-tests.html** or run `node binocular-tests.js`. Run `node binocular-tests-controls.cjs` for control-handler checks. Existing bench checks remain `node tests.js` and `node tests-controls.cjs`. Control fixtures do not replace browser visual verification.

With eyes at (−1, 0), (+1, 0), target at (0, 6), aim at the following points:

| Left eye aims at | Right eye aims at | Left-eye target | Right-eye target | Slice offsets (left, right) |
| --- | --- | --- | --- | --- |
| (0, 6) | (0, 6) | Center | Center | 0, 0 |
| (0, 6) | (0, 3) | Center | Right | 0, +1 |
| (0, 3) | (0, 6) | Left | Center | −1, 0 |
| (0, 3) | (0, 3) | Left | Right | −1, +1 |
| (0, 9) | (0, 9) | Right | Left | +⅓, −⅓ |

The second and fourth fixtures reproduce pages 2 and 1, respectively, of “over converged prism example.pdf.” For manual review, use directions ±9.4623° for depth 6, ±18.4349° for depth 3, and ±6.3402° for depth 9 (positive for the left eye, negative for the right). Rounded numeric angles may leave a negligible residual displacement.

Additional tests cover off-center fixation, reflection symmetry, independent eye movement, continuous passage through alignment, finite values at all supported limits, input rejection, pointer cancellation, toggles, and reset. Browser review should include desktop and narrow layouts, keyboard inputs, dragging, extreme positions, and navigation back to the bench.

Each perceptual panel now has a schematic retinal arc beneath it. The fovea stays at the bottom center while the target image moves along the arc as the target or eye direction changes. The retina is shown in eye-fixed top-down coordinates, not as an examiner’s view of the fundus. Its unit-radius position is x = −sin(angular offset), z = −cos(angular offset); thus a target seen right of fixation lands left of the fovea. The visible arc shows a magnified region around the fovea: retinal angular displacements are exaggerated threefold on a drawn ±55° arc, so the actual displayed range is about ±18.3°. Symbols are enlarged for readability; the underlying geometry is unchanged. Images outside it are omitted with directional edge cues; their calculated positions are never clamped. Retinal image placement uses the angular offset with the same fixed threefold display magnification in both eyes, independently of the spatial slice scale above it. This is a schematic directional model, not an anatomical image-size calculation.

Nasal/temporal labels, clinical classification, automatic correction, presets, and practice mode remain deferred.

### Linked scene objects

An apple sits 0.9 schematic units left of the star, and a tree sits 0.9 units right. Dragging the star or entering its position translates all three together on one depth plane. Each object has independently calculated perceptual and retinal positions through `BinocularGeometry.scene(state)`. Eye snapping continues to use the star only, using its apparent direction when a prism is present. The two perceptual slices share a fixed close scale of 100 SVG units per schematic unit. Objects can leave the visible frame and are clipped rather than triggering auto-zoom. The retinal display magnification also stays fixed, preserving changes in retinal spacing with distance.

### Prism exploration

Under the world view, choose **None**, **Left eye**, or **Right eye**, then **Base in** or **Base out** and an amount from **0–20 Δ**. The slider and numeric input update continuously. The slider gently snaps to exact star-on-fovea alignment within 0.35 Δ when the required power is in range for the selected base direction. Continuing past that band releases the snap. Numeric entries remain exact; rounded display values do not round the underlying snapped geometry. Adding a prism starts at zero power. Moving or removing it preserves its settings; Reset removes it and restores zero. Changing prism settings leaves both eye directions and the physical scene unchanged. Only the selected eye’s perceptual and retinal images change.

The purple wedge shows its orientation by its shape, without base/apex text labels. Its lower face and apex stay fixed as amount changes; the other face pivots about the apex. Its width contains the foveal path’s eye-side crossing and stays fixed as prism power changes. Base out points left for the left eye and right for the right eye; base in reverses those directions. Solid blue/pink paths now trace what is foveated: from the eye along its visual axis to the prism, then through the prism to the physical target plane. Dashed blue/pink lines show the unchanged eye direction and continue beyond the target plane. Fixation dots mark the solid path’s target-plane intersections. Without a prism, the two paths coincide up to that plane. No brown object rays or purple apparent-star extension are drawn. The apple and tree remain visible in the scene and image panels. `foveatedPath(state, side)` supplies the world path; tests verify that an object at its intersection lands exactly on the fovea under the same forward prism model.

The model uses an ideal thin angular deflector: deviation = atan(power / 100). It is a conceptual prism-power model, not Snell tracing through a material wedge; wedge thickness is symbolic, and aperture/dispersion are not modeled. The prism lies at schematic depth 1 in front of the selected eye. Each object’s ray crossing is solved so the two segments meet there, reach the eye, and turn toward the base by the specified deviation. The reverse direction of the ray arriving at the eye gives the apparent bearing. Projecting that bearing onto the target plane gives the perceptual slice position; subtracting eye direction and reversing the angle gives the retinal position. The schematic vertex separation is not a clinical measurement or prescription calculation.

`defaults()` now includes `prism: {eye: 'none', base: 'out', power: 0}`. Earlier states without a prism remain supported. `evaluateEye` optionally accepts `{power, baseSign}`; `evaluate` and `scene` resolve placement/base from state. Results retain physical target bearing and pointing intersection, and additionally expose `apparentBearing`, `apparentX`, `prismPoint`, `deviation`, and `physicalSliceOffset`. `sliceOffset` is the perceived displacement. The perceptual panels use fixed magnification, while world framing reserves the full 0–20 Δ envelope; changing prism amount does not move the other eye’s display through auto-zoom.

Prism checks cover all eye/base combinations, exact zero-power equivalence, power conversion, continuous connected light paths, scene and eye invariance, mirror symmetry, extreme inputs, invalid amounts, removal/reset, slider synchronization, and snapping through the prism. A PDF-derived over-converged example is neutralized with base out; an under-converged example is neutralized with base in. Both are calculated from the geometry rather than special display cases.

Optical conventions were checked against the [National Academy of Opticianry’s prism teaching material](https://www.nao.org/wp-content/uploads/2020/11/Not-Your-Basic-Prism.pdf): light bends toward the base and the perceived image shifts toward the apex, consistent with the supplied course PDF. Browser visual review is still required; automated verification here uses geometry and DOM fixtures.

The companion-object spacing is chosen so either apple or tree can reach the fovea within 20 Δ from the default star fixation. Different target distances or eye deviations can require more power; prism-diopter conversion has not been rescaled.
