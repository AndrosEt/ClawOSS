# Issue #1184: Add direct coverage for Parquet readers

## Repository
apache/mahout

## Issue Details
- Number: 1184
- Title: [Feature] Add direct coverage for Parquet readers
- State: OPEN
- Assignees: None
- Labels: bug, enhancement, question, good-first-issue

## Reference
- Related to: #1058

## Problem
Current coverage for `qdp/qdp-core/src/readers/parquet.rs` is 0%:
- Function coverage: 0.00% (0/31)
- Line coverage: 0.00% (0/415)

Existing tests in `qdp/qdp-core/tests/parquet_io.rs` mainly exercise `io.rs` helper functions, not the actual `ParquetReader` and `ParquetStreamingReader` implementations.

## Task
Add tests that instantiate the reader types directly and exercise both batch and streaming behavior.

## Required Test Cases
1. `ParquetReader::new()` rejects missing files and bad schemas
2. `ParquetReader::read_batch()` handles `List<Float64>`
3. `ParquetReader::read_batch()` handles `FixedSizeList<Float64>`
4. Reject inconsistent sample sizes across rows
5. `ParquetStreamingReader::new()` accepts scalar `Float64` for basis encoding
6. `ParquetStreamingReader` returns chunked data and sample-size metadata correctly
7. Assert empty-file or no-data behavior explicitly

## Definition of Done
- `readers/parquet.rs` is no longer at 0% coverage
- Existing Parquet tests still pass
- New tests cover the scenarios listed above

## Implementation Notes
- Target file: `qdp/qdp-core/src/readers/parquet.rs`
- Test file: Create or extend tests in `qdp/qdp-core/tests/`
- This is a Rust codebase
- Follow existing test patterns from `parquet_io.rs`
