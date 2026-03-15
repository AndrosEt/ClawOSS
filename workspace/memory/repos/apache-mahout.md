# apache/mahout Repository Conventions

## Basic Info
- License: Apache 2.0
- Default branch: main
- Languages: Rust (628KB dominant), Python (418KB), TypeScript, CUDA
- Project: Apache Mahout - ML framework with QDP (Quantum Data Processing) subproject

## Contribution Workflow
- Open issue first (exists: #1184)
- Create feature branch
- Pre-commit hooks auto-run on commit
- Run `make pre-commit` from repo root for manual checks
- Tests auto-skip if QDP extension not installed

## Build/Test Commands
```bash
# Install dependencies
uv sync --group dev
uv sync --group dev --extra qdp  # With GPU support

# Run pre-commit
make pre-commit
pre-commit run
pre-commit run --all-files
```

## Code Style
- Apache header on all files
- Rust code uses standard conventions
- Pre-commit enforces formatting

## Branch Naming
Use descriptive names: `your-feature-name`
For ClawOSS: `clawoss/test/parquet-reader-coverage`

## Notes
- Issue #1184 references #1058
- Tests in `qdp/qdp-core/tests/parquet_io.rs` exist but don't cover `readers/parquet.rs` directly
- Target file: `qdp/qdp-core/src/readers/parquet.rs` (0% coverage)
