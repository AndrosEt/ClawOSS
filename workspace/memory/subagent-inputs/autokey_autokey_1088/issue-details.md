# Issue #1088: X11 resource leak on restart

## Problem
XGrabKey passive grabs are not released on restart, causing BadAccess errors.

## Environment
- Xorg (X11)
- Arch Linux, KDE Plasma
- Xorg 21.1.21

## Issue Type
Technical debt / Enhancement

## Solution
Ensure XGrabKey passive grabs are properly released when AutoKey restarts.
