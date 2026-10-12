const STOP = new Set(
  (
    "a an and are as at be but by can could do does for from had has have how i if in into is it its me my of on or our so than that the their them then there these they this to us was we were what when where which who why will with would you your please tell about know get got want need like just any some take give"
  ).split(" ")
);

/** Light stemming: enough to match "returns" with "return" and "shipping" with "ship". */
export function stem(word: string): string {
  let w = word;
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith("es")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

/** Lowercased, stop words removed, stemmed. Order is kept; duplicates are kept. */
export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/'/g, "")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map(stem);
}

/** Small talk in the shop's voice. No reply here ever states a shop fact; facts only come from the FAQ. */
const SMALL_TALK: Array<{ test: RegExp; reply: string }> = [
  {
    test: /^(?:hi|hello|hey|hiya|howdy|yo|greetings|salam|salaam|as+ala+m(?: ?[uo])? ?ala[iy]kum|good (?:morning|afternoon|evening))(?: there| team| fernbrook)?\b[\s!.?,]*$/i,
    reply: "Hi, I'm the Fernbrook shop assistant. I answer from the shop's FAQ, and I'll tell you when something isn't in it. Ask about shipping, returns, orders or plant care.",
  },
  {
    test: /^(?:(?:hi|hey|hello)[,!]? )?(?:how are you(?: doing| today)?|how's it going|how is it going|how are things)[\s!.?]*$/i,
    reply: "Doing well, thanks for asking. What can I look up for you?",
  },
  {
    test: /^(thanks|thank you|thx|cheers)\b[\s!.?a-z]*$/i,
    reply: "You're welcome. Anything else I can look up?",
  },
  {
    test: /^(?:ty|thank u|tysm|much appreciated|appreciate it|appreciated)[\s!.?]*$/i,
    reply: "You're welcome. Anything else I can look up?",
  },
  {
    test: /^(bye|goodbye|see you)\b[\s!.?a-z]*$/i,
    reply: "Goodbye, and thanks for stopping by.",
  },
  {
    test: /^(?:that's all|thats all|that is all|that's it|thats it|nothing else|no thanks|no thank you|i'm good|im good|all good)[\s!.?]*$/i,
    reply: "Glad I could help. Take care.",
  },
  {
    test: /^(?:(?:who|what) are you|are you (?:an? )?(?:real )?(?:bot|robot|human|person|ai|machine)|are you real|is this (?:an? )?(?:real )?(?:bot|robot|person|human|ai))\b[\s!.?]*$/i,
    reply:
      "I'm an automated assistant for Fernbrook Garden Supply, not a person. I answer from the shop's FAQ and show you the entry I used. If something isn't covered, I pass your question to the team.",
  },
  {
    test: /^(?:ok|okay|k|kk|cool|great|nice|perfect|awesome|got it|alright|all right|sure|yes|yep|yeah|no|nope|hmm+|oh|ah|i see|makes sense)[\s!.?]*$/i,
    reply: "Okay. Ask me anything about shipping, returns, orders or plant care.",
  },
  {
    test: /^(?:you're|you are|ur) (?:great|awesome|helpful|amazing|the best|so helpful|smart)[\s!.?]*$|^(?:good|great|nice) (?:bot|job|answer|one)[\s!.?]*$/i,
    reply: "Thanks, that's kind of you. Anything else I can look up?",
  },
];

export function smallTalk(text: string): string | null {
  const t = text.trim();
  for (const s of SMALL_TALK) if (s.test.test(t)) return s.reply;
  return null;
}

const HELP =
  /^(?:help|help me|help please|i need help|can you help(?: me)?|what can you do|what can you help (?:me )?with|what do you know(?: about)?|what can i ask(?: you)?|what (?:topics|questions) can you answer|menu|options)[\s!.?]*$/i;

/** "Help" or "what can you do" on its own. The reply lists the FAQ's real topics. */
export function isHelpRequest(text: string): boolean {
  return HELP.test(text.trim());
}

const LEAD = /^(?:(?:hi|hello|hey|hiya|howdy|yo|salam|good (?:morning|afternoon|evening))(?: there| team)?[\s,!.:]+)+/i;
const TAIL = /[\s,!.]+(?:thanks|thank you|thx|cheers|please|pls|plz)(?: (?:so much|a lot))?[\s!.]*$/i;

/** Removes a greeting before a question and a thank-you after it, so "Hi! How much is shipping, thanks" is matched on the question alone. */
export function stripPleasantries(text: string): string {
  const t = text.trim().replace(LEAD, "").replace(TAIL, "").trim();
  return t || text.trim();
}
