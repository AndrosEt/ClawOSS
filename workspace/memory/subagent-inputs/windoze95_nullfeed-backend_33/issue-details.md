# Issue #33: Performance: Inefficient Table Scan in create_profile

## What
In `app/api/auth.py`, the `create_profile` endpoint has an inefficient query that fetches all users to check if the database is empty.

## Current Code
```python
result = await db.execute(select(User))
existing = result.scalars().all()
is_first_user = len(existing) == 0
```

## Problem
As the userbase grows, this fetches and instantiates ORM objects for every user just to check if count is zero, wasting memory and database I/O.

## Suggested Fix
Replace with a fast count query or fetch single user with limit:
```python
result = await db.execute(select(User.id).limit(1))
is_first_user = result.scalar_one_or_none() is None
```

## Done When
- Inefficient query is replaced
- Tests pass
- PR submitted
