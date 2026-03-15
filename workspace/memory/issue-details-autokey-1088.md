# Issue #1088: X11 resource leak on restart

## Repository
autokey/autokey

## Issue Details
- Number: 1088
- Title: X11 resource leak: XGrabKey passive grabs not released on restart (BadAccess errors)
- State: OPEN
- Labels: bug, help-wanted, installation/configuration

## Problem
AutoKey has an X11 resource leak where `XGrabKey` passive grabs are not released when AutoKey restarts. This causes:
- `BadAccess` errors on restart (major_opcode=33 = XGrabKey)
- Accumulated `<unknown>` resource blocks in xrestop with passive grabs
- X11 client count growing over time (from ~46 to 90+)
- Eventually hitting X11 maximum client limit

## Root Cause
When AutoKey restarts (e.g., manually while already running):
1. Old instance registered X11 passive grabs via `XGrabKey` on root window and child windows
2. New instance tries to grab same keys → `BadAccess` error
3. Old grabs are never released → they accumulate

## Current Workaround
User created systemd service with proper lifecycle management and monitoring script.

## Task
Implement proper cleanup of X11 passive grabs when AutoKey shuts down or restarts. The fix should:
1. Release XGrabKey passive grabs on clean exit
2. Handle SIGTERM/SIGINT gracefully
3. Possibly detect existing grabs on startup and handle them

## Tech Context
- Python-Xlib for X11 interaction
- `__grabHotkeys()` registers the grabs
- Needs proper cleanup in shutdown path