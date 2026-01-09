# Stage 09 - Docs and Release

## Baseline Context (standalone)
- Core and CLI features are stable.
- Tests pass and binaries can be produced.

## Goals
- Provide complete documentation and packaging.
- Make install and upgrade straightforward.

## Tasks

### S09-T01: Documentation
Steps:
- Write README with quick start and examples.
- Add configuration reference and troubleshooting.
Deliverables:
- `README.md`, `docs/configuration.md`, `docs/troubleshooting.md`
Acceptance criteria:
- New users can install and run a model with minimal steps.

### S09-T02: Packaging
Steps:
- Ensure build outputs a single executable entry.
- Configure `bin` in CLI package and verify global install works.
Deliverables:
- Build outputs and package metadata.
Acceptance criteria:
- `npm install -g` provides the `ollm` command.

### S09-T03: Release checklist
Steps:
- Add versioning, changelog, and release notes template.
Deliverables:
- `docs/release-checklist.md`
Acceptance criteria:
- Release steps are documented and repeatable.
