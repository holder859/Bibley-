/* bible-ai-rules-injector.js
   Applies the rules from bible-ai-rules.js to every AI call the app
   makes. You shouldn't need to edit this file -- edit
   bible-ai-rules.js instead.

   Why this exists: the app's AI code (system prompts, generateWithAI,
   etc.) lives entirely inside index.html's own inline <script>, in a
   closure that isn't exposed to other files -- there's no
   window.generateWithAI or window.someSystemPrompt to hook into
   directly. But every one of its AI calls (Chapter, Verse, Outline,
   Compare, Chatbot) ends up doing the same thing: a plain
   window.fetch() to one of two free providers --
     - https://api.llm7.io/v1/chat/completions
     - https://text.pollinations.ai/openai
   -- with a JSON body containing messages: [{role:"system", ...}, ...].
   That's a real, public, load-bearing browser API, so this file wraps
   window.fetch *before* the app ever calls it, and folds the rules
   into the outgoing "system" message right before it's sent -- without
   needing to touch or understand the app's own closures.
*/
(function () {
  "use strict";

  var AI_HOSTS = ["api.llm7.io", "text.pollinations.ai"];

  function isAiRequest(url) {
    if (!url) return false;
    return AI_HOSTS.some(function (host) { return url.indexOf(host) !== -1; });
  }

  function urlFromArgs(input) {
    if (typeof input === "string") return input;
    if (input && typeof input.url === "string") return input.url; // Request object
    return "";
  }

  function buildRulesBlock(rules) {
    if (!rules || !rules.length) return "";
    return "ADDITIONAL RULES YOU MUST FOLLOW:\n" +
      rules.map(function (r) { return "- " + r; }).join("\n");
  }

  function applyRulesToBody(bodyText) {
    var cfg = window.BibleAIRules;
    if (!cfg || !cfg.enabled) return bodyText;
    var block = buildRulesBlock(cfg.rules);
    if (!block) return bodyText;

    var parsed;
    try {
      parsed = JSON.parse(bodyText);
    } catch (e) {
      return bodyText; // not JSON, or not the shape we expect -- leave untouched
    }
    if (!parsed || !Array.isArray(parsed.messages)) return bodyText;

    var sysMsg = parsed.messages.filter(function (m) { return m && m.role === "system"; })[0];
    if (!sysMsg || typeof sysMsg.content !== "string") return bodyText;

    sysMsg.content = cfg.position === "before"
      ? block + "\n\n" + sysMsg.content
      : sysMsg.content + "\n\n" + block;

    try {
      return JSON.stringify(parsed);
    } catch (e) {
      return bodyText;
    }
  }

  var originalFetch = window.fetch.bind(window);

  window.fetch = function (input, init) {
    var url = urlFromArgs(input);
    if (!isAiRequest(url) || !init || typeof init.body !== "string") {
      return originalFetch(input, init);
    }
    var newInit = Object.assign({}, init, { body: applyRulesToBody(init.body) });
    return originalFetch(input, newInit);
  };
})();
