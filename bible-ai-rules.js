/* bible-ai-rules.js
   Edit THIS file to change what the Study Assistant AI is and isn't
   allowed to do. You don't need to touch index.html or understand how
   it works -- just edit the RULES array (and the switches below it)
   and reload the page.

   How it works, briefly: every AI call in the app (Chapter, Verse,
   Outline, Compare, and the Chatbot) already funnels through one
   "system" instruction before it's sent to the free AI provider. This
   file's rules get folded into that instruction automatically, on
   every single call, regardless of which Study mode (Scholar / Strict
   / Cross-centered / Conversational) is selected. See
   bible-ai-rules-injector.js for the (no-need-to-edit) code that does
   the folding-in.
*/
(function () {
  "use strict";

  window.BibleAIRules = {

    // Master on/off switch for everything in this file.
    enabled: true,

    // "before"  -- your rules are given to the AI first, then the
    //              mode's own instructions (Scholar/Strict/etc.).
    // "after"   -- the mode's instructions come first, your rules are
    //              appended last (most models weight later text more
    //              heavily, so "after" is the stronger position if a
    //              rule conflicts with the mode prompt).
    position: "after",

    // Plain-English rules, one per line. Add, remove, or reword these
    // freely -- each one gets added as its own line under a
    // "ADDITIONAL RULES YOU MUST FOLLOW:" heading before being sent.
    rules: [
      "Never invent a Bible verse, quote, or reference that was not provided to you.",
      "If you are not confident about something, say so plainly instead of guessing.",
      "Keep responses respectful of all Christian denominations unless the user's selected mode says otherwise.",
      "Do not use profanity or crude language.",
      "Do not give medical, legal, or financial advice, even if a chapter's topic brushes against it -- gently redirect back to the text."
    ]
  };
})();
