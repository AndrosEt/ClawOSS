# Subagent Result: autokey/autokey#1088

## Task Summary
Fixed X11 resource leak on restart in autokey/autokey#1088.

## Issue Analysis
The `XInterfaceBase.cancel()` method in `lib/autokey/interface.py` was not releasing X11 key grabs before closing the display connection. This caused X11 resources to leak when autokey was restarted.

## Fix Applied
Modified the `cancel()` method in `XInterfaceBase` class to call `__ungrabAllHotkeys()` before closing the display:

```python
def cancel(self):
    logger.debug("XInterfaceBase: Ungrabbing all hotkeys before shutdown.")
    self.__ungrabAllHotkeys()  # Added this line
    # ... rest of cleanup code
```

This ensures all hotkey grabs (global and window-specific) are released before the X11 display connection is closed.

## PR Submitted
- **PR URL**: https://github.com/autokey/autokey/pull/1090
- **Branch**: `clawoss/fix/x11-resource-leak`
- **Commit**: d992550

## Files Changed
- `lib/autokey/interface.py` (+2 lines)

## Verification
- Syntax validation passed
- Fix follows existing code patterns (using `__ungrabAllHotkeys()` which is already called during keymap changes)
- Minimal change with clear purpose

## Status
COMPLETED - PR submitted successfully
