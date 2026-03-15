# Issue #1181: Add tests for streaming angle encoder coverage

## What
Add focused tests for `qdp/qdp-core/src/encoding/angle.rs`.

Current coverage:
- Function coverage: `0.00% (0/4)`
- Line coverage: `0.00% (0/77)`

## Why
The streaming angle encoder has important validation branches not covered:
- qubit and sample-size mismatch
- chunk-size overflow checks
- non-finite angle rejection
- kernel launch path coverage

## Suggested coverage targets:
- reject `sample_size == 0`
- reject `sample_size > STAGE_SIZE_ELEMENTS`
- reject `sample_size != num_qubits`
- reject `NaN` and `infinity` with sample and angle index in the error
- add one happy-path encode that reaches the kernel launch path

## Done When
`encoding/angle.rs` has meaningful non-zero coverage in `cargo llvm-cov`.

## Target Test File
`qdp/qdp-core/tests/encoding_angle.rs`

## Key APIs
```rust
pub struct AngleEncoder { ... }

impl AngleEncoder {
    pub fn new(sample_size: usize, num_qubits: usize) -> Result<Self>
    pub fn init_state(&mut self, chunk_size: usize) -> Result<()>
    pub fn encode_chunk(&mut self, chunk: &[f64]) -> Result<()>
}
```
