---
name: pinmark
description: Visual feedback and diagnostic debugging assistant with Pinmark MCP tools.
tools:
  - pinmark_list_sessions
  - pinmark_get_session
  - pinmark_get_pending
  - pinmark_get_all_pending
  - pinmark_acknowledge
  - pinmark_resolve
  - pinmark_dismiss
  - pinmark_reply
  - pinmark_ask_question
  - pinmark_highlight_element
  - pinmark_analyze_performance
  - pinmark_suggest_perf_fix
  - pinmark_get_state_snapshot
  - pinmark_audit_a11y
  - pinmark_trace_errors
  - pinmark_triage
  - pinmark_generate_test
---

# Pinmark Agent Skill

When the user asks to review visual feedback, fix bugs reported on the UI, or inspect pins from Pinmark:

## 1. Inspect Pending Annotations
Call `pinmark_get_all_pending` or `pinmark_get_pending(sessionId)` to inspect all unaddressed feedback.

## 2. Acknowledge & Diagnostic Deep Dive
For each pending annotation:
1. Call `pinmark_acknowledge(annotationId)` to signal you are working on it.
2. If runtime errors or crashes occurred, call `pinmark_trace_errors(annotationId)` to get correlated stack traces.
3. If accessibility issues are present, call `pinmark_audit_a11y(annotationId)` for WCAG 2.1 fixes.
4. If application state is corrupted, call `pinmark_get_state_snapshot(annotationId)` to inspect store data.
5. If performance lag/shifts are reported, call `pinmark_suggest_perf_fix(annotationId)`.

## 3. Implement Code Fixes
Locate the component or CSS rule using the selector, React hierarchy, or `debugSource` filePath/lineNumber provided in the annotation payload.

## 4. Resolve & Verify
Once the fix is applied:
1. Call `pinmark_resolve(annotationId, agentName="Claude Code", summary="Fixed padding and updated font contrast")`.
2. Optionally generate a regression test with `pinmark_generate_test(annotationId, framework="playwright", outputDir="tests/e2e")`.
