# Changelog

All notable changes to Brise are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
adheres to [Semantic Versioning](https://semver.org/).

## [0.2.4] - 2026-04-26

### Added
- Generic NAS deploy script `scripts/deploy-nas.sh` driven by per-NAS profile
  files in `scripts/nas-profiles/` (ugreen, synology, qnap, unraid, truenas).
- One-shot update wrapper `scripts/update.sh` — set `NAS_TYPE` + `DEPLOY_HOST`
  once and re-run for every update.

### Changed
- `scripts/deploy-ugreen.sh` is now a thin back-compat shim around
  `deploy-nas.sh` (`NAS_TYPE=ugreen`).
- `DEPLOYMENT.md` rewritten around the new generic flow with a per-NAS
  prerequisites table.
- Harmonized version reporting: `package.json`, `docs/package.json`, and the
  sidebar UI now all read `0.2.4` (previously split between `0.1.0` and `0.2.0`).
