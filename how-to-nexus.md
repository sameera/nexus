# Getting Started with Nexus

## How this works: The Big Idea

Instead of letting an AI jump straight from “Here’s my vague idea” to “Here’s 3,000 lines of code,” Nexus forces a pause between the important thinking steps.

Each pause exists for one reason only, to make you look at fewer decisions at a time.

That is it. No magic. No enforcement. No lectures.

## Grounded in Your Reality

Nexus does not work in a vacuum. It actively reads and uses the documentation already present in your project, things like your vision, goals, prior architectural decisions, existing features, coding conventions, and testing patterns. The AI is not guessing how your system works. It is grounding its output in what you have already agreed is true.

That context is carried forward across every phase.

---

## The Workflow in Plain English

You work through four commands, in order:

1. `nxs.epic`, figure out what problem you are actually solving
2. `nxs.hld`, decide how the system should work at a high level
3. `nxs.tasks`, break the work into pieces that make sense
4. `nxs.dev`, write code for one piece at a time

Each step is a separate conversation with the AI. That separation is the feature.

At every step, the AI is pulling from your project’s own documentation rather than inventing a fresh mental model each time.

---

## A Concrete Example: Adding Audit Logging

Suppose you say:
“We need audit logging for compliance.”

If you hand that directly to an AI, it will happily invent requirements, architectures, schemas, and retention policies, all before you finish your coffee.

Nexus makes you slow that down.

---

## Step 1: `nxs.epic`, Stop and Define the Problem

You start with your fuzzy requirement.

`nxs.epic` looks at your existing project context, your stated goals, and any prior decisions around security, compliance, or observability. Then it pushes back.

It will surface questions like:

-   What actions count as auditable?
-   Who can read these logs?
-   How long do they live?
-   How expensive can this get?

Your job here is not to be clever. It is to make sure everyone agrees on what “audit logging” even means before you build anything.

---

## Step 2: `nxs.hld`, Decide What You Are Building, Not How

Once the problem is clear, you move to `nxs.hld`.

Now the AI talks about architecture.
Components.
Data flow.
Trade-offs.

This is the “are we comfortable living with this design for the next two years” step.

If the answer is no, fix it here. It is still cheap.

---

## Step 3: `nxs.tasks`, Break the Spell of the Mega-Task

After the design makes sense, `nxs.tasks` breaks the work down.

Not into a hundred tiny chores, and not into one terrifying super-task.

Into pieces that you can reason about independently.

If a single task feels like it needs a design doc, it is too big. Split it.

---

## Step 4: `nxs.dev`, Write Code with Your Eyes Open

Finally, you pick one task and run `nxs.dev`.

Now the AI writes code, but only for that task.

This is where the whole approach pays off. You are no longer reviewing “the system.” You are reviewing one narrow decision at a time.

Does this code match the intent?
Did the AI sneak in assumptions?
Is this actually what we agreed to build?

You repeat this until the work is done.

---

## How to Not Sabotage Yourself

A few hard-earned rules:

-   Do not collapse phases just because you are in a hurry
-   Use early phases to argue about intent, not implementation
-   Treat each boundary as a real review, not a speed bump to click past
-   If it feels obvious, you’re probably not paying attention
-   Keep project documentation current, the AI can only respect decisions you have written down

Experienced developers can still move fast. Nexus just makes sure that speed is a conscious choice.

---

## When Nexus Is Worth the Trouble

This shines when:

-   You are changing architecture
-   You are adding cross-cutting concerns like security or observability
-   You expect real code review, not drive-by approval
-   You are working with other humans who need shared understanding

If the task is trivial, skip it. Nexus is a tool, not a religion.

---

## The Mental Model

Nexus does not prevent bad decisions.

It prevents bad decisions from happening silently.

And in a world where AI is very good at confidently doing the wrong thing at high speed, that turns out to be surprisingly valuable.
