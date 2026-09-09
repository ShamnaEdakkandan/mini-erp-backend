let csrfToken = "";
export async function api(path, { method = "GET", body } = {}) {
  let response;
  try {
    response = await fetch(`/api/${path}`, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json", "X-CSRFToken": csrfToken },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error(
      "Cannot reach Django. Check that the backend is running, then retry.",
    );
  }
  const data =
    response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 403)
      window.dispatchEvent(new Event("session-check"));
    const details = data?.errors || data;
    function explain(value, prefix = "") {
      if (Array.isArray(value))
        return value
          .map((item, index) =>
            explain(
              item,
              typeof item === "object" ? `${prefix} ${index + 1}` : prefix,
            ),
          )
          .join(" ");
      if (value && typeof value === "object")
        return Object.entries(value)
          .map(([key, item]) =>
            explain(
              item,
              key === "detail" ? prefix : `${prefix} ${key}`.trim(),
            ),
          )
          .join(" ");
      return `${prefix ? prefix + ": " : ""}${value}`;
    }
    const message = details
      ? explain(details)
      : response.status >= 500
        ? "The backend is unavailable. Start Django or check its server logs, then retry."
        : "Request failed. Check the backend connection and refresh your session.";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  if (response.status !== 204 && (!data || typeof data !== "object")) {
    throw new Error("The backend returned an invalid response. Check the API address and retry.");
  }
  if (data?.csrfToken) csrfToken = data.csrfToken;
  return data;
}
