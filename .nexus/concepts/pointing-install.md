---
title: "Pointing Install"
aliases: ["pointing install", "checkout-pointing mode", "two possible contents", "maintainer's edit-and-rerun loop", "pointers at a checkout", "point the install location at a checkout"]
touches: ["install-location", "authored-component-root", "environment-guard"]
last_updated_by: "#256"
status: active
verification: verified
---

# Pointing Install

The second of the two contents an account's install location can hold: one pointer per payload file at a maintainer's authored checkout, rather than a copy of a release. It lets the people who develop Nexus consume it exactly as an adopter does, with an edit live in the next session and no copy to refresh. It is a content of the one install location, never a second location and never a mode flag.

## How It Works

Which directory of the checkout the pointers name is not spelled out at the install verb. It comes from the one definition of where a checkout authors its components, so pointers and tree cannot come to name different places — and the two change in a single landing, because a pointer placed against a tree that has since moved dangles while the verb that would repair it still looks in the vacated place.

Pointers rather than copies buy three properties at once. Files in the same subtrees that Nexus does not own stay visible. Removal deletes a pointer as an entry, never reading or deleting the file it names, so a live developer checkout on the far side is never reached through. And the duplicate diagnostic, which compares resolved real paths, sees pointers and checkout as the same files — so a maintainer's arrangement needs no exemption from the one-set rule.

The release read-out names which content is present and, here, the checkout the pointers resolve into — a working loop and a stale copy are otherwise indistinguishable without inspecting the files by hand.

## Key Invariants

1. This is a content of the single install location — never a second location, never a source-mode flag, never an exemption in the duplicate check.
2. The checkout's authored tree is derived from the one definition that names it, and that derivation changes in the same landing as the tree.
3. Placement writes pointers only: no path writes through one into the checkout.
4. Removal deletes a pointer as an entry, without reading or deleting the file it names.
5. Files Nexus does not own in the same managed subtrees stay visible and are never removed.
6. The duplicate diagnostic resolves both sides to the same real files, so this arrangement cannot report as two component sets.
7. Any verb reporting this content also names the checkout the pointers resolve into.

## Integration Points

- [install-location](install-location.md) — the single account-scoped location this is one of the two contents of; its resolution rules and explicit-placement rule apply unchanged here.
- [authored-component-root](authored-component-root.md) — the directory inside the checkout these pointers resolve, reached through that root's one definition rather than a name repeated here.
- [environment-guard](environment-guard.md) — the duplicate diagnostic that compares resolved real paths, which is why this arrangement needs no exemption from the one-set rule.

## Decision Log

### 2026-08-28 — #256 — Split from install-location as the maintainer's arrangement gained substance

Born of the split at install-location's capacity: once the authored tree moved out of the directory the harness loads, this content became the whole mechanism by which Nexus is developed, with a derivation of its own, a read-out of its own and a standing reason it needs no exemption from the one-set rule. Its derivation of a checkout's authored tree and the tree's location were made to move together, because sequencing them apart breaks the maintainer's loop inside exactly the window the epic's ordering gate exists to protect — and breaks it after that gate has been recorded as passed. Refuted: a maintainer-only mode flag on the toolkit, which reads as more explicit and loses because every flag is a branch the adopter path never exercises, and it re-introduces the exemption this design removed.
