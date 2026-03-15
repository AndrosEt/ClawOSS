# Issue #1183: Improve PyTorch reader coverage

## What
Increase coverage for `qdp/qdp-core/src/readers/torch.rs`.

Current coverage:
- Function coverage: `0.00% (0/4)`
- Line coverage: `0.00% (0/41)`

## Why
We already have `qdp/qdp-core/tests/torch_io.rs`, but the constructor and reader state transitions in `readers/torch.rs` are not being exercised in the main coverage workflow.

## Suggested coverage targets:
- `TorchReader::new()` succeeds for an existing `.pt` file
- `TorchReader::new()` fails for a missing file
- `read_batch()` rejects a second read with `Reader already consumed`
- `get_sample_size()` and `get_num_samples()` are asserted after a successful read
- If coverage job excludes `pytorch` feature, add coverage for non-feature `NotImplemented` path

## Done When
`readers/torch.rs` shows real coverage improvement in `cargo llvm-cov`.

## Target Test File
`qdp/qdp-core/tests/torch_reader.rs`

## API to Test
```rust
pub struct TorchReader { ... }

impl TorchReader {
    pub fn new<P: AsRef<Path>>(path: P, batch_size: Option<usize>) -> Result<Self>
}

impl DataReader for TorchReader {
    fn read_batch(&mut self) -> Result<(Vec<f64>, usize, usize)>;
    fn get_sample_size(&self) -> Option<usize>;
    fn get_num_samples(&self) -> Option<usize>;
}
```
