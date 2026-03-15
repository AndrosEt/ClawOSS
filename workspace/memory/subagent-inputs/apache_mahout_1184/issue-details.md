# Issue #1184: Add direct coverage for Parquet readers

## What
Add direct tests for `qdp/qdp-core/src/readers/parquet.rs`.

Current coverage for this file is still zero:
- Function coverage: `0.00% (0/31)`
- Line coverage: `0.00% (0/415)`

## Why
We already have `qdp/qdp-core/tests/parquet_io.rs`, but those tests mainly exercise `io.rs` helper functions. The actual `ParquetReader` and `ParquetStreamingReader` implementations remain uncovered.

This is a large and important blind spot in the current Rust coverage report.

## How
Add tests that instantiate the reader types directly and exercise both batch and streaming behavior.

### Suggested coverage targets:

**ParquetReader:**
- `ParquetReader::new()` rejects missing files and bad schemas
- `ParquetReader::read_batch()` handles `List<Float64>`
- `ParquetReader::read_batch()` handles `FixedSizeList<Float64>`
- reject inconsistent sample sizes across rows

**ParquetStreamingReader:**
- `ParquetStreamingReader::new()` accepts scalar `Float64` for basis encoding
- `ParquetStreamingReader` returns chunked data and sample-size metadata correctly
- assert empty-file or no-data behavior explicitly

## Done When
`readers/parquet.rs` is no longer at 0% coverage and existing Parquet tests still pass.

## API Details

### ParquetReader
```rust
pub struct ParquetReader { ... }

impl ParquetReader {
    pub fn new<P: AsRef<Path>>(
        path: P,
        batch_size: Option<usize>,
        null_handling: NullHandling,
    ) -> Result<Self>
}

impl DataReader for ParquetReader {
    fn read_batch(&mut self) -> Result<(Vec<f64>, usize, usize)>; // (data, num_samples, sample_size)
    fn get_sample_size(&self) -> Option<usize>;
    fn get_num_samples(&self) -> Option<usize>;
}
```

### ParquetStreamingReader
```rust
pub struct ParquetStreamingReader { ... }

impl ParquetStreamingReader {
    pub fn new<P: AsRef<Path>>(
        path: P,
        batch_size: Option<usize>,
        null_handling: NullHandling,
    ) -> Result<Self>
    
    pub fn get_sample_size(&self) -> Option<usize>;
}

impl DataReader for ParquetStreamingReader { ... }
impl StreamingDataReader for ParquetStreamingReader {
    fn read_chunk(&mut self, buffer: &mut [f64]) -> Result<usize>;
    fn total_rows(&self) -> usize;
}
```

### NullHandling enum
```rust
pub enum NullHandling {
    Fail,
    FillZero,
}
```

## Helper for creating test files
Look at existing `qdp/qdp-core/tests/common/mod.rs` for test data creation utilities.
Also see `qdp/qdp-core/src/io.rs` for `write_parquet` function to create test files.
