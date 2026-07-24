# Dashboard Component Extraction Plan

## Progress Tracker
- [x] **BackfillTab.vue** - Complete (simple, single functionality)
- [x] **TrendingControls.vue** - Complete (reusable component)
- [x] **FeedsTab.vue** - Complete (complex but self-contained)
- [x] **RemoveTab.vue** - Complete (3 sub-tabs with shared TrendingControls)
- [x] **BanTab.vue** - Complete (3 sub-tabs)

## Shared Components to Extract

### High Priority (Used Multiple Times)
1. **PostPreview.vue** - Post display with author, text, images, embeds
2. **ThresholdDisplay.vue** - Complex threshold calculation display
3. **ActivityItem.vue** - Individual activity entries with restore buttons
4. **ReportBadges.vue** - Report source badges with click handlers

### Medium Priority
5. **UserHistoryItem.vue** - Individual user history entries
6. **TrendingItem.vue** - Individual trending post/user items
7. **FeedCard.vue** - Individual feed configuration cards

### Low Priority (Modals)
8. **AddFeedModal.vue**
9. **EditBanListModal.vue** 
10. **RestorePostModal.vue**
11. **PostHistoryModal.vue**
12. **PostReportsModal.vue**
13. **UserHistoryModal.vue**
14. **AttemptedPostsModal.vue**
15. **UnbanConfirmModal.vue**
16. **InfoModal.vue**

## Component Interface Contracts

### BackfillTab.vue ✅
```typescript
Props: {
  backfillsRemaining: number
  userTier: string
}
Events: {
  'show-info': [topic: string]
  'backfill-completed': [remaining: number]
}
```

### TrendingControls.vue ✅
```typescript
Props: {
  timeframe: string
  showHidden: boolean
}
Events: {
  'update:timeframe': [value: string]
  'update:showHidden': [value: boolean]
}
```

### FeedsTab.vue (Next)
```typescript
Props: {
  feeds: Feed[]
  reportTypes: ReportTypes
  authStore: AuthStore
}
Events: {
  'feed-added': []
  'feed-updated': [feed: Feed]
  'feed-deleted': [feedId: string]
  'show-add-feed': []
  'edit-ban-list': [feed: Feed]
}
```

### PostPreview.vue (Shared)
```typescript
Props: {
  postDetails: PostDetails
  showImages?: boolean
  showVideos?: boolean
  showEmbeds?: boolean
}
```

### ThresholdDisplay.vue (Shared)
```typescript
Props: {
  item: TrendingItem
  type: string
  globalThresholds?: GlobalThresholds
  feed?: Feed
}
Events: {
  'category-expanded': [category: string]
  'threshold-info': []
}
```

## Data Flow Patterns

### Parent → Child Data
- **Read-only props**: Pass down data that components display
- **Reactive props**: Pass down refs that components can watch
- **Configuration**: Pass settings, user tier, feature flags

### Child → Parent Communication
- **Events**: Use descriptive event names (kebab-case)
- **Payload**: Include minimal necessary data
- **State updates**: Parent handles all state mutations

### Shared State
- **AuthStore**: Pass as prop, don't import directly in components
- **API calls**: Keep in parent or create composables
- **Modal state**: Keep in parent Dashboard.vue

## CSS Strategy

### Scoped Styles
- Each component has scoped styles
- Follow design system classes exactly
- Use CSS custom properties for theme values

### Responsive Patterns
```css
/* Mobile first approach */
.component {
  padding: 0.75rem;
}

@media (min-width: 640px) {
  .component {
    padding: 1rem;
  }
}

@media (min-width: 768px) {
  .component {
    padding: 1.5rem 2rem;
  }
}
```

### Consistent Class Names
- `.card`, `.card-header`, `.card-content`
- `.btn`, `.btn-primary`, `.btn-danger`
- `.input`, `.select`
- `.results`, `.result-item`
- `.success`, `.error`, `.warning`

## Testing Strategy

### Component Testing
1. **Props validation**: Ensure required props work
2. **Event emission**: Verify events fire with correct payloads
3. **User interactions**: Test button clicks, form submissions
4. **Responsive behavior**: Test mobile/desktop layouts

### Integration Testing
1. **Parent-child communication**: Verify data flows correctly
2. **API integration**: Test with mock API responses
3. **State management**: Ensure state updates propagate

## Migration Steps

### Phase 1: Simple Components ✅
- [x] BackfillTab
- [x] TrendingControls

### Phase 2: Complex Tabs ✅
- [x] FeedsTab (self-contained, complex forms)
- [x] RemoveTab (3 sub-tabs, shared components)
- [x] BanTab (3 sub-tabs, similar to RemoveTab)

### Phase 3: Shared Components
- [ ] PostPreview (used in multiple trending views)
- [ ] ThresholdDisplay (complex calculations)
- [ ] ActivityItem (restore functionality)

### Phase 4: Modals
- [ ] Extract all modal components
- [ ] Create modal management system

### Phase 5: Cleanup
- [ ] Remove unused code from Dashboard.vue
- [ ] Optimize imports and dependencies
- [ ] Final testing and validation

## File Size Targets

### Before Extraction
- **Dashboard.vue**: ~3000 lines (too large)

### After Extraction
- **Dashboard.vue**: ~600 lines (tab navigation + modals + shared functions)
- **Each Tab**: 300-800 lines (manageable)
- **Shared Components**: 100-300 lines (focused)
- **Modals**: 50-150 lines (simple)

## Benefits Achieved

### Context Management
- ✅ Smaller files fit in AI context windows
- ✅ Focused development on specific features
- ✅ Easier debugging and maintenance

### Code Organization
- ✅ Clear separation of concerns
- ✅ Reusable components
- ✅ Consistent design system

### Development Experience
- ✅ Faster hot reloading
- ✅ Better IDE performance
- ✅ Easier code reviews