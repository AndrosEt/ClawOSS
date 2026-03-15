# Repo Analysis: apache/arrow

## Tech Stack
- **Language**: Python, Cython
- **Docs**: Sphinx (RST format)

## Target
Document that .pxi doctests are tested via lib.pyx.

## Key File
`docs/source/developers/python/development.rst`

## Current Section
Look for "Doctest" section in development.rst

## Content to Add
```rst
Note: To run doctests on .pxi files, run pytest on lib.pyx where they are compiled into::

    python -m pytest --doctest-cython path-to/lib.pyx

Errors will surface under lib.pyx, not the original .pxi filename.
```

## Testing
- Build docs: check rendering
- Verify content is accurate
