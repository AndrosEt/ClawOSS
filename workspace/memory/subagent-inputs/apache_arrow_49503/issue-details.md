# Issue #49503: [Docs][Python] Document .pxi doctests

## What
Document that .pxi doctests are tested via lib.pyx.

## Problem
Running `python -m pytest --doctest-cython` directly on .pxi files doesn't work because Cython .pxi files are included in lib.pyx at compile time.

## Solution
To run doctests on .pxi files, doctest should be run on lib.pyx where they are compiled into:
```bash
python -m pytest --doctest-cython path-to/lib.pyx
```

Errors surface under lib.pyx, not the original .pxi filename.

## Target
Add this info to the documentation at:
https://arrow.apache.org/docs/developers/python/development.html#doctest

## Target File
- `docs/source/developers/python/development.rst` (or similar)
