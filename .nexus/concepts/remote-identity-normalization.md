---
title: "Remote Identity Normalization"
aliases: ["remote normalization", "git remote matching", "same-remote comparison", "remote identity rule"]
touches: ["workspace-resolution"]
last_updated_by: "#38"
status: active
verification: verified
---

# Remote Identity Normalization

A single git remote can be written many equivalent ways — as a secure-shell address or a web address, with or without a trailing suffix, with an upper- or lower-cased host. Remote identity normalization is the one rule that reduces any spelling to a canonical identity so workspace resolution can decide whether two checkouts name the same repository. Matching raw remote strings would silently break workspace parity when two checkouts present different spellings; this rule is what prevents that.

## How It Works

The rule compares two coordinates only: the host and the repository path. It ignores the protocol a remote was written in and any trailing suffix, so a secure-shell spelling and a web spelling of the same repository reduce to one identity. The host is lower-cased, because host names are case-insensitive, so lowering them is always safe. The repository path keeps its original case, because some self-hosted forges treat repository paths as case-sensitive, and two genuinely different repositories could differ only in path case.

Workspace resolution applies this rule wherever remote identity matters: verifying that the hub a member's pointer names is the hub actually found at the expected sibling, and rejecting a manifest that lists two members resolving to the same remote. The recommended default is to treat "no matching remote" as a named diagnostic rather than a silent pass, so a genuine misconfiguration is reported instead of quietly ignored.

## Key Invariants

1. Two remotes match if and only if their host and repository path match after normalization.
2. The protocol and any trailing suffix are ignored when comparing remotes.
3. The host is compared case-insensitively; the repository path is compared with its original case preserved.
4. A remote matching nothing is a named diagnostic, not a silent non-match.

## Integration Points

- [workspace-resolution](workspace-resolution.md) — resolution uses this rule to verify a member's pointer names the located hub and to reject two members that resolve to the same remote.

## Decision Log

### 2026-07-12 — #38 — Lower-case the host, preserve the repository path's case

One normalization rule comparing host plus path — ignoring the protocol and any trailing suffix — is required so differing spellings of the same remote do not silently break parity. Host names are case-insensitive, so lower-casing the host is always safe, but some self-hosted forges are path-case-sensitive, so the repository path's case is preserved to avoid a false "same remote" match between genuinely different repositories. Refuted alternative: lower-case the whole remote string — it matches more spellings on the largest host, but risks a false duplicate on case-sensitive hosts.
