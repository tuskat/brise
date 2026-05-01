# Changelog

All notable changes to Brise are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
adheres to [Semantic Versioning](https://semver.org/).

## [0.2.5] - 2026-04-27

### Added
- New `svg` format-schema (suggestion type, blocks scripts/event handlers).
- Personas import/export (`/api/personas/export`, `/api/personas/import`) with
  conflict modes skip/overwrite/rename. Export/Import buttons in Personas tab.
- Vault tab: AES-256-GCM + scrypt encrypted secret store. Setup, unlock,
  lock, rotate-passphrase, per-entry CRUD with masked previews and
  reveal-on-click. Session token in `localStorage`, 15-min idle timeout.
- Bottom-right "Vault locked" indicator pill — appears when the vault is
  initialized but locked or after a 401 vault_locked from any API call;
  click to jump to the Vault tab.
- Proxies form: replaced free-text API-key input with a vault entry picker
  filtered by api_schema. Auto-migration of existing inline keys into the
  vault on first unlock.
- Proxies import/export and Vault import/export. Vault export ships the
  already-encrypted ciphertexts; import requires the original passphrase
  in either `merge` (vault initialized) or `replace` (wipe + adopt) mode.

### Changed
- `/api/proxies` no longer accepts or exposes `api_key`; clients use
  `vault_entry_id`. Internal callers (chat, playground, proxy test) resolve
  the secret via the vault session token (`X-Vault-Token` header).

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
