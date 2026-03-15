# Repo Analysis: jenkinsci/warnings-ng-plugin

## Tech Stack
- **Language**: Java
- **Build**: Maven
- **Framework**: Jenkins plugin

## Issue
HTML double-escaping of linter name "C++" showing as "C&#43;&#43;"

## Target
Find where linter names are rendered/escaped and fix double-escaping.

## Files to Check
- Look for Cpplint or C++ lint naming
- UI rendering code (Jelly/Groovy templates or Java)
