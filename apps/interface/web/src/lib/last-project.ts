const LAST_PROJECT_KEY = 'quantyx:last-project';

export function setLastVisitedProject(orgId: string, projectId: string) {
  try {
    localStorage.setItem(LAST_PROJECT_KEY, JSON.stringify({ orgId, projectId }));
  } catch {
    // localStorage not available
  }
}

export function getLastVisitedProject(): { orgId: string; projectId: string } | null {
  try {
    const raw = localStorage.getItem(LAST_PROJECT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
