# Frontend Hierarchical Report Types Update

**Date**: November 20, 2025  
**Status**: Phase 3 Complete - Frontend Updated  
**Integration**: Backend + Frontend Hierarchical Report Types

## ✅ Completed Frontend Updates

### 1. API Integration
- **New Endpoint**: `/api/report-types/hierarchical`
- **Data Structure**: 8 main categories with 30 subcategories
- **Legacy Mapping**: Backward compatibility with old report types

### 2. Dashboard Updates
**Report Type Dropdowns**:
- Remove Post form now shows hierarchical categories
- Ban User form now shows hierarchical categories  
- Organized by main category with subcategory options

**Feed Configuration**:
- Hierarchical opt-in system (30 subcategories)
- Main category thresholds with subcategory overrides
- Visual organization by category sections

### 3. User Interface Improvements
**Hierarchical Selection**:
```html
<optgroup label="Misleading">
  <option value="misleading-spam">Spam</option>
  <option value="misleading-scam">Scam</option>
  <option value="misleading-bot">Fake account or bot</option>
  <!-- ... -->
</optgroup>
```

**Feed Configuration Layout**:
- Category sections with visual grouping
- Main category threshold controls
- Subcategory opt-ins with override thresholds
- Fallback display (shows main category default)

## 🔧 Technical Implementation

### API Structure
```json
{
  "reportTypes": {
    "misleading": {
      "name": "Misleading",
      "subcategories": {
        "misleading-spam": "Spam",
        "misleading-scam": "Scam",
        // ... 6 total
      }
    },
    "harassment": {
      "name": "Harassment", 
      "subcategories": {
        "harassment-troll": "Trolling",
        // ... 5 total
      }
    }
    // ... 8 main categories total
  }
}
```

### Frontend Data Flow
1. **Load Report Types**: `loadReportTypes()` fetches hierarchical structure
2. **Dynamic Rendering**: Vue templates render categories and subcategories
3. **Threshold Management**: Helper functions handle main/subcategory thresholds
4. **Feed Updates**: Comprehensive update payload includes all hierarchical settings

### Threshold System
- **Main Category**: Default threshold for entire category
- **Subcategory Override**: Optional specific threshold per subcategory
- **Fallback Logic**: NULL subcategory uses main category threshold
- **Visual Indicators**: Placeholder text shows fallback values

## 📊 Report Type Coverage

### Available Categories (8 main, 30 subcategories)
1. **Misleading** (6 types): spam, scam, bot, impersonation, elections, other
2. **Harassment** (5 types): troll, targeted, hate-speech, doxxing, other  
3. **Violence** (6 types): animal, threats, graphic-content, glorification, trafficking, other
4. **Sexual** (6 types): unlabeled, abuse-content, ncii, deepfake, animal, other
5. **Child Safety** (2 types): privacy, harassment
6. **Self Harm** (5 types): content, ed, stunts, substances, other
7. **Rule Breaking** (4 types): site-security, prohibited-sales, ban-evasion, other
8. **Other** (1 type): other

### Command-Enabled Types (7 types)
- `misleading-other`, `harassment-other`, `violence-other`
- `sexual-other`, `self-harm-other`, `rule-other`, `other`

## 🎯 User Experience

### Before (Legacy)
- 6 flat report types
- Simple dropdown selection
- Basic threshold configuration

### After (Hierarchical)
- 30 granular subcategories
- Organized by main category
- Two-level threshold system
- Visual category grouping
- Fallback threshold display

## 🔄 Backward Compatibility

### Legacy Support
- Old report types still work during transition
- API provides legacy mapping
- Database maintains old columns temporarily
- Gradual migration path

### Migration Strategy
- New reports use hierarchical types
- Old reports map to appropriate subcategories
- Users can configure both systems
- Smooth transition without data loss

## 🚀 Current System Status

### Frontend ✅
- Hierarchical dropdowns working
- Feed configuration updated
- Category-based organization
- Threshold override system

### Backend ✅  
- Hierarchical parsing implemented
- API endpoints providing structure
- Database schema supports all types
- Command system ready

### Integration ✅
- Frontend loads hierarchical data
- Dropdowns show organized categories
- Feed updates include all settings
- Backward compatibility maintained

## 🎉 Key Benefits

### For Users
- **Granular Control**: 30 specific report types vs 6 generic ones
- **Better Organization**: Categories group related types
- **Flexible Thresholds**: Main category + subcategory overrides
- **Clear Hierarchy**: Visual organization makes selection easier

### For Moderation
- **Precise Targeting**: Specific subcategory thresholds
- **Command Support**: 7 types support custom commands
- **Communal Intelligence**: More granular report tracking
- **Future Ready**: Foundation for advanced features

### For Development
- **Scalable Structure**: Easy to add new categories/subcategories
- **Clean API**: Organized data structure
- **Maintainable Code**: Separation of concerns
- **Extensible**: Ready for future enhancements

---

**The frontend now fully supports the hierarchical report types system, providing users with granular control over moderation while maintaining backward compatibility. The system is ready for production use with the new Bluesky hierarchical report format.**