# Issue #1089: Explore Game Controller Input

## Repository
autokey/autokey

## Issue Details
- Number: 1089
- Title: Explore Game Controller Input
- State: OPEN
- Labels: help-wanted, user interface, autokey triggers, feature

## Problem
AutoKey currently only supports keyboard hotkeys. Users want to use game controller inputs as action triggers.

## Use Case
- Use old game controllers as macro pads
- Trigger AutoKey actions with gamepad buttons/sticks
- Similar to AutoHotKey on Windows

## Task
Research and implement game controller input support for AutoKey. This is exploratory - may include:
1. Research Python game controller libraries (evdev, pygame, inputs, etc.)
2. Prototype reading controller events
3. Integrate with AutoKey's trigger system
4. Add configuration UI for binding controller inputs

## Notes
- This is marked as exploration/feature request
- Should work with X11
- Consider popular controller types (Xbox, PlayStation, generic USB)
- May require new dependencies