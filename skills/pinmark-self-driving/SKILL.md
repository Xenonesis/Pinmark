---
name: pinmark-self-driving
description: Autonomous loop where the agent browses the UI, drops Pinmark annotations on flaws, edits code to fix each issue, and resolves pins.
---

# Pinmark Self-Driving Mode

When the user requests "self-driving mode" or "autonomous polish":

1. **Scan UI:** Browse the running local frontend.
2. **Annotate Flaw:** Identify a concrete visual issue and register a Pinmark pin.
3. **Edit Code:** Locate the corresponding component or style file and fix the issue.
4. **Resolve & Verify:** Call `pinmark_resolve` with a short summary, verify in browser, and advance to the next issue.
