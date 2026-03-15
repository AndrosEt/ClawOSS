# Repo Analysis: apache/mahout

## Tech Stack
- **Primary**: Rust (qdp-core, qumat)
- **Python bindings**: PyO3/uv for Python API
- **Build**: Cargo for Rust, uv for Python

## Test Framework
- Rust: `cargo test` or `make test_rust`
- Coverage: cargo-llvm-cov (qdp requires NVIDIA GPU; tests auto-skip if unavailable)

## Code Style
- `cargo fmt` for Rust formatting
- `cargo clippy` for linting
- Pre-commit hooks configured

## Directory Structure
- `qdp/qdp-core/src/readers/parquet.rs` - Target file for tests
- `qdp/qdp-core/tests/` - Integration tests directory
- `qdp/qdp-core/tests/parquet_io.rs` - Existing tests (tests io.rs, not readers/parquet.rs)

## PR Template
- Checklist: Bug fix/New feature/Test/etc
- Must add/update unit tests
- Must add documentation

## Key APIs to Test
1. `ParquetReader::new()` - rejects missing files and bad schemas
2. `ParquetReader::read_batch()` - handles List<Float64> and FixedSizeList<Float64>
3. `ParquetStreamingReader::new()` - accepts Float64 for basis encoding
4. `ParquetStreamingReader::read_chunk()` - streaming chunked data

## Dependencies
- arrow, parquet crates for Arrow/Parquet handling
- approx = "0.5.1" for test assertions (dev dependency)

## Target Test File
Tests should go in: `qdp/qdp-core/tests/parquet_reader.rs`
