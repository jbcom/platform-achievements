# Security Policy

## Reporting a vulnerability

Please do not open a public issue for a security problem.

Report it privately through
[GitHub Security Advisories](https://github.com/jbcom/platform-achievements/security/advisories/new),
which lets us discuss and fix the issue before it is disclosed.

You can expect an acknowledgement within a few days. If a fix is warranted, we
will prepare it privately, publish a patched release, and credit you in the
advisory unless you would rather remain anonymous.

## Supported versions

The latest `0.x` release receives security fixes. Older pre-1.0 releases are
not patched unless a coordinated disclosure requires an exceptional backport.

## In scope

Examples include package supply-chain issues, unexpected code execution during
install/build, and vulnerabilities in the package's runtime code (it has no
runtime dependencies). The platform plugins and clients an application passes in
(Capacitor, steamworks.js), and the application built on top of platform-achievements,
are outside this repository's
security boundary.
