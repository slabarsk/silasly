export const sessionEventName = "sessionChanged";

function decodeTokenPayload(token) {
  if (!token) {
    return {};
  }

  try {
    const payload = token.split(".")[1];
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(normalizedPayload);
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function getRolesFromClaims(claims) {
  if (Array.isArray(claims.roles)) {
    return claims.roles;
  }

  if (typeof claims.role === "string") {
    return [claims.role];
  }

  if (claims.admin === true) {
    return ["admin"];
  }

  if (claims.company === true) {
    return ["company"];
  }

  return [];
}

export function getSession() {
  const token = localStorage.getItem("firebaseToken");
  const claims = decodeTokenPayload(token);
  const roles = getRolesFromClaims(claims);

  return {
    token,
    userId: localStorage.getItem("userId"),
    roles,
    claims
  };
}

export function saveSession(nextSession) {
  if (nextSession.token) {
    localStorage.setItem("firebaseToken", nextSession.token);
  } else {
    localStorage.removeItem("firebaseToken");
  }

  if (nextSession.userId) {
    localStorage.setItem("userId", nextSession.userId);
  } else {
    localStorage.removeItem("userId");
  }

  window.dispatchEvent(new CustomEvent(sessionEventName, { detail: getSession() }));
}

export function clearSession() {
  saveSession({ token: "", userId: "" });
}
