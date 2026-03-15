# Repo Analysis: autokey/autokey

## Tech Stack
- **Language**: Python
- **UI**: GTK/Qt
- **Platform**: X11 Linux

## Issue
XGrabKey passive grabs not released on restart, causing BadAccess errors.

## Target
Find XGrabKey usage and ensure grabs are released on shutdown/restart.

## Files to Check
- Look for XGrabKey calls
- Shutdown/cleanup code
- Error handling for BadAccess
