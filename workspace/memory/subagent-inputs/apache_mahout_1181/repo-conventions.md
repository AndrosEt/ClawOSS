# Repo Analysis: apache/mahout

## Tech Stack
- **Primary**: Rust (qdp-core)
- **Build**: Cargo

## Test Framework
- Rust: `cargo test` or `make test_rust`
- Coverage: cargo-llvm-cov

## Code Style
- `cargo fmt` for Rust formatting
- `cargo clippy` for linting

## Directory Structure
- `qdp/qdp-core/src/encoding/angle.rs` - Target file for tests
- `qdp/qdp-core/tests/` - Integration tests directory

## Key APIs to Test (AngleEncoder)
```rust
pub struct AngleEncoder { ... }

impl AngleEncoder {
    pub fn new(sample_size: usize, num_qubits: usize) -> Result<Self>
    pub fn init_state(&mut self, chunk_size: usize) -> Result<()>
    pub fn encode_chunk(&mut self, chunk: &[f64]) -> Result<()>
}
```

## Test Targets
- reject `sample_size == 0`
- reject `sample_size > STAGE_SIZE_ELEMENTS`
- reject `sample_size != num_qubits`
- reject `NaN` and `infinity` with proper error messages
- happy-path encode reaching kernel launch

## Target Test File
`qdp/qdp-core/tests/encoding_angle.rs`

## Testing Notes
- Tests run on CPU, GPU code paths auto-skip without CUDA
- Use cfg guards for GPU-specific tests
