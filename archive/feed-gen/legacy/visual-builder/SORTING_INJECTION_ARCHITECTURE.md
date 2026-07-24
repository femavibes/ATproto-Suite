# Feed Architecture & Visual Builder Documentation

## Overview

The visual feed builder provides a node-based interface for creating custom Bluesky feeds with clear separation between filtering, scoring, sorting, and injection phases.

---

## END Node Architecture

The END node has **THREE distinct input zones**:

### ⬅️ LEFT Input (Port 0) - MAIN FLOW
- **Color**: Green
- **Purpose**: Main feed logic flow
- **Execution**: Stage 2 - Feed assignment
- **Use case**: Conditions, logic, scoring modules

### 🔶 TOP Input (Port 1) - POST-SORT INJECTION
- **Color**: Orange
- **Purpose**: Connect injection nodes here
- **Execution**: Stage 3 - AFTER sorting
- **Use case**: Ads, sponsored content, recommendations
- **Behavior**: Inserted at intervals throughout sorted feed

### ➡️ RIGHT Input (Port 3) - FIXED POSITION MODULES
- **Color**: Yellow
- **Purpose**: Connect fixed position modules here
- **Execution**: Stage 3 - BEFORE sorting
- **Use case**: Dynamic pinned posts, rotating featured content
- **Behavior**: Guaranteed positions (0, 1, 2, etc.)

### 🟣 BOTTOM Input (Port 2) - SORTING  
- **Color**: Purple
- **Purpose**: Connect sorting nodes here
- **Execution**: Stage 3 - After fixed positions, before injection
- **Use case**: Chronological, by-score, diversity sorting

---

## Native Feed Configuration (Settings)

### 📌 Pinned Posts
- **Type**: Native (built-in, free)
- **Behavior**: Static posts always at top positions
- **Configuration**:
  - Post URLs (one per line)
  - "Show every X posts" - for multiple pinned posts
- **Execution**: Stage 3, position 0, 1, 2... (before sorting)
- **Use case**: Welcome messages, important announcements

### 🔄 Rotating Pinned Posts
- **Type**: Native (built-in, free)
- **Behavior**: Cycles through different posts at a fixed position
- **Configuration**:
  - Post URLs (one per line)
  - "Fixed position (post #)" - which position (0, 1, 2...)
  - "Rotate every X minutes" - time-based rotation
- **Execution**: Stage 3, at specified position (before sorting)
- **Use case**: "Featured Post of the Day", rotating announcements
- **Example**: Position 1 shows Post A for 30 min, then Post B for 30 min, cycles back

---

## Fixed Position Modules (Linear Pipeline)

### Architecture Decision: **LINEAR PIPELINE**

Fixed position modules chain together like sorting nodes to avoid position conflicts.

**Example Flow:**
```
Main Flow → Fixed Pos Module A → Fixed Pos Module B → Sorting → END
```

### How Position Conflicts Are Resolved

**User configures:**
- Module A: position 2
- Module B: position 2 (conflict!)
- Module C: position 3

**Execution (in chain order):**
1. Module A inserts at position 2 ✓
2. Module B tries position 2, taken → shifts to position 3
3. Module C tries position 3, taken → shifts to position 4

**Final feed:**
- Position 0-1: Native pinned/rotating
- Position 2: Module A's post ✓
- Position 3: Module B's post (shifted)
- Position 4: Module C's post (shifted)
- Position 5+: Sorted posts

### Port Configuration
- **Centered ports** like sorting nodes
- **Port 5**: Top output (connects to next module or sorting)
- **Port 2**: Bottom input (receives from previous module)
- **Connect to END right input (port 3)**

### Use Cases
- **Dynamic Pinned Posts**: API returns different post based on time of day
- **Personalized Featured**: Show different featured post per user
- **Breaking News**: Automatically pin latest breaking news post
- **Trending Post**: Pin current #1 trending post

### Fixed Position vs Native Pinned

| Feature | Native Pinned | Fixed Position Module |
|---------|---------------|----------------------|
| Cost | Free | May have API costs |
| Configuration | Simple URL list | External API/logic |
| Dynamic | No | Yes (time, user, etc.) |
| Position | Always 0, 1, 2... | Configurable |
| Execution | Native code | Module code |

---

## Automatic Deduplication

### Strategy

All posts are deduplicated by AT Protocol URI across ALL sources:
- Native pinned posts
- Rotating pinned posts  
- Fixed position modules
- Sorted feed posts
- Injection modules

### How It Works

```
1. Track Set of seen post URIs: seenPostUris = new Set()
2. Native Pinned: Post A at position 0 → Added, URI tracked
3. Fixed Module: Post A at position 2 → SKIPPED (duplicate)
4. Fixed Module: Post B at position 2 → Added at position 2
5. Sorted feed: [Post A, Post C, Post D...]
   - Post A → SKIPPED (already at position 0)
   - Post C → Added
   - Post D → Added
6. Injection: Post B every 10 posts → SKIPPED (already at position 2)
```

### Rules
- **First occurrence wins** (based on execution order)
- **Silent deduplication** (modules don't know they were skipped)
- **Scope**: Per feed request
- **Safe**: Works with untrusted third-party modules

### Protects Against
- Malicious modules spamming same post
- Accidental duplicates from multiple modules
- Same post in both pinned and sorted sections

---

## Sorting Nodes (Linear Pipeline)

### Architecture Decision: **LINEAR SORTING**

Sorting nodes chain together in a **linear pipeline** where each node refines the previous sort.

**Example Flow:**
```
[By Score Sort] → [Diversity Sort] → [END bottom input]
```

The last sorting node in the chain determines the final order before injection.

### Available Sorting Nodes

1. **⏰ Chronological** - Sort by time (newest/oldest first)
2. **⭐ By Score** - Sort by accumulated scoring module points (personalization)
3. **❤️ Most Likes** - Posts with most likes appear first
4. **🔥 Most Engagement** - Likes + reposts + replies
5. **🎲 Weighted Random** - Random but weighted by engagement/score
6. **📊 Clustered** - Group similar posts together
7. **🌈 Diversity Sort** - Maximize author/topic diversity
8. **🔌💰 Custom Sort Module** - External sorting algorithm
9. **🎲 Random** - Shuffle posts randomly

### Sorting Rules

- ✅ Sorting nodes can chain together (linear pipeline)
- ✅ Sorting nodes can connect to other sorting nodes
- ✅ Sorting nodes can connect to injection nodes (then to END)
- ✅ Sorting nodes MUST connect to END's BOTTOM input (port 2)
- ❌ Sorting nodes CANNOT connect to END's TOP input (port 1)

---

## Injection Nodes (Linear Chain)

### Architecture Decision: **INJECTION NODES CAN CHAIN**

Injection nodes can chain together, executing in sequence.

**Example Flow:**
```
[Ads] → [Sponsored Posts] → [Community Highlights] → [END top input]
```

Each injection type has different intervals/logic, and execution order matters.

### Available Injection Nodes

1. **🔌 Ad Network** - Inject ads at fixed intervals (every 5/10/20 posts)
2. **🔌 Sponsored Posts** - Paid promotional content at fixed positions
3. **🔌 Recommended Follows** - Suggest accounts to follow
4. **🔌 Trending Topics** - Insert trending topic cards
5. **🔌💰 Custom Injection Module** - External content injection
6. **🔌 Carousel Posts** - Rotating featured content
7. **🔌 Community Highlights** - Curated posts from moderators

### Injection Rules

- ✅ Injection nodes can chain together
- ✅ Injection nodes MUST connect to END's TOP input (port 1)
- ❌ Injection nodes CANNOT connect to END's BOTTOM input (port 2)
- ❌ Injection nodes can ONLY connect to END node (no other destinations)

---

## Execution Order

### Stage 2: Feed Assignment
```
[START] → [Conditions] → [Logic Nodes] → [Scoring Modules] → [END]
```
- Posts that reach END are added to `feed_posts` table
- Scoring modules accumulate points but don't sort yet

### Stage 3: Feed Serving (Query Time)
```
1. Fetch posts from feed_posts
2. Initialize seenPostUris = new Set()
3. Add native pinned posts (position 0, 1, 2...) - track URIs
4. Add rotating pinned posts (at configured position) - track URIs, dedupe
5. Execute FIXED POSITION pipeline (right input of END) - track URIs, dedupe, shift conflicts
   ↓
6. Execute SORTING pipeline (bottom input of END) - dedupe against seen URIs
   ↓
7. Execute INJECTION pipeline (top input of END) - dedupe, insert at intervals
   ↓
8. Return to user
```

### Execution Order Priority

1. **Native Pinned** (positions 0, 1, 2...)
2. **Native Rotating** (at configured position)
3. **Fixed Position Modules** (linear chain, position conflicts auto-resolve)
4. **Sorting** (reorder remaining posts)
5. **Post-Sort Injection** (insert at intervals)

### Why This Order?

- ✅ Pinned posts MUST be at top (highest priority)
- ✅ Fixed position modules execute before sorting (guaranteed positions)
- ✅ Sorting happens on remaining posts (doesn't affect pinned/fixed)
- ✅ Injection happens last (ads shouldn't be re-sorted)
- ✅ Deduplication prevents same post appearing multiple times

---

## Visual Distinction

### Color Coding

- **Green** (#51cf66) - FLOW connections (pass posts through)
- **Blue** (#4a9eff) - AND logic (vertical connections)
- **Orange** (#ff9500) - OR logic (horizontal connections)
- **Purple** (#9775fa) - Sorting nodes and END bottom input
- **Orange** (#ff9500) - Injection nodes and END top input

### END Node Ports

- **Port 0 (Left)**: Green arrow - Main flow input
- **Port 1 (Top)**: Orange arrow pointing down - "INJECT: Connect injection nodes here"
- **Port 2 (Bottom)**: Purple arrow pointing up - "SORT: Connect sorting nodes here"  
- **Port 3 (Right)**: Yellow arrow - "FIXED: Connect fixed position modules here"

---

## Validation Rules

The visual builder enforces these rules:

1. **Injection nodes** can ONLY connect to END's top input (port 1)
2. **Sorting nodes** can ONLY connect to:
   - END's bottom input (port 2)
   - Other sorting nodes (linear pipeline)
   - Injection nodes (chain before END)
3. **Scoring nodes** can connect to:
   - END node
   - Other scoring/sorting nodes
   - Injection nodes
4. **END node** cannot be deleted or duplicated
5. **START node** cannot be deleted or duplicated

---

## Example Configurations

### Simple Feed (Chronological)
```
[START] → [Text Condition] → [Chronological Sort] → [END bottom]
```

### Personalized Feed with Ads
```
[START] → [Conditions] → [Personalization Scoring] → [By Score Sort] → [Diversity Sort] → [Ads] → [END]
                                                                              ↓              ↓
                                                                        (bottom input)  (top input)
```

### Complex Multi-Source Feed
```
[START] ──→ [Conditions] ──→ [Scoring] ──┐
                                          ├──→ [Weighted Random] → [Sponsored] → [Ads] → [END]
[RSS Feed] ──→ [Manual Posts] ──→ [Scoring] ──┘                      ↓            ↓
                                                                 (bottom)      (top)
```

---

## Benefits of This Architecture

1. **Clear Mental Model** - Two distinct phases: sort, then inject
2. **No Priority Conflicts** - Linear pipelines eliminate ambiguity
3. **Easy to Debug** - Follow the chain to see execution order
4. **Flexible** - Chain multiple sorting/injection nodes as needed
5. **Prevents Errors** - Visual validation prevents invalid connections
6. **Scalable** - Add new sorting/injection types without changing architecture

---

## Future Enhancements

- **Conditional Injection** - "Only inject ads if user has < 100 followers"
- **Dynamic Intervals** - "Inject ads more frequently during peak hours"
- **A/B Testing** - "50% of users see ads every 10 posts, 50% see every 20"
- **Injection Budgets** - "Max 3 ads per day per user"
- **Sorting Weights** - "70% score, 30% diversity"
