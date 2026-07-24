# Admin Refactor Plan

## Goal
Refactor `/root/skymap/services/admin/public/` HTML files to eliminate duplication, following the pattern used in `/root/skymap/services/web-directory/public/refactor/`.

## Strategy
- Keep existing routes working (e.g., `/lists.html`, `/feeds.html`)
- Add new `/refactor` route as lazy dev environment
- Use component-based architecture with shared styles and navigation

## File Structure
```
/root/skymap/services/admin/public/refactor/
├── index.html          # Main file with ALL styles, navigation, component loader
├── header.html         # Navigation tabs only
├── shared.js           # Common functions (tab switching, fetch with auth)
├── dashboard.html      # Content-only fragment
├── lists.html          # Content-only fragment
├── feeds.html          # Content-only fragment
├── custom_node.html    # Content-only fragment
├── data_sources.html   # Content-only fragment
├── ingestion.html      # Content-only fragment
├── whitelist.html      # Content-only fragment
└── users.html          # Content-only fragment (newest, already clean)
```

## Navigation Tabs (in order)
1. Dashboard
2. Lists Management
3. Feeds Management
4. Custom Node
5. Data Sources
6. Ingestion
7. Whitelist
8. User Management

## Refactor Order
1. ✅ Create adminrefactor.md plan
2. ✅ Create `/refactor/` directory structure
3. ✅ Create main index.html with all styles and navigation
4. ✅ Create header.html with navigation tabs
5. ✅ Create shared.js with common functions
6. ✅ Convert dashboard (index.html) to content-only fragment
7. ✅ Convert lists.html to content-only fragment
8. ✅ Convert feeds.html to content-only fragment
9. ✅ Convert custom_node.html to content-only fragment
10. ✅ Convert data_sources.html to content-only fragment
11. ✅ Convert ingestion.html to content-only fragment
12. ✅ Convert whitelist.html to content-only fragment
13. ✅ Convert users.html to content-only fragment (last, already clean)
14. ✅ Add `/refactor` route to server.js

## Notes
- Admin uses HTTP Basic Auth (credentials in fetch headers)
- All existing routes remain functional
- `/refactor` is dev/testing environment
- Pattern matches web-directory/refactor exactly

## Status
- Started: Refactor in progress
- Current Step: COMPLETE! All 14 steps finished + fixed static file serving + fixed tab conflicts
- Last Updated: Fixed ID and function name conflicts in Lists and Ingestion tabs
