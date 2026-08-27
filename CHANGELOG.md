# Releases

Every release is one package carrying both toolkits, the component payload and this entry. What
an item says is what a lead running a pipeline stage will experience differently — not what a
commit was called, not which file moved, not which library moved. A release that changes no stage
behaviour says so.

## 0.1.0

- Nexus installs from the public registry instead of being cloned. Both toolkits land on your
  path from one install, and the components travel inside the package, so every stage from setup
  through distill runs without a checkout and without a second fetch after installing.
- The Nexus components are no longer committed in your own repository, so a component change no
  longer shows up in your own diff. From this release on, a change to what the epic,
  decision-record, analyze, close or distill stage decides is reported here instead.
- Running any stage leaves no interpreter byte-code behind in the repository it ran against.
