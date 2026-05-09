// Public redirector to satisfy Meta's CTA URL rule:
// "Only one variable can be added to the end of a URL."
// Receives a base64url-encoded token { p: phone, t: text } and 302s to wa.me.

function decodeToken(token: string): { p: string; t: string } | null {
  try {
    const b64 = token.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const json = atob(b64 + pad);
    const obj = JSON.parse(json);
    if (typeof obj?.p !== 'string') return null;
    return { p: obj.p, t: typeof obj.t === 'string' ? obj.t : '' };
  } catch {
    return null;
  }
}

Deno.serve((req) => {
  try {
    const url = new URL(req.url);
    // Path: /wa-redirect/<token> (Supabase strips the function name? No — keeps full path)
    const parts = url.pathname.split('/').filter(Boolean);
    const token = parts[parts.length - 1] || '';
    const decoded = decodeToken(token);

    if (!decoded) {
      return Response.redirect('https://wa.me/', 302);
    }

    const phone = decoded.p.replace(/\D/g, '');
    if (phone.length < 10 || phone.length > 15) {
      return Response.redirect('https://wa.me/', 302);
    }

    const target = decoded.t
      ? `https://wa.me/${phone}?text=${encodeURIComponent(decoded.t)}`
      : `https://wa.me/${phone}`;

    return Response.redirect(target, 302);
  } catch (_e) {
    return Response.redirect('https://wa.me/', 302);
  }
});