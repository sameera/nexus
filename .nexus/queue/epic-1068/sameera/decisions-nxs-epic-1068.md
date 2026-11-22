## 2026-11-22 — The three verbs share one implementation, not three copies

- **Choice:** `stage-command.ts` holds one runner that all three verbs dispatch into, parameterised by the verb's slash command and its argument rules.
- **Why:** the epic's value is one entry point, and three copies of the model resolution and refusal order would drift on the first change to either.
- **Refuted alternative:** one module per verb, each with its own session launcher.

## 2026-11-22 — The session is spawned with the lead's own terminal

- **Choice:** `spawnInteractive` spawns `claude` with `stdio: "inherit"` and reads only the exit code.
- **Why:** the stages ask the lead at their gates, so the harness must own the keyboard and the screen; the headless stream reader `nexus implement` uses would consume output an interactive session needs to draw.
- **Refuted alternative:** reusing `spawnSession` from `distill-command.ts`, which parses a stream-json event stream that an interactive session never emits.

## 2026-11-22 — `--planning-model` is the command's flag and is stripped before the prompt

- **Choice:** the flag and its value are removed from the arguments the stage receives, and the model is passed to the harness as `--model`.
- **Why:** the stage would otherwise be handed a token it does not understand, and the story requires the session to run on that model rather than on a stage argument.
- **Refuted alternative:** leaving the token in the prompt and letting the stage ignore it.

## 2026-11-22 — `nexus decision-record` normalises the epic to `#N`

- **Choice:** `N` and `#N` both hand the stage `/nxs.decision-record #N`.
- **Why:** the story requires both forms to start the same session, and the stage's own input section names the epic by its reference form.
- **Refuted alternative:** passing the argument through verbatim, which starts two different prompts for one epic.

## 2026-11-22 — A missing harness on the PATH refuses instead of starting nothing

- **Choice:** the command checks `onPath("claude")` before printing or spawning, and exits 1 naming the harness.
- **Why:** CONTRIBUTING.md documents that a missing executable in a command substitution fails silently; here the failure would look like a session that ended instantly.
- **Refuted alternative:** letting `spawn` report ENOENT after the command has already announced the session.
