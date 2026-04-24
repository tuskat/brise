# Security Model

## Intended Use Case

Gemma-Control-Center is designed for **local network access only**:
- Home server or NAS deployment
- Development machine
- Trusted network environment
- No authentication required within trusted network

## What This App Does NOT Implement

| Security Feature | Status | Risk if Exposed |
|-----------------|--------|-----------------|
| User authentication | ❌ Not implemented | Anyone can access |
| Rate limiting | ❌ Not implemented | DoS possible |
| API key encryption | ❌ Stored plaintext | Key theft |
| CSRF protection | ❌ Not implemented | Cross-site requests |
| XSS sanitization | ⚠️ Basic only | Script injection |

## Threat Model

### Assets to Protect

1. **API Keys** — Stored in plaintext JSON files in `/proxies/`
2. **Prompt History** — SQLite database in `/data/`
3. **LLM Backends** — Network-accessible inference servers

### Threats

| Threat | Impact | Mitigation |
|--------|--------|------------|
| Unauthorized LLM usage | Cost abuse, data exposure | Network isolation |
| API key theft | Cloud provider compromise | Local-only deployment |
| Prompt injection | Malicious outputs | Trusted network |
| DoS attacks | Service unavailable | Rate limiting (future) |

## Deployment Recommendations

### ✅ Safe: Local Network Only
- Home LAN with router firewall
- VPN required for remote access
- Single user/trusted users only

### ✅ Safe: Behind Reverse Proxy with Auth
- Traefik + Basic Auth
- Nginx + LDAP/OAuth
- Cloudflare Access

### ❌ Unsafe: Direct Public Exposure
- No authentication layer
- Cloud proxy accessible
- Multi-tenant environment

## API Key Storage

API keys are stored in plaintext in `/proxies/*.json` files:

```json
{
  "id": "cloud-provider",
  "name": "OpenAI",
  "api_key": "sk-..."  // Stored in plaintext
}
```

This is acceptable when:
- Application is on isolated network
- No public internet exposure
- Trusted users only

## Port Exposure

The default port is `4321`. If exposing via router:
- Use port forwarding only with VPN
- Never expose directly to internet
- Consider changing to non-standard port

## Security Checklist

Before deploying:

- [ ] Application is on trusted network
- [ ] No direct internet exposure
- [ ] API keys secured (if cloud providers used)
- [ ] Ollama instances secured
- [ ] SQLite database backed up
- [ ] Regular security audits

## Reporting Security Issues

If you discover a security vulnerability, please **do not** open a public GitHub issue. Instead, open a [GitHub Security Advisory](https://github.com/cedricmarcellin/gemma-control-center/security/advisories/new) or email the maintainer. We aim to respond within 48 hours.
