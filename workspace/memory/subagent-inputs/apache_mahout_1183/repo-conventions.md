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
- `qdp/qdp-core/src/readers/torch.rs` - Target file for tests
- `qdp/qdp-core/tests/` - Integration tests directory
- `qdp/qdp-core/tests/torch_io.rs` - Existing tests (tests io.rs)

## PR Template
- Checklist: Bug fix/New feature/Test/etc
- Must add/update unit tests
- Must add documentation

## Key APIs to Test (TorchReader)
1. `TorchReader::new(path, batch_size)` - create reader
2. `TorchReader::read_batch()` - read data
3. `TorchReader::get_sample_size()` - get sample size
4. `TorchReader::get_num_samples()` - get num samples

## Dependencies
- arrow, parquet, tch (PyTorch) crates
- approx = "0.5.1" for test assertions

## Target Test File
`qdp/qdp-core/tests/torch_reader.rs`

## Testing Notes
- Tests should work without GPU (use cfg guards)
- Test both success and error paths
- Mock .pt files may be needed or use temp files
