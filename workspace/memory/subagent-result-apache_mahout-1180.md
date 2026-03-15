# Subagent Result: apache/mahout#1180

## Status: success

## PR URL
https://github.com/apache/mahout/pull/1194

## Summary
Added comprehensive tests for streaming amplitude encoder coverage as requested in issue #1180.

## Files Changed
1. `qdp/qdp-core/tests/amplitude_encoder.rs` (new file - 403 lines)
   - 10 new test functions covering the streaming amplitude encoder
2. `qdp/qdp-core/src/lib.rs`
   - Made `encoding` module public
3. `qdp/qdp-core/src/encoding/mod.rs`
   - Made `ChunkEncoder` trait public
   - Made `STAGE_SIZE_ELEMENTS` constant public
4. `qdp/qdp-core/src/encoding/amplitude.rs`
   - Made `AmplitudeEncoder` struct public
   - Made `AmplitudeEncoderState` struct public

## Test Coverage Added

### Direct Encoder Tests
- `test_amplitude_encoder_rejects_zero_sample_size`: Validates `validate_sample_size` rejects 0
- `test_amplitude_encoder_rejects_oversized_sample`: Validates rejection of sizes > STAGE_SIZE_ELEMENTS
- `test_amplitude_encoder_accepts_valid_sample_size`: Validates acceptance of valid sample sizes
- `test_amplitude_encoder_init_state_success`: Tests `init_state` allocation

### End-to-End Streaming Tests
- `test_amplitude_encoder_streaming_encode_list`: Full streaming test with `List<Float64>` Parquet files
- `test_amplitude_encoder_streaming_encode_large_batch`: Tests batch encoding with 16 samples
- `test_amplitude_encoder_streaming_file_not_found`: Error handling for missing files
- `test_amplitude_encoder_streaming_fixed_size_list`: Tests `FixedSizeList<Float64>` column format
- `test_amplitude_encoder_rejects_invalid_column_type`: Validates rejection of non-List columns
- `test_amplitude_encoder_rejects_empty_data`: Validates rejection of empty sample data

## Notes
- Tests follow existing patterns from `gpu_api_workflow.rs` and `gpu_validation.rs`
- All tests are gated with `#[cfg(target_os = "linux")]` for CUDA support
- Tests gracefully skip when GPU is unavailable using `let Some(engine) = common::qdp_engine() else { return; }` pattern
- Cannot verify locally due to macOS/CUDA incompatibility, but code follows established patterns
