/** Authenticated same-origin CAP LicenseService client. Never expose C4C credentials here. */
export class LicenseApiError extends Error {
  constructor(message, status = null, uncertain = false) {
    super(message);
    this.name = "LicenseApiError";
    this.status = status;
    this.uncertain = uncertain;
  }
}
function unbox(body) {
  return body && typeof body === "object" && "value" in body
    ? body.value
    : body;
}
async function request(path, { body, fetcher = fetch } = {}) {
  const writing = body !== undefined;
  let csrf;
  if (writing) {
    let auth;
    try {
      auth = await fetcher("/licenses-api/$metadata", {
        credentials: "same-origin",
        cache: "no-store",
        headers: { "X-CSRF-Token": "Fetch" },
      });
    } catch {
      throw new LicenseApiError(
        "Could not fetch CSRF token; request was not submitted",
      );
    }
    if (!auth.ok)
      throw new LicenseApiError("License session is unavailable", auth.status);
    csrf = auth.headers.get("x-csrf-token");
    if (!csrf)
      throw new LicenseApiError("Missing CSRF token; no C4C request was sent");
  }
  let response;
  try {
    response = await fetcher(`/licenses-api/${path}`, {
      method: writing ? "POST" : "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(writing
          ? { "Content-Type": "application/json", "X-CSRF-Token": csrf }
          : {}),
      },
      ...(writing ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new LicenseApiError(
      writing
        ? "The response was lost. The request may have reached C4C; do not resubmit until its status is confirmed."
        : "Cannot reach the license service.",
      null,
      writing,
    );
  }
  let result;
  if (
    (response.headers.get("content-type") || "")
      .toLowerCase()
      .includes("application/json")
  ) {
    try {
      result = await response.json();
    } catch {
      /* no provider secrets disclosed */
    }
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403)
      throw new LicenseApiError(
        "License access is not authorized for this session.",
        response.status,
      );
    // Only the local CAP error message is used; never propagate C4C/SDK responses.
    const message =
      typeof result?.error?.message === "string"
        ? result.error.message.slice(0, 240)
        : `License operation failed (HTTP ${response.status})`;
    throw new LicenseApiError(message, response.status);
  }
  if (result === undefined)
    throw new LicenseApiError("Unexpected non-JSON license response");
  return unbox(result);
}
function odataStringLiteral(value) {
  return `'${encodeURIComponent(value.replaceAll("'", "''"))}'`;
}
export async function getMyCommercialRegistrations(fetcher = fetch) {
  const result = await request("getMyCommercialRegistrations()", { fetcher });
  if (!Array.isArray(result))
    throw new LicenseApiError("Invalid commercial registrations response");
  return result;
}
export async function getMyLicenses(fetcher = fetch) {
  const result = await request("getMyLicenses()", { fetcher });
  if (!Array.isArray(result))
    throw new LicenseApiError("Invalid licenses response");
  return result;
}
export async function getMyRequests(fetcher = fetch) {
  const result = await request("getMyRequests()", { fetcher });
  if (!Array.isArray(result))
    throw new LicenseApiError("Invalid requests response");
  return result;
}
export async function getLicenseAttachments(accountId, fetcher = fetch) {
  const result = await request(
    `getLicenseAttachments(accountId=${odataStringLiteral(String(accountId))})`,
    { fetcher },
  );
  if (!Array.isArray(result))
    throw new LicenseApiError("Invalid license attachments response");
  return result;
}
export async function getRequestAttachments(requestId, fetcher = fetch) {
  const result = await request(
    `getRequestAttachments(requestId=${odataStringLiteral(String(requestId))})`,
    { fetcher },
  );
  if (!Array.isArray(result))
    throw new LicenseApiError("Invalid license request attachments response");
  return result;
}
export const getC4cConnection = (fetcher = fetch) =>
  request("checkC4cConnection()", { fetcher });
export async function getServicePrices(fetcher = fetch) {
  const result = await request("getServicePrices()", { fetcher });
  if (!Array.isArray(result))
    throw new LicenseApiError("Invalid service prices response");
  return result;
}
export async function getServiceQuote(serviceTypes, fetcher = fetch) {
  return request(
    `quoteServices(serviceCodes=${odataStringLiteral(JSON.stringify(serviceTypes))})`,
    { fetcher },
  );
}
export async function submitLicenseRequest(payload, fetcher = fetch) {
  const result = await request("submitLicense", {
    body: { payload: JSON.stringify(payload) },
    fetcher,
  });
  if (typeof result !== "string")
    throw new LicenseApiError("Invalid license submission response");
  try {
    return JSON.parse(result);
  } catch {
    throw new LicenseApiError(
      "Invalid license submission result; check C4C before retrying",
    );
  }
}
export async function renewLicenseRequest(payload, fetcher = fetch) {
  const result = await request("renewLicense", {
    body: { payload: JSON.stringify(payload) },
    fetcher,
  });
  if (typeof result !== "string")
    throw new LicenseApiError("Invalid license renewal response");
  try {
    return JSON.parse(result);
  } catch {
    throw new LicenseApiError("Invalid renewal result; check C4C before retrying");
  }
}
export async function fileToC4cAttachment(file) {
  if (
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > 5 * 1024 * 1024 ||
    !/\.(pdf|png|jpe?g)$/i.test(file.name)
  ) {
    throw new LicenseApiError(
      "Select a PDF, PNG or JPEG attachment up to 5 MB",
    );
  }
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new LicenseApiError("Could not read selected attachment"));
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.readAsDataURL(file);
  });
  return {
    name: file.name.slice(0, 160),
    mimeType: file.type || "application/octet-stream",
    contentBase64: base64,
  };
}
