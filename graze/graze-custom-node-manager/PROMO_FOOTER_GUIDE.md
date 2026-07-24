# Promotional Footer - User Guide

## Quick Start

### 1. Configure Your Promotional Footer

1. Navigate to the "Custom Nodes" tab
2. Click the **⚙ Promo Footer** button (top right, next to "Available Custom Nodes")
3. In the modal that opens:
   - Check/uncheck "Enable promotional footer" to toggle globally
   - Type your promotional content in the textarea
   - See live preview below
   - Click "Save Footer"

### 2. Push Nodes with Footer

When pushing any custom node:
1. Configure title and description as usual
2. Check/uncheck "Include promotional footer" (checked by default)
3. Click "Push to Graze"

The footer will be automatically appended to your description!

## Example Footer Content

```markdown
---

Check out my other custom nodes:
- [NSFW Content Filter](https://graze.social/custom-nodes/1622) - Block NSFW by category
- [Ad & Affiliate Blocker](https://graze.social/custom-nodes/1623) - Remove promotional spam
- [Time Master](https://graze.social/custom-nodes/1624) - Filter by time and date

Made with love by @yourhandle.bsky.social
```

## Tips

- **Markdown Support**: Use markdown for links, bold, italic, etc.
- **Line Breaks**: Press Enter to add line breaks
- **Per-Node Control**: Uncheck "Include promotional footer" when pushing if you don't want it on a specific node
- **Update Existing Nodes**: Re-push nodes to update their footers
- **Preview First**: Use the preview section to see how it will look

## How It Works

When you push a node:
```
[Your Node Description]

---

[Your Promotional Footer]
```

The footer is added AFTER any title/description overrides you make, so:
- Default description + footer
- OR custom description + footer
- OR custom description without footer (if unchecked)

## Troubleshooting

**Footer not appearing?**
- Make sure "Enable promotional footer" is checked in settings
- Make sure "Include promotional footer" is checked when pushing
- Check that you saved your footer content

**Footer too long?**
- Graze may have description length limits
- Try shortening your footer if it gets cut off
- Test with a single node first

**Want to remove footer from a node?**
- Uncheck "Include promotional footer" when pushing
- Re-push the node with updated description
