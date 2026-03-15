# Issue #3233: C++ Lint shows as C&#43;&#43; Lint

## Repository
jenkinsci/warnings-ng-plugin

## Issue Details
- Number: 3233
- Title: [JENKINS-67101] C++ Lint shows as C&#43;&#43; Lint
- State: OPEN
- Labels: help-wanted, good first issue, component:analysis-model

## Problem
The C++ linter Cpplint is displayed incorrectly in the Warnings Next Generation Plugin. The "+" characters are being HTML-escaped, showing as:
- Displayed: `C&#43;&#43; Lint` (HTML entities)
- Expected: `C++ Lint`

The issue is that the ampersand in the HTML special character `&#43;` (+) is being double-escaped.

## Component
analysis-model

## Task
Find where the linter name is being HTML-escaped and fix the double-escaping issue so "C++ Lint" displays correctly.

## References
- Originally from JIRA: JENKINS-67101
- Also mentions: The linter should possibly be named "cpplint" instead of "C++ Lint"