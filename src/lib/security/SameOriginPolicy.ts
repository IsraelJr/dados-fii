const HOST_PATTERN = /^(?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?|\[[0-9a-f:]+\])(?::\d{1,5})?$/i;

function firstForwardedValue(value: string | null) {
  const first = value?.split(",")[0]?.trim() ?? "";
  return first;
}

function expectedOrigin(request: Request) {
  let requestUrl: URL;
  try {
    requestUrl = new URL(request.url);
  } catch {
    return null;
  }

  const forwardedHost = firstForwardedValue(request.headers.get("x-forwarded-host"));
  const directHost = String(request.headers.get("host") ?? "").trim();
  const host = (forwardedHost || directHost || requestUrl.host).toLowerCase();
  if (!HOST_PATTERN.test(host)) return null;

  const forwardedProto = firstForwardedValue(request.headers.get("x-forwarded-proto")).toLowerCase();
  const protocol = forwardedProto || requestUrl.protocol.slice(0, -1).toLowerCase();
  if (protocol !== "https" && protocol !== "http") return null;

  return `${protocol}://${host}`;
}

export function isStrictSameOrigin(request: Request) {
  const rawOrigin = String(request.headers.get("origin") ?? "").trim();
  if (!rawOrigin || rawOrigin.toLowerCase() === "null") return false;

  const expected = expectedOrigin(request);
  if (!expected) return false;

  try {
    const origin = new URL(rawOrigin);
    if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/") {
      return false;
    }
    if (origin.protocol !== "https:" && origin.protocol !== "http:") return false;
    return origin.origin.toLowerCase() === expected;
  } catch {
    return false;
  }
}
