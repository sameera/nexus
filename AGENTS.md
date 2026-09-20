# Working on Nexus

Read `CLAUDE.md` and `CONTRIBUTING.md` before changing this project. They are the shared project
overview and contributor conventions for both Codex and Claude; keep those instructions in one
place.

Author pipeline components under `components/`. Do not deploy Nexus into this checkout's loaded
skill directories. Codex skills are generated from the shared components by
`nexus install --harness codex`; Claude continues to load the original components.
