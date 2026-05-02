


  1. Claude decided not to actually use the tool. The model decides when to search. With tool_choice:
   { type: "auto" } (default — what I'm using) and Opus 4.7's training cutoff at January 2026, it
  already knows about DevDay 2025, AgentKit, Klarna's two-thirds stat, Salesforce Agentforce, etc.
  Its narrative "I'll research this... Let me dig into..." is polite preamble — Claude is
  performative there. If it judged it could answer from training, it skipped the actual web_search
  tool call entirely. No tool call → no web_search_tool_result blocks → no citations. The fix is one
  of:
  - tool_choice: { type: "any" } to force at least one tool call (since web_search is the only tool,
  that forces a search)
  - Or a system prompt: "ALWAYS use the web_search tool to verify and ground every factual claim. Do
  not answer from training knowledge."

  2. Claude DID use the tool but only emitted web_search_tool_result blocks, not per-claim
  web_search_result_location citations on text blocks. This happens when the model summarizes
  findings narratively rather than attaching formal citations to specific sentences. My original
  extractWebCitations only walked text-block citations and missed the result blocks. The fix I
  shipped this session adds a fallback that also reads URLs+titles from web_search_tool_result
  blocks. After that fix the only way to get zero citations is if Claude didn't search at all.

  Diagnostic path that'll tell us which one is happening — I added console logging this session that
  prints block types: [...]; text blocks with citations: N; extracted: N. When you next run Ask
  Claude with Obsidian's dev console open (Cmd+Opt+I), the log line tells us:
  - If block types contains "web_search_tool_result" → Claude searched. Citations should now extract
  via the fallback.
  - If block types has no web_search_tool_result → Claude didn't search. We need tool_choice: any or
  a system prompt to force it.

  No file edits this turn per your direction. When you've run a test and pasted me the
  [ClaudeService] log line, I'll know which fix to make. If you want me to just ship the tool_choice:
   any + system-prompt fix preemptively (it'd handle both failure modes), say the word.