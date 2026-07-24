# Visual Editor System Design

## Overview

The visual editor is a React Flow-based node graph editor for building Bluesky feed filter logic. It combines two complementary systems for expressing boolean logic: **wire-based logic** (for quick connections at the root level) and **container-based logic** (for structured nesting at deeper levels).

## Architecture Decisions & Reasoning

### Why Two Systems (Wires + Containers)?

We explored several approaches:
1. **Colored handle connections** (original) — AND/OR determined by which colored port you connected. Confusing because users had to remember orange=OR, blue=AND.
2. **Container-only** (nesting) — AND/OR/N-of as visual boxes you drop conditions into. Clean but deep nesting gets cramped.
3. **Wire-only** — All logic via connections between nodes. Flexible but complex feeds become spaghetti.
4. **Hybrid** (current) — Wires for the root level flow + simple logic pairs, containers for structured nesting. Best of both.

### Why Junction Nodes?

Condition nodes (Text Contains, Language, etc.) are pure filters — they only have logic ports, no flow ports. They cannot sit in the flow path (START → END). This prevents ambiguous situations where a node is both in the flow AND has logic connections.

Junction nodes bridge flow and logic. They have:
- Green flow ports (left/right) for the pipeline: START → Junction → END
- Grey logic ports (all 4 sides) for connecting conditions

This separation means:
- Simple feeds: START → Junction → END, with one condition wired to the junction
- Complex feeds: Multiple junctions chained, each collecting different condition groups

### Why Condition Nodes Have 4 Logic Ports?

Originally conditions had 2 flow ports (left/right green) + 2 logic ports (top/bottom grey). When we decided conditions shouldn't be in the flow path, we converted all 4 ports to logic ports. This gives more connection options — you can wire conditions from any direction.

### Why Per-Port Logic Modes?

Each port on a node independently tracks its logic mode (AND/OR/N-of). This means a single junction can have AND conditions on its top port and OR conditions on its bottom port:

```
[Language] ──AND──┐ (top)
[Media]    ──AND──┤
                  ↓
START → [Junction] → END
                  ↑
[Text]     ──OR───┤ (bottom)
[Hashtag]  ──OR───┘
```

This reads: (Language AND Media) AND (Text OR Hashtag)

### Why Arrows Point Inward?

Logic wire arrows point toward the "root" node — the node that collects and combines its children. The auto-direction algorithm calculates each node's "flow depth" (how many hops from the flow path). The node closer to flow becomes the target (root), arrows point toward it.

This creates a visual tree that reads inward toward the flow path.

### Why One Outgoing Logic Edge Per Node?

Each node can only be the SOURCE of one logic edge (can only point to one parent). This prevents diamonds/forks where a node belongs to two different logic groups simultaneously, which creates ambiguous evaluation. A node CAN have multiple incoming edges (it's a root collecting children).

## Node Types

### Flow Nodes (have green flow ports)
- **START** — Entry point, output-right only
- **END** — Exit point, input-left only (also has top/bottom/right for injection/sorting/fixed position)
- **Junction** — Pass-through bridge between flow and logic. Has flow ports (left/right) AND logic ports (all 4 sides). Always passes — its only job is organizing logic.

### Logic Container Nodes (have green flow ports + zoom-in)
- **AND** — Double-click to zoom in. All children must match.
- **OR** — Double-click to zoom in. Any child can match.
- **N-of** — Double-click to zoom in. At least N children must match. Click to configure N.

### Condition Nodes (logic ports only, no flow)
All condition nodes have 4 grey diamond logic ports (top/bottom/left/right). They filter posts based on their configured rules.

- **Text Contains** — Keyword matching with field selection
- **Regex Contains** — Regular expression matching
- **Language** — Language code matching
- **Post Type** — Post/reply/quote filtering
- **Author** — Author DID or list matching
- **Media Type** — Images/video/link/quote filtering
- **Hashtag/Tags** — Hashtag and outline tag matching
- **Labels** — Content label matching
- **Post Date** — Age/time filtering with math operators
- **Engagement** — Like/repost/reply count thresholds
- **Post Structure** — Reply depth, is-quote, etc.
- **Mentions** — Mentioned user matching
- **Links/URLs** — URL/domain matching
- **Image** — Image dimensions, count, aspect ratio
- **Video** — Video properties, GIF detection

### Other Nodes
- **Scoring nodes** (Recency Boost, Engagement Score, Custom Score) — modify post scores
- **Sorting nodes** (Chronological, By Score, etc.) — determine post order
- **Injection nodes** (Rotating Posts) — insert posts after sorting
- **Fixed Position nodes** (Dynamic Pinned, Featured Post) — guaranteed positions

## Port System

### Flow Ports (green, + and -)
- Left: input (−), Right: output (+)
- Only on START, END, Junction, and container nodes
- Green color, show +/− symbols
- Connections create the main pipeline

### Logic Ports (grey diamonds, all 4 sides)
- Bidirectional — both source and target at same position
- Grey diamond (◆) when unconnected
- When connected, diamond is replaced by a colored mode label:
  - **AND** — blue pill
  - **OR** — orange pill  
  - **N-OF** — purple pill with −/+ stepper buttons
- Click the port label to cycle: AND → OR → N-OF → AND
- For N-OF: click +/− buttons on the port to adjust N, click the number to cycle mode
- Each port independently tracks its logic mode

### Port Mode Storage
Logic modes are stored on the node data:
- `logicModeTop`, `logicModeBottom`, `logicModeLeft`, `logicModeRight` — 'and' | 'or' | 'nof'
- `logicNTop`, `logicNBottom`, `logicNLeft`, `logicNRight` — number (for N-of)

## Wire System

### Flow Wires (green, with arrows)
- Connect flow ports (output-right → input-left)
- Always have arrow markers showing direction
- Represent the main pipeline: START → ... → END

### Logic Wires (colored, with arrows + labels)
- Connect logic ports (any logic-* to any logic-*)
- Arrow direction auto-set based on flow depth (points toward flow path)
- Color matches the target port's logic mode:
  - Blue = AND
  - Orange = OR
  - Purple = N-OF
- Midpoint label shows AND/OR/N-OF text (rendered via EdgeLabelRenderer above SVG)
- **Click the wire label** to cycle logic mode — updates all wires on the same target port
- Labels rendered as HTML overlay (EdgeLabelRenderer) so they always appear above other wires

### Wire Label Toggle
When you click a wire label:
1. The logic type cycles: and → or → nof → and
2. ALL edges on the same target port update (color, label, type)
3. The target node's logicMode for that port updates
4. For N-of, the wire label just shows "N-OF" (the actual number is on the port)

### One Parent Rule
Each node can only be the SOURCE of one logic edge. This is enforced in onConnect:
1. Pre-check: if both nodes already have outgoing logic edges, block
2. Post-direction-check: if the resolved leaf already has an outgoing logic edge, block
3. Toast notification shown when blocked: "Both nodes already have a logic parent" or "This node already has a logic connection"

### Auto-Direction Algorithm
When a logic wire is drawn, the system determines which node should be the source (leaf) and which should be the target (root):

1. Calculate "flow depth" for each node — how many hops from the nearest flow-connected node
2. The node with LOWER depth (closer to flow) becomes the target (arrows point toward it)
3. If equal depth: prefer the node that already has a logicMode set
4. If still equal: prefer the node with more existing incoming logic connections
5. The target node gets a logicMode set if it doesn't have one

## Container System (Zoom-In Navigation)

### How It Works
- AND/OR/N-of nodes are containers you can zoom into
- Double-click a container node → canvas shows only that container's children
- Breadcrumb bar at top shows navigation path: Root / Content Match / Keyword Match
- Click breadcrumb items to navigate back up

### Inside a Container
- **Auto-stacking**: dropped nodes snap to x=100, spaced 120px vertically
- **Locked X position**: nodes can only be dragged vertically (reorder), not horizontally
- **Logic wires work**: you can draw AND/OR/N-OF wires between items for sub-grouping
- **No flow ports**: no START/END inside containers, everything is implicitly combined by the container's type
- **Nested containers**: drop AND/OR/N-of inside another container, double-click to go deeper
- **Info panel**: top-right shows "AND — All items must match" (or OR/N-OF)

### Container Parent Tracking
Every node has `data.containerParent`:
- `null` = root level (visible when not zoomed in)
- `"and-123"` = inside the container with that ID

The visibility filter: `nodes.filter(n => n.data?.containerParent === currentContainer)`

### Navigation Context
`NavigationContext` manages the zoom state:
- `path` — array of `{id, label}` representing the breadcrumb trail
- `currentContainer` — the ID of the container we're inside (last item in path), or null for root
- `zoomIn(id, label)` — push onto path (used by double-click on container nodes)
- `zoomOut()` — pop from path
- `navigateTo(index)` — jump to specific breadcrumb level
- `navigateToContainer(id, label, allNodes)` — build full ancestor path and set it (used by tree panel)

## Tree Panel

### Purpose
Right-side panel showing the full feed structure as a collapsible outline. Provides overview without zooming in/out.

### Structure
- Shows root-level nodes grouped by junction connections
- Junction children show their logic type badge (AND/OR/N-OF)
- Container nodes are expandable — click arrow to expand/collapse, click name to navigate
- Condition nodes show type, summary (keywords, languages, etc.), and exclude status
- Nested containers show recursively

### Interaction
- **Arrow (▶/▼)**: expand/collapse children in the tree
- **Container name**: click to navigate (zoom into that container)
- **Collapsible**: entire panel can be collapsed to a thin strip

### Data Flow
Canvas passes nodes/edges to App via `onStateChange` callback (fires on every change). App passes them to TreePanel as props.

## Save/Load System

### Save Format (Version 2)
Stable format that survives editor code changes:
```json
{
  "version": 2,
  "savedAt": "2026-04-20T...",
  "nodes": [
    {
      "id": "text-123",
      "type": "text",
      "position": {"x": 100, "y": 40},
      "containerParent": "and-456",
      "config": {"keywords": ["urbanism"], "exclude": false}
    }
  ],
  "edges": [
    {
      "source": "text-123",
      "target": "junction-1",
      "sourceHandle": "logic-bottom",
      "targetHandle": "logic-top",
      "logicType": "and"
    }
  ]
}
```

### Load Process
1. Check version (< 2 = auto-clear old format)
2. Rebuild React Flow nodes from stable format (spread config into data)
3. Infer logicModeTop/Bottom/Left/Right from edge logicTypes
4. Rebuild React Flow edges with correct colors, arrows, zIndex

### Export Format (Version 1.0)
Clean semantic format for sharing/evaluation:
- Nodes sorted by flow traversal order (START first, END last)
- Logic-linked nodes appear after their flow-path partner
- Edges typed as "flow" or "logic" with logic type
- Config data only (no functions, no internal state)
- containerParent shows nesting hierarchy

### Import
- Accepts export format
- Auto-fixes node IDs to start with type prefix (ConditionNode uses `id.split('-')[0]` for type detection)
- Builds ID remap for edges
- Infers logicModes from edge data
- Rebuilds full React Flow state

## Connection Validation

### Rules
1. **Self-connections blocked**
2. **Logic-to-logic**: any logic handle to any logic handle (validated)
3. **Logic-to-flow mixed**: blocked (can't connect logic port to flow port)
4. **Condition flow**: blocked (conditions have no flow ports)
5. **Junction**: can do both flow AND logic (not in isConditionNode list)
6. **Scoring/Sorting/Injection**: follow their own rules for END node ports
7. **One parent rule**: enforced in onConnect, not in validation

### Edge Colors
- Flow: green (#51cf66)
- Logic AND: blue (#4a9eff)
- Logic OR: orange (#ff9500)
- Logic N-OF: purple (#9b59b6)
- Sorting: purple (#9775fa)
- Injection: red (#ff6b6b)
- Fixed position: yellow (#ffd43b)

## Toast Notifications
Red toast at bottom-center of canvas, auto-dismisses after 3 seconds. Used for:
- "Both nodes already have a logic parent"
- "This node already has a logic connection"

## Key Files

### Nodes
- `src/nodes/ConditionNode.jsx` — All condition types (type determined by id prefix)
- `src/nodes/LogicNode.jsx` — AND/OR container (compact block with double-click zoom)
- `src/nodes/NOfNode.jsx` — N-of container
- `src/nodes/JunctionNode.jsx` — Pass-through junction (flow + logic ports)
- `src/nodes/StartNode.jsx` — START node
- `src/nodes/EndNode.jsx` — END node
- `src/nodes/ScoringNode.jsx` — Scoring blocks
- `src/nodes/SortingNode.jsx` — Sorting blocks
- `src/nodes/InjectionNode.jsx` — Injection blocks
- `src/nodes/NodeStyles.css` — All node and port styling

### Components
- `src/components/Canvas.jsx` — Main canvas (React Flow instance, all handlers)
- `src/components/Sidebar.jsx` — Left sidebar with draggable node palette
- `src/components/OrderedEdge.jsx` — Custom edge with AND/OR/N-OF labels (EdgeLabelRenderer)
- `src/components/Breadcrumb.jsx` — Navigation breadcrumb bar
- `src/components/TreePanel.jsx` — Right-side structure tree
- `src/components/Canvas.css` — Canvas wrapper styles
- `src/components/Breadcrumb.css` — Breadcrumb styles
- `src/components/TreePanel.css` — Tree panel styles

### Logic
- `src/utils/connectionValidation.js` — validateConnection() and getEdgeColor()
- `src/utils/conditionEvaluator.js` — Evaluates individual conditions against test posts
- `src/utils/graphEvaluator.js` — Evaluates entire graph (finds flow path, evaluates logic nodes)
- `src/utils/edgeOrder.js` — Calculates evaluation order numbers on edges
- `src/utils/keyboard.js` — Keyboard shortcut handling

### Context
- `src/contexts/NavigationContext.jsx` — Zoom-in navigation state (path, currentContainer)
- `src/contexts/HistoryContext.jsx` — Undo/redo state

### Constants
- `src/constants/nodeTypes.js` — Maps type strings to React components
- `src/constants/blocks.js` — Block type definitions
- `src/constants/edges.js` — Default edge styles and color constants
- `src/constants/grid.js` — Grid snap settings
- `src/constants/initialNodes.js` — Default START/END nodes
- `src/constants/languages.js` — Language code list
- `src/constants/textFields.js` — Searchable text field definitions

### Modals (condition configuration)
Each condition type has a modal in `src/components/`:
KeywordModal, RegexModal, LanguageModal, PostTypeModal, AuthorModal, MediaTypeModal, HashtagModal, LabelsModal, DateAgeModal, NOfModal, EngagementModal, PostStructureModal, MentionsModal, LinksModal, ImageModal, VideoModal, etc.

Modal handlers: `src/components/handlers/modalHandlers.js`
Node handlers: `src/components/handlers/nodeHandlers.js`

## Orphaned Node Detection

### Rule
Only nodes reachable from START via any edge chain (flow or logic) are counted in feed evaluation. Orphaned nodes (floating, not connected to the START-END chain) are visually greyed out and ignored by the evaluator.

### Implementation
1. **Detection**: BFS from START node, following all edges in both directions (flow + logic). Any node not reached is orphaned.
2. **Visual**: Orphaned nodes get `opacity: 0.4` and class `orphaned` on the canvas.
3. **Tree Panel**: Orphaned nodes get `opacity: 0.35` with strikethrough text and class `tree-orphaned`.
4. **Data**: Each node receives `data.isOrphaned` boolean, computed in `connectedNodeIds` memo.
5. **Evaluation**: The Python backend evaluator (not yet built) will trace from START to END and only evaluate reachable nodes. Orphaned nodes are skipped entirely.
6. **Per-level**: Orphan detection runs per navigation level. Inside a group, it traces from that group's START node.

### Why Both Directions?
Logic wires are semantically bidirectional (AND/OR is commutative). A condition node connected via a logic wire to a junction that's in the flow path IS reachable, even though the logic wire's arrow points from the condition toward the junction. The BFS follows edges in both directions to catch this.

## Known Issues / TODO

1. **ConditionNode type detection** uses `id.split('-')[0]` — fragile, should use node.type directly but ConditionNode doesn't receive its own type as a prop from React Flow
2. **Graph evaluator** needs updating to work with new wire-based logic (currently expects old handle names and container parentNode)
3. **Container auto-stacking** works on drop but doesn't re-stack when nodes are deleted
4. **N-OF on wires** — wire label shows "N-OF" but doesn't show the actual N value (by design — N is on the port)
5. **Tree panel** doesn't show wire-based logic between non-junction root nodes
6. **Save format** stores logicMode in config object, load correctly reads it back via spread + inference from edges
7. **Flow edges in tree** — junction children connected via flow (not logic) may show incorrectly

## Design Principles

1. **Colorblind-safe**: Never rely on color alone. Every color has a text label (AND/OR/N-OF on wires and ports).
2. **No emojis in UI**: User preference. Use text and symbols.
3. **Redundant signals**: Wire color + wire label + port label all show the same information. Three ways to read the logic.
4. **Progressive complexity**: Simple feeds use just wires. Complex feeds add containers. The system scales.
5. **Predictable**: One parent rule prevents ambiguous logic. Container type defines child combination. No surprises.
6. **`var` not `const`/`let`** in admin tab HTML scripts (from Near You convention, not applicable here since this is React/Vite).
