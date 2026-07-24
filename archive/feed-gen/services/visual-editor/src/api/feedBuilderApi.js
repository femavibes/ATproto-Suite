const API_BASE = import.meta.env.VITE_FEED_API_BASE_URL || ''
const DEFAULT_PROJECT_KEY = 'feed-builder-project-id'

export function getStoredProjectId() {
  return localStorage.getItem(DEFAULT_PROJECT_KEY) || ''
}

export function setStoredProjectId(projectId) {
  if (!projectId) return
  localStorage.setItem(DEFAULT_PROJECT_KEY, String(projectId))
}

async function request(path, options = {}) {
  const resp = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`API ${resp.status}: ${text || 'request failed'}`)
  }
  return await resp.json()
}

export async function ensureDefaultProject() {
  let projectId = localStorage.getItem(DEFAULT_PROJECT_KEY)
  if (projectId) return projectId

  const listed = await request('/api/projects')
  if (Array.isArray(listed.projects) && listed.projects.length > 0) {
    projectId = String(listed.projects[0].id)
    localStorage.setItem(DEFAULT_PROJECT_KEY, projectId)
    return projectId
  }

  const created = await request('/api/projects', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Default Feed Project',
      description: 'Auto-created by visual editor',
    }),
  })
  projectId = String(created.project.id)
  localStorage.setItem(DEFAULT_PROJECT_KEY, projectId)
  return projectId
}

export async function listProjects() {
  const data = await request('/api/projects')
  return Array.isArray(data.projects) ? data.projects : []
}

export async function createProject(payload) {
  const data = await request('/api/projects', {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name,
      description: payload.description || '',
    }),
  })
  return data.project
}

export async function updateProject(projectId, patch) {
  const data = await request(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: 'PUT',
    body: JSON.stringify({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
    }),
  })
  return data.project
}

export async function deleteProject(projectId) {
  const data = await request(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
  })
  return data.deleted_project_id
}

export async function listProjectFeeds(projectId) {
  const data = await request(`/api/projects/${encodeURIComponent(projectId)}/feeds`)
  return Array.isArray(data.feeds) ? data.feeds : []
}

export async function createProjectFeed(projectId, payload) {
  const data = await request(`/api/projects/${encodeURIComponent(projectId)}/feeds`, {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name,
      slug: payload.slug,
      description: payload.description || '',
      avatar_url: payload.avatar || '',
    }),
  })
  return data.feed
}

export async function updateFeed(feedId, patch) {
  const data = await request(`/api/feeds/${encodeURIComponent(feedId)}`, {
    method: 'PUT',
    body: JSON.stringify({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.slug !== undefined ? { slug: patch.slug } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.avatar !== undefined ? { avatar_url: patch.avatar } : {}),
    }),
  })
  return data.feed
}

export async function setFeedPublished(feedId, isPublished) {
  const data = await request(`/api/feeds/${encodeURIComponent(feedId)}/publish`, {
    method: 'PUT',
    body: JSON.stringify({
      is_published: !!isPublished,
      promote_draft_to_live: false,
    }),
  })
  return data.feed
}

export async function saveFeedDraft(feedId, graph) {
  return await request(`/api/feeds/${encodeURIComponent(feedId)}/draft`, {
    method: 'PUT',
    body: JSON.stringify({ assignment_rules_draft: graph }),
  })
}

export async function promoteFeedDraftToLive(feedId) {
  return await request(`/api/feeds/${encodeURIComponent(feedId)}/publish`, {
    method: 'PUT',
    body: JSON.stringify({ promote_draft_to_live: true }),
  })
}

export async function publishFeed(feedId) {
  return await request(`/api/feeds/${encodeURIComponent(feedId)}/publish`, {
    method: 'PUT',
    body: JSON.stringify({
      is_published: true,
      promote_draft_to_live: true,
    }),
  })
}

export async function setFeedPublishedUri(feedId, blueskyFeedUri) {
  return await request(`/api/feeds/${encodeURIComponent(feedId)}/published-uri`, {
    method: 'PUT',
    body: JSON.stringify({ bluesky_feed_uri: blueskyFeedUri }),
  })
}

export async function saveProjectDraft(projectId, graph) {
  return await request(`/api/projects/${encodeURIComponent(projectId)}/draft`, {
    method: 'PUT',
    body: JSON.stringify({ assignment_rules_draft: graph }),
  })
}

export async function promoteProjectDraftToLive(projectId) {
  return await request(`/api/projects/${encodeURIComponent(projectId)}/publish`, {
    method: 'PUT',
  })
}

export async function updateProjectIngestionFilters(projectId) {
  return await request(`/api/projects/${encodeURIComponent(projectId)}/ingestion-filters`, {
    method: 'PUT',
  })
}
