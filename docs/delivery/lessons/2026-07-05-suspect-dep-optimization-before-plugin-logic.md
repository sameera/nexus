---
date: 2026-07-05
epic: "Editable Command Input"
source: "#25"
---

# Lesson: with Vite + a deep-import lib, suspect dep-optimization before component logic

The epic's largest unplanned cost was a false bug. Enter-to-submit "only inserted a newline"
— but only on a cold dev-server start. The `CommandSubmitPlugin` was correct the whole time.
The real cause: `@nexus/editor` pulls in ~20 separate `@lexical/*` entry points, and on a cold
start Vite discovers them one request at a time, forcing repeated full-page "Outdated Optimize
Dep" reloads. A keystroke landing mid-reload hit a page whose command handler had just been
torn down. The fix was one line — pre-declare those entry points in `optimizeDeps.include` —
not a code change.

Two lessons for the next epic in this area:

- **When a rich-editor / framework feature works after the dev server settles but breaks on a
  cold start, suspect the build's dependency-optimization reload storm before the component
  logic.** A lib that fans out into many deep transitive imports is the tell. Front-load a
  headless end-to-end smoke (a real dev server + Playwright) early — it is what separated a
  build-config artifact from a plugin defect here, and it would have caught it before the bug
  report.

- **Budget framework-integration friction into the estimate when adopting a rich editor.** The
  three stories (M/S/S) were sized for the feature itself; the substrate's dev-server and
  jsdom-testing quirks (no layout engine → drive Lexical through its model API, not synthetic
  keyboard events) were the real time sink. When a story's complexity driver is "adapt an
  existing lib," add slack for the integration seams the lib does not document.
