# Feed Moderator Design System

## Color Palette

### Primary Colors
- **Primary Blue**: `#3b82f6` (buttons, active states, links)
- **Primary Blue Hover**: `#2563eb`
- **Success Green**: `#10b981` (success states, restore buttons)
- **Success Green Hover**: `#059669`
- **Error Red**: `#ef4444` (remove/ban buttons, errors)
- **Error Red Hover**: `#dc2626`
- **Warning Orange**: `#f59e0b` (backfill, warnings)
- **Warning Orange Hover**: `#d97706`

### Neutral Colors
- **Gray 900**: `#1e293b` (headings)
- **Gray 700**: `#374151` (body text, labels)
- **Gray 600**: `#4b5563` (secondary text)
- **Gray 500**: `#6b7280` (muted text, icons)
- **Gray 400**: `#9ca3af` (placeholders)
- **Gray 300**: `#d1d5db` (borders)
- **Gray 200**: `#e5e7eb` (light borders)
- **Gray 100**: `#f3f4f6` (light backgrounds)
- **Gray 50**: `#f8fafc` (card backgrounds)

### Status Colors
- **Protected Yellow**: `#fbbf24` (protected posts)
- **Protected Yellow Text**: `#92400e`

## Typography

### Font Sizes
- **Large Heading**: `1.25rem` (20px)
- **Body**: `0.875rem` (14px)
- **Small**: `0.75rem` (12px)
- **Tiny**: `0.6875rem` (11px)

### Font Weights
- **Bold**: `600-700` (headings, important text)
- **Medium**: `500` (labels, buttons)
- **Normal**: `400` (body text)

## Spacing Scale
- **xs**: `0.25rem` (4px)
- **sm**: `0.5rem` (8px)
- **md**: `0.75rem` (12px)
- **lg**: `1rem` (16px)
- **xl**: `1.5rem` (24px)
- **2xl**: `2rem` (32px)

## Component Patterns

### Cards
```css
.card {
  background: white;
  border-radius: 2px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  margin-bottom: 1.5rem;
  overflow: hidden;
}

.card-header {
  padding: 0.75rem 0.75rem 0.5rem 0.75rem; /* mobile */
  padding: 1.5rem 2rem 1rem 2rem; /* desktop */
  border-bottom: 1px solid #f1f5f9;
}

.card-content {
  padding: 0.75rem; /* mobile */
  padding: 1.5rem 2rem; /* desktop */
}
```

### Buttons
```css
.btn {
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 2px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
  min-height: 44px;
}

.btn-primary { background: #3b82f6; color: white; }
.btn-success { background: #10b981; color: white; }
.btn-danger { background: #ef4444; color: white; }
.btn-warning { background: #f59e0b; color: white; }
```

### Form Elements
```css
.input, .select {
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 0.875rem;
  min-height: 44px;
  transition: all 0.2s;
}

.input:focus, .select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}
```

### Chips/Badges
```css
.chip {
  background: #374151;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 2px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.chip:hover { background: #4b5563; }
.chip.active { background: #3b82f6; }
```

### Status Badges
```css
.status-badge {
  padding: 0.125rem 0.25rem;
  border-radius: 0.125rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-success { background: #dcfce7; color: #166534; }
.status-error { background: #fef2f2; color: #dc2626; }
.status-warning { background: #fef3c7; color: #92400e; }
```

### Modals
```css
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal {
  background: white;
  padding: 1rem; /* mobile */
  padding: 2rem; /* desktop */
  border-radius: 12px;
  width: 95%;
  max-width: 400px;
  max-height: 90vh;
  overflow-y: auto;
}
```

## Layout Patterns

### Tab Navigation
- Full-width tabs with icons + labels
- Active state: `background: #3b82f6; color: white;`
- Hover state: `background: #f1f5f9; color: #334155;`

### Sub-tab Navigation
- Smaller tabs with `background: #f8fafc`
- Same active/hover patterns as main tabs

### Responsive Breakpoints
- **Mobile**: `< 640px`
- **Tablet**: `640px - 768px`
- **Desktop**: `> 768px`

### Grid Patterns
```css
.grid-responsive {
  display: grid;
  grid-template-columns: 1fr; /* mobile */
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); /* desktop */
  gap: 0.75rem; /* mobile */
  gap: 1rem; /* desktop */
}
```

## Icon Usage
- **Size**: 16px (small), 20px (medium), 24px (large)
- **Color**: `#64748b` (default), inherit from parent for colored states
- **Stroke Width**: 2px for outline icons

## Animation Standards
```css
.transition-standard {
  transition: all 0.2s;
}

.hover-lift:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
```

## Component Naming Conventions
- **Props**: camelCase (`showHidden`, `postUri`)
- **Events**: kebab-case (`@post-removed`, `@user-banned`)
- **CSS Classes**: kebab-case (`.post-preview`, `.trending-item`)
- **Component Files**: PascalCase (`PostPreview.vue`, `TrendingControls.vue`)

## Accessibility Requirements
- **Min Touch Target**: 44px x 44px
- **Focus States**: Always visible with blue outline
- **Color Contrast**: WCAG AA compliant
- **Screen Reader**: Proper ARIA labels on interactive elements