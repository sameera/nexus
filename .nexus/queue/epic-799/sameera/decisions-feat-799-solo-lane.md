## 2026-09-26 — Solo declaration key
- **Choice:** `delivery.solo: true` in `.nexus/config/settings.yml`, read by a new `nexus solo-check` that asks the close-role resolver for shape first.
- **Why:** a `github.*` key would sit beside catalogue rows that inherit from hub defaults, which D2 forbids for a per-repository lane.
- **Refuted alternative:** a top-level `solo: true` scalar, which the two-level settings readers elsewhere in the toolkit would misparse as a section.
