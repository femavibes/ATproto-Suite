# Connection System Analysis

## Current Implementation (React Flow)
- **Simple**: Left input, right output only
- **All connections look the same**: No visual distinction
- **No conditional branches**: Can't create AND/OR logic visually
- **Canvas.jsx**: 633 lines (getting large, should split)

## Legacy Implementation (Multiple Ports)

### Condition Nodes Have 4 Connection Points:

#### **Left Side (OR Logic - Parallel)**
- **Input (port 0)**: 70% down - Receives posts for OR evaluation
- **Output (port 4)**: 30% down - Sends posts to next OR condition
- **Color**: Orange (#ff9500)
- **Use**: Chain conditions in parallel (any can match)

#### **Right Side (OR Logic Continuation)**
- **Input (port 3)**: 70% down - Receives from previous OR condition
- **Output (port 7)**: 30% down - Posts that pass continue
- **Color**: Orange (#ff9500) for conditions, Green (#51cf66) for continue flow
- **Use**: Continue flow after conditions pass

#### **Top/Bottom (AND Logic - Sequential)**
- **Input Top (port 1)**: Receives posts for AND evaluation
- **Input Bottom (port 2)**: Receives posts for AND evaluation
- **Output Top (port 5)**: Posts that pass go up
- **Output Bottom (port 6)**: Posts that pass go down
- **Color**: Yellow/Blue (#4a9eff) for AND logic
- **Use**: Chain conditions sequentially (all must match)

### Key Concepts:

1. **OR Logic (Parallel)**: 
   - Left/right ports
   - Conditions evaluated in parallel
   - Any condition can match
   - Example: "Text contains X" OR "Language is Y"

2. **AND Logic (Sequential)**:
   - Top/bottom ports
   - Conditions evaluated sequentially
   - All conditions must match
   - Example: "Text contains X" AND "Language is Y"

3. **Continue Flow**:
   - Right output (port 7) → Left input (port 0)
   - Green arrows
   - Posts that pass continue to next stage

4. **Conditional Branches**:
   - Top/bottom outputs (ports 5/6)
   - Different paths based on condition result
   - Can merge back later

## Issues with Current System:

1. **No visual distinction** between OR/AND logic
2. **Can't create complex logic** without explicit AND/OR nodes
3. **All connections look identical** - confusing
4. **No conditional branches** - can't route posts differently
5. **File size** - Canvas.jsx is 633 lines, should be split

## Proposed Improvements:

### Option 1: Add Multiple Handles to Condition Nodes
- Add top/bottom inputs/outputs for AND logic
- Keep left/right for OR logic
- Color-code connections (green=continue, orange=OR, blue=AND)
- Add visual indicators on connections

### Option 2: Simplify with Visual Indicators
- Keep simple left/right connections
- Add connection labels (AND/OR)
- Use different line styles (solid=dashed, colors)
- Click connections to toggle AND/OR

### Option 3: Hybrid Approach
- Simple mode: Left/right only (current)
- Advanced mode: Multiple ports (legacy style)
- User preference toggle

## Questions to Discuss:

1. Do we need the full legacy port system, or can we simplify?
2. Should AND/OR logic be explicit nodes (current) or implicit via connections?
3. How important are conditional branches (top/bottom routing)?
4. Should we split Canvas.jsx into smaller files?
5. What visual indicators would reduce confusion?
