
import { Match } from "../types";

// The API is proxied in dev and hosted on the same domain in production
const API_BASE = "/api";

export async function fetchFromGoogleSheets(): Promise<any[]> {
  try {
    const response = await fetch(`${API_BASE}/matches`);
    if (!response.ok) {
      // If the server is not ready or returns 404/500, we treat it as an empty result
      // This avoids the "Network response was not ok" error popping up for users.
      console.warn(`Sync server returned ${response.status}. Operating in local-only mode.`);
      return [];
    }
    return await response.json();
  } catch (e) {
    // Suppress console error for connection failures (common if server.ts isn't running)
    return [];
  }
}

export async function syncToGoogleSheets(match: Match): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(match)
    });
    return response.ok;
  } catch (e) {
    return false;
  }
}

export function exportMatchData(match: Match) {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(match));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", `match_${match.id}.json`);
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}
