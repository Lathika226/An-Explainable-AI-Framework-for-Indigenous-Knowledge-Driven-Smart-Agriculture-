export const API_BASE_URL = "/api";

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem("agri_auth_token", token);
  } else {
    localStorage.removeItem("agri_auth_token");
  }
}

export function getAuthToken(): string | null {
  return localStorage.getItem("agri_auth_token");
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken() || "";

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch (err: any) {
    throw new Error("Unable to connect to backend. Please ensure the backend server is running on port 8000.");
  }

  if (!response.ok) {
    let errorDetail = `Server error (${response.status})`;
    try {
      const text = await response.text();
      if (text) {
        try {
          const data = JSON.parse(text);
          if (data && data.detail) {
            errorDetail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
          } else {
            errorDetail = text;
          }
        } catch {
          if (!text.includes("<!DOCTYPE html>")) {
            errorDetail = text;
          } else if (response.status === 404) {
            errorDetail = "Backend route not found. Ensure backend server is running on port 8000.";
          }
        }
      } else if (response.status === 404) {
        errorDetail = "Backend route not found. Ensure backend server is running on port 8000.";
      }
    } catch {
      // Ignore text read error if stream was interrupted
    }
    throw new Error(errorDetail);
  }

  return response.json() as Promise<T>;
}
