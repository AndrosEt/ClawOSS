# Issue #1180: Add tests for streaming amplitude encoder coverage

## What
Add focused tests for `qdp/qdp-core/src/encoding/amplitude.rs`.

Current coverage:
- Function coverage: `0.00% (0/4)`
- Line coverage: `0.00% (0/73)`

## Why
`encoding/amplitude.rs` contains the streaming Parquet encoding path, but none of its validation or chunk-level behavior is currently exercised.

## Suggested coverage targets:
- reject `sample_size == 0`
- reject `sample_size > STAGE_SIZE_ELEMENTS`
- successful `init_state()` allocation for a valid chunk size
- at least one end-to-end streaming encode case that reaches `encode_chunk()`
- if practical, one failure case that asserts `MahoutError::KernelLaunch` is surfaced

## Done When
`encoding/amplitude.rs` is no longer at 0% coverage in `cargo llvm-cov`.

## Target Test File
`qdp/qdp-core/tests/encoding_amplitude.rs`

## Key APIs
```rust
pub struct AmplitudeEncoder { ... }

impl AmplitudeEncoder {
    pub fn new(sample_size: usize, num_qubits: usize) -> Result<Self>
    pub fn init_state(&mut self, chunk_size: usize) -> Result<()>
    pub fn encode_chunk(&mut self, chunk: &[f64]) -> Result<()>
    pub fn needs_staging_copy(&self) -> bool
}
```
