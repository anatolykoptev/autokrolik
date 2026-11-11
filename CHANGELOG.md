# Changelog

All notable changes are recorded here, following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Apache-2.0 licence (2026-07-16).

### Changed

- README: licence line corrected to Apache-2.0 (the LICENSE file), usage and configuration added.

## [0.1.0] - 2026-03-04

### Added

- Human-on-the-Loop framework write-up (`docs/info.md`).
- `hitl-service`: LangGraph implementation with tier classification (T0-T3), AI execution,
  escalation and human review nodes, Zod types and a Prisma schema.
- VibeProxy integration for LLM access; classification model switched to `gemini-2.5-flash`.
