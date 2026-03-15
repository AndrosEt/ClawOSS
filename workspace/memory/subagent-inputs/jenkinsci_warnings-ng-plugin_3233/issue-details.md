# Issue #3233: C++ Lint shows as C&#43;&#43; Lint

## Problem
The C++ linter Cpplint is displayed incorrectly in the Warnings Next Generation Plugin. The name shows as "C&#43;&#43; Lint" instead of "C++ Lint" due to double HTML escaping.

## Root Cause
The ampersand in the HTML entity `&#43;` (which represents +) is being escaped again, resulting in `C&amp;#43;&amp;#43; Lint`.

## Solution
Fix the double-escaping issue in the linter name display. The name should display as "C++ Lint" or use the proper tool name "cpplint".

## Target
Find where linter names are escaped/rendered and fix the double-escaping.
