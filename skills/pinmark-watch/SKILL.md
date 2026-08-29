---
name: pinmark-watch
description: Continuous hands-free feedback loop that blocks, listens for new Pinmark annotations, and automatically resolves them.
tools:
  - pinmark_watch_annotations
  - pinmark_acknowledge
  - pinmark_resolve
  - pinmark_ask_question
---

# Pinmark Hands-Free Watch Mode

Use this skill when the user says "watch mode", "listen for annotations", or "watch pins":

## Workflow Loop

1. **Listen / Block for Annotations:**
   Call `pinmark_watch_annotations(batchWindowSeconds=10, timeoutSeconds=180)`.
   - If annotations are returned (`count > 0`), proceed to step 2.
   - If timed out with no annotations, ask the user if they would like to keep watching or stop.

2. **Process Each Annotation:**
   For every annotation in the batch:
   - Call `pinmark_acknowledge(annotationId)`.
   - Inspect the element selector, React component name, and feedback comment.
   - Edit the source code to implement the requested fix.
   - If clarification is needed, call `pinmark_ask_question(annotationId, question="...", agentName="Claude Code")`.
   - Call `pinmark_resolve(annotationId, agentName="Claude Code", summary="...")`.

3. **Repeat Loop:**
   After processing the batch, immediately call `pinmark_watch_annotations` again to continue the hands-free loop until instructed to stop.
