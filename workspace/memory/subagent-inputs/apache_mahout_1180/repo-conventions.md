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
- `qdp/qdp-core/src/encoding/amplitude.rs` - Target file for tests
- `qdp/qdp-core/tests/` - Integration tests directory

## Key APIs to Test (AmplitudeEncoder)
```rust
pub struct AmplitudeEncoder { ... }

impl AmplitudeEncoder {
    pub fn new(sample_size: usize, num_qubits: usize) -> Result<Self>
    pub fn init_state(&mut self, chunk_size: usize) -> Result<()>
    pub fn encode_chunk(&mut self, chunk: &[f64]) -> Result<()>
    pub fn needs_staging_copy(&self) -> bool
}
```

## Test Targets
- reject `sample_size == 0`
- reject `sample_size > STAGE_SIZE_ELEMENTS`
- successful `init_state()` allocation
- end-to-end streaming encode reaching `encode_chunk()`
- `MahoutError::KernelLaunch` error surfacing

## Target Test File
`qdp/qdp-core/tests/encoding_amplitude.rs`

## Testing Notes
- Tests run on CPU, GPU code paths auto-skip without CUDA
- Use cfg guards for GPU-specific tests
