# Security Policy

## Reporting a vulnerability

Please report suspected security vulnerabilities privately via
[GitHub security advisories](https://github.com/IDontKnowMyUsername/trianglify/security/advisories/new).
Please do not open a public issue for security reports.

## Scope notes

Trianglify generates images from caller-supplied options. The main
security-relevant surfaces are:

- **SVG output**: attribute values (e.g. `strokeColor`) are escaped in the
  Node string serializer, so caller-supplied colors cannot inject markup.
- **`Pattern.fromData`**: structurally validates untrusted pattern data
  (worker messages, JSON caches) before rendering.
- **Worker protocol**: malformed messages produce per-request error replies,
  and color-function descriptors resolve only own properties of the built-in
  color function map.

Reports about bypasses of any of the above are very welcome.
