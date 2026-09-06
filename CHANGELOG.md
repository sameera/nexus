# Releases

Every release is one package carrying both toolkits, the component payload and this entry. What
an item says is what a lead running a pipeline stage will experience differently — not what a
commit was called, not which file moved, not which library moved. A release that changes no stage
behaviour says so.

## 0.3.0

- No change to how any pipeline stage behaves.

## 0.2.0

- **Breaking.** The second command name is withdrawn. Every stage — setup through distill — now
  runs through the one `nexus` command, and an invocation using the old second name fails. Nothing
  in the release needs a Python interpreter any more, so a machine with no Python runs the whole
  pipeline.
- The epic, decision-record and discover stages now refuse a draft that carries scope nobody asked
  for. Every scope-bearing item states where it came from, and a draft that breaks the counted
  limits is sent back rather than filed.
- A reviewer at the epic approval gate can cut a story from the draft in one action, instead of
  restating the epic to get a smaller one.
- The epic, decision-record, discover and distill stages hand their drafted artifact to a prose
  translator before a lead reads it, so what comes back is in plain language rather than the
  drafting voice.
- The sequencing page is retired. The backlog query is now the only inventory of unstarted work,
  and the ordering a lead follows is the blocked-by graph on the issues themselves, so the epic
  stage no longer maintains a wave table that could go stale against the issues.

## 0.1.0

- Nexus installs from the public registry instead of being cloned. Both toolkits land on your
  path from one install, and the components travel inside the package, so every stage from setup
  through distill runs without a checkout and without a second fetch after installing.
- The Nexus components are no longer committed in your own repository, so a component change no
  longer shows up in your own diff. From this release on, a change to what the epic,
  decision-record, analyze, close or distill stage decides is reported here instead.
- Running any stage leaves no interpreter byte-code behind in the repository it ran against.
