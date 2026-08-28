
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
    if (input && typeof input.url === "string") return input.url; 
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
      return bodyText; 
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
