/** Remove emails and phone numbers before anything is stored, so the demo admin never shows them. */
export function redact(text: string): { text: string; redacted: boolean } {
  let out = text;
  out = out.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email removed]");
  out = out.replace(/(?<![\w.])(?:\+?\d[\d\s().-]{7,}\d)(?![\w.])/g, "[number removed]");
  return { text: out, redacted: out !== text };
}
