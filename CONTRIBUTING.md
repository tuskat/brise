# Contributing to Brise

Thanks for your interest! Here's how to get started.

## Development Setup

```bash
# Clone and install
git clone https://github.com/cedricmarcellin/brise.git
cd brise
npm install

# Start dev server
npm run dev

# Run tests
npm test
```

## Making Changes

1. **Fork** the repo and create a feature branch from `main`
2. **Make your changes** — follow the conventions below
3. **Run tests** — `npm test` must pass before submitting
4. **Build check** — `npm run build` must succeed
5. **Open a Pull Request** with a clear description of the change

## Conventions

- **Naming:** `snake_case` for CSS classes and file names, `camelCase` for JS
- **Styles:** CSS custom properties only — no Tailwind, no CSS-in-JS, no `<style is:global>`
- **Components:** Astro components in `src/components/` (atoms, components, tabs)
- **Client JS:** ES modules in `src/utils/` — no frameworks, vanilla only
- **API routes:** `src/pages/api/` — always return `{ status, data, latency_ms }` envelope
- **Database:** SQLite via `better-sqlite3` — access through `src/db/index.js` only
- **No BEM:** Single-dash class names only (`btn-primary`, not `btn--primary`)

## Reporting Bugs

Open a [GitHub Issue](https://github.com/cedricmarcellin/brise/issues) with:

- What you expected to happen
- What actually happened
- Steps to reproduce
- Your environment (OS, Node version, deployment method)

## Security Vulnerabilities

**Do not** open a public issue. See [SECURITY.md](SECURITY.md) for responsible disclosure.

## License

By contributing, you agree that your changes will be licensed under the [CC BY-NC-SA 4.0](LICENSE).
