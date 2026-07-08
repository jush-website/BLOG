// Matches the file id in the shapes Drive hands out:
//   /file/d/<ID>/view   ?id=<ID>   /d/<ID>
const DRIVE_FILE_ID = /(?:\/file\/d\/|\/d\/|[?&]id=)([\w-]{10,})/;

/**
 * Make a pasted image URL actually renderable in an <img>.
 *
 * Measured against a real public Drive file (cache-busted, 2 runs each):
 *   uc?export=view&id=   -> blocked by ORB, both runs
 *   uc?id=               -> blocked by ORB, both runs
 *   thumbnail?id=&sz=    -> loads, both runs          <- the only reliable one
 *   lh3.googleusercontent.com/d/ -> loaded once, blocked once (throttled)
 *
 * `thumbnail` is undocumented and Google has already killed the other two, so treat
 * it as borrowed time. We normalise at *render* time and store whatever the user
 * pasted: if the endpoint changes, fix it here and every existing card heals —
 * nothing in Firestore has to be rewritten.
 *
 * Anything we don't recognise is passed through untouched.
 */
export function toDirectImageUrl(input) {
  // base64 uploads are the common case and can be ~100KB — bail before any string work
  if (typeof input !== 'string' || input.startsWith('data:')) return input || '';

  const url = input.trim();
  if (/^https?:\/\/(?:drive|docs)\.google\.com\//i.test(url)) {
    const id = url.match(DRIVE_FILE_ID)?.[1];
    if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w1600`;
  }
  return url;
}

/**
 * Wrap a URL for use in a CSS `url(...)` value. Quote it and escape the characters
 * that would otherwise terminate the string and let a pasted URL inject its own
 * declarations. Safe for `data:` URLs, whose base64 alphabet needs no escaping.
 */
export function cssUrl(input) {
  if (!input) return 'none';
  return `url("${String(input).replace(/["\\]/g, '\\$&')}")`;
}

/**
 * A link card's destination is rendered as <a href> on a page shared with strangers.
 * React escapes the attribute but does not stop `javascript:` from executing on click,
 * so restrict the scheme. Returns '' for anything not safe to navigate to.
 */
export function safeHref(input) {
  if (typeof input !== 'string') return '';
  const url = input.trim();
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:' ? url : '';
  } catch {
    return ''; // relative or unparseable
  }
}
