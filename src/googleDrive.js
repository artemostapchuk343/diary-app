const FOLDER_NAME = 'My Diary'
const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET
const REDIRECT_URI = window.location.origin
const CONNECTED_KEY = 'gdrive_was_connected'
const REFRESH_TOKEN_KEY = 'gdrive_refresh_token'
const VERIFIER_KEY = 'gdrive_pkce_verifier'

let accessToken = null
let refreshTimer = null
let tokenExchangePromise = null

function randomBase64url(len) {
  const arr = crypto.getRandomValues(new Uint8Array(len))
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function sha256Base64url(str) {
  const bytes = new TextEncoder().encode(str)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return btoa(String.fromCharCode(...new Uint8Array(hash))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function scheduleRefresh(expiresIn) {
  clearTimeout(refreshTimer)
  const delay = Math.max((expiresIn - 120) * 1000, 10_000)
  refreshTimer = setTimeout(() => silentSignIn(), delay)
}

async function exchangeCode(code) {
  const verifier = sessionStorage.getItem(VERIFIER_KEY)
  sessionStorage.removeItem(VERIFIER_KEY)
  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
      code_verifier: verifier || '',
    }),
  })
  const data = await resp.json()
  if (data.error) throw new Error(data.error_description || data.error)
  accessToken = data.access_token
  if (data.refresh_token) {
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token)
  }
  localStorage.setItem(CONNECTED_KEY, '1')
  sessionStorage.removeItem('gdrive_auth_attempted')
  scheduleRefresh(data.expires_in)
  window.history.replaceState(null, '', window.location.pathname)
  window.dispatchEvent(new Event('gdrive-connected'))
}

;(function parseRedirectCode() {
  const params = new URLSearchParams(window.location.search)
  if (params.get('error')) {
    window.history.replaceState(null, '', window.location.pathname)
    return
  }
  const code = params.get('code')
  if (!code) return
  tokenExchangePromise = exchangeCode(code).catch(err => {
    console.error('Drive token exchange failed:', err)
    window.history.replaceState(null, '', window.location.pathname)
  }).finally(() => { tokenExchangePromise = null })
})()

export function isConfigured() {
  return !!CLIENT_ID && !!CLIENT_SECRET
}

export function isSignedIn() {
  return !!accessToken
}

export async function signIn() {
  const verifier = randomBase64url(64)
  const challenge = await sha256Base64url(verifier)
  sessionStorage.setItem(VERIFIER_KEY, verifier)
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
  })
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export async function silentSignIn() {
  if (tokenExchangePromise) await tokenExchangePromise
  if (accessToken) return true
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
  if (!refreshToken) return false
  try {
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'refresh_token',
      }),
    })
    const data = await resp.json()
    if (data.error) {
      localStorage.removeItem(REFRESH_TOKEN_KEY)
      localStorage.removeItem(CONNECTED_KEY)
      return false
    }
    accessToken = data.access_token
    scheduleRefresh(data.expires_in)
    return true
  } catch {
    return false
  }
}

export function signOut() {
  clearTimeout(refreshTimer)
  accessToken = null
  localStorage.removeItem(CONNECTED_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

async function api(path, options = {}) {
  const resp = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${accessToken}`, ...options.headers },
  })
  if (resp.status === 401) {
    accessToken = null
    throw new Error('TOKEN_EXPIRED')
  }
  return resp
}

async function uploadApi(path, options = {}) {
  const resp = await fetch(`https://www.googleapis.com/upload/drive/v3${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${accessToken}`, ...options.headers },
  })
  if (resp.status === 401) {
    accessToken = null
    throw new Error('TOKEN_EXPIRED')
  }
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Upload failed: ${resp.status}`)
  }
  return resp
}

async function getOrCreateFolder() {
  const resp = await api(
    `/files?q=name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)`
  )
  const { files } = await resp.json()
  if (files?.length) return files[0].id

  const create = await api('/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  })
  return (await create.json()).id
}

// Returns the stable cross-device id for an entry
function canonicalId(entry) {
  return String(entry.sourceId || entry.id)
}

export function entryToMarkdown(entry) {
  const title = (entry.title || '').replace(/"/g, '\\"')
  return [
    '---',
    `id: "${canonicalId(entry)}"`,
    `title: "${title}"`,
    `mood: "${entry.mood || ''}"`,
    `createdAt: "${entry.createdAt}"`,
    `updatedAt: "${entry.updatedAt}"`,
    '---',
    '',
    entry.body || '',
  ].join('\n')
}

export function markdownToEntry(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return null
  const entry = { body: match[2].trim() }
  match[1].split('\n').forEach(line => {
    const colon = line.indexOf(': ')
    if (colon === -1) return
    const key = line.slice(0, colon).trim()
    const val = line.slice(colon + 2).trim().replace(/^"(.*)"$/, '$1')
    entry[key] = val
  })
  return entry
}

async function listDriveEntries(folderId) {
  const resp = await api(
    `/files?q='${folderId}' in parents and trashed=false and mimeType='text/plain'` +
    `&fields=files(id,name,modifiedTime,appProperties)&pageSize=1000`
  )
  const { files } = await resp.json()
  return files || []
}

async function uploadFile(folderId, content, entry, existingDriveFileId = null) {
  const cid = canonicalId(entry)
  const filename = `${(entry.createdAt || '').slice(0, 10)}_${(entry.title || 'untitled')
    .replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 40)}.md`

  const metadata = {
    name: filename,
    mimeType: 'text/plain',
    appProperties: { entryId: cid },
    ...(!existingDriveFileId && { parents: [folderId] }),
  }

  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', new Blob([content], { type: 'text/plain' }))

  const url = existingDriveFileId
    ? `/files/${existingDriveFileId}?uploadType=multipart`
    : '/files?uploadType=multipart'

  await uploadApi(url, { method: existingDriveFileId ? 'PATCH' : 'POST', body: form })
}

async function downloadFile(fileId) {
  const resp = await api(`/files/${fileId}?alt=media`)
  return resp.text()
}

const PASSWORD_FILE_NAME = '.diary-password'
const DELETED_FILE_NAME = '.diary-deleted'

async function getDeletedIds(folderId) {
  try {
    const resp = await api(
      `/files?q=name='${DELETED_FILE_NAME}' and '${folderId}' in parents and trashed=false&fields=files(id)`
    )
    const { files } = await resp.json()
    if (!files?.length) return { ids: [], fileId: null }
    const content = await downloadFile(files[0].id)
    return { ids: JSON.parse(content), fileId: files[0].id }
  } catch {
    return { ids: [], fileId: null }
  }
}

async function saveDeletedIds(folderId, ids, existingFileId = null) {
  const metadata = {
    name: DELETED_FILE_NAME,
    mimeType: 'application/json',
    ...(!existingFileId && { parents: [folderId] }),
  }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', new Blob([JSON.stringify(ids)], { type: 'application/json' }))
  const url = existingFileId
    ? `/files/${existingFileId}?uploadType=multipart`
    : '/files?uploadType=multipart'
  await uploadApi(url, { method: existingFileId ? 'PATCH' : 'POST', body: form })
}

// entry: full entry object (needs .id and optionally .sourceId)
export async function markEntryDeleted(entry) {
  if (!accessToken) return
  const cid = canonicalId(entry)
  try {
    const folderId = await getOrCreateFolder()
    const resp = await api(
      `/files?q=appProperties has { key='entryId' and value='${cid}' } and '${folderId}' in parents and trashed=false&fields=files(id)`
    )
    const { files } = await resp.json()
    if (files?.length) {
      await api(`/files/${files[0].id}`, { method: 'DELETE' })
    }
    const { ids, fileId } = await getDeletedIds(folderId)
    if (!ids.includes(cid)) {
      await saveDeletedIds(folderId, [...ids, cid], fileId)
    }
  } catch (e) {
    console.error('Failed to mark entry deleted in Drive:', e)
  }
}

export async function uploadSingleEntry(entry) {
  if (!accessToken) return { status: 'not_connected' }
  try {
    const folderId = await getOrCreateFolder()
    const cid = canonicalId(entry)

    // Check tombstone first
    const { ids: deletedIds } = await getDeletedIds(folderId)
    if (deletedIds.includes(cid)) return { status: 'previously_deleted' }

    const driveFiles = await listDriveEntries(folderId)
    const existing = driveFiles.find(f => f.appProperties?.entryId === cid)
    const content = entryToMarkdown(entry)
    await uploadFile(folderId, content, entry, existing?.id || null)
    return { status: 'ok' }
  } catch (e) {
    console.error('uploadSingleEntry failed:', e)
    return { status: 'error', message: e.message }
  }
}

export async function restoreAndUpload(entry) {
  if (!accessToken) return
  const folderId = await getOrCreateFolder()
  const cid = canonicalId(entry)

  // Remove from tombstone so other devices don't delete it
  const { ids, fileId } = await getDeletedIds(folderId)
  if (ids.includes(cid)) {
    await saveDeletedIds(folderId, ids.filter(id => id !== cid), fileId)
  }

  const driveFiles = await listDriveEntries(folderId)
  const existing = driveFiles.find(f => f.appProperties?.entryId === cid)
  const content = entryToMarkdown(entry)
  await uploadFile(folderId, content, entry, existing?.id || null)
}

export async function downloadPasswordConfig() {
  try {
    const folderId = await getOrCreateFolder()
    const resp = await api(
      `/files?q=name='${PASSWORD_FILE_NAME}' and '${folderId}' in parents and trashed=false&fields=files(id)`
    )
    const { files } = await resp.json()
    if (!files?.length) return null
    const content = await downloadFile(files[0].id)
    return JSON.parse(content)
  } catch {
    return null
  }
}

export async function uploadPasswordConfig(config) {
  try {
    const folderId = await getOrCreateFolder()
    const resp = await api(
      `/files?q=name='${PASSWORD_FILE_NAME}' and '${folderId}' in parents and trashed=false&fields=files(id)`
    )
    const { files } = await resp.json()
    const existingId = files?.[0]?.id || null
    const metadata = {
      name: PASSWORD_FILE_NAME,
      mimeType: 'application/json',
      ...(!existingId && { parents: [folderId] }),
    }
    const form = new FormData()
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
    form.append('file', new Blob([JSON.stringify(config)], { type: 'application/json' }))
    const url = existingId
      ? `/files/${existingId}?uploadType=multipart`
      : '/files?uploadType=multipart'
    await uploadApi(url, { method: existingId ? 'PATCH' : 'POST', body: form })
  } catch (e) {
    console.error('Failed to upload password config:', e)
  }
}

export async function sync(localEntries, { onProgress, onNewEntry, onDeleteEntry }) {
  const folderId = await getOrCreateFolder()
  const driveFiles = await listDriveEntries(folderId)
  const { ids: deletedIds, fileId: deletedFileId } = await getDeletedIds(folderId)
  const deletedSet = new Set(deletedIds)

  const driveByEntryId = {}
  driveFiles.forEach(f => {
    if (f.appProperties?.entryId) driveByEntryId[f.appProperties.entryId] = f
  })

  // Build local lookups by both DB id and canonical (source) id
  const localByCanonicalId = {}
  localEntries.forEach(e => {
    localByCanonicalId[canonicalId(e)] = e
  })

  // Apply remote deletions to local DB (match by canonical id)
  for (const id of deletedSet) {
    const localEntry = localByCanonicalId[id]
    if (localEntry) {
      await onDeleteEntry?.(String(localEntry.id))
      delete localByCanonicalId[id]
    }
  }

  // Upload local → Drive, skip entries marked deleted on another device
  const entriesToUpload = localEntries.filter(e => !deletedSet.has(canonicalId(e)))
  let uploaded = 0, downloaded = 0

  for (const entry of entriesToUpload) {
    const cid = canonicalId(entry)
    const driveFile = driveByEntryId[cid]
    const content = entryToMarkdown(entry)
    if (driveFile) {
      const driveTime = new Date(driveFile.modifiedTime).getTime()
      const localTime = new Date(entry.updatedAt).getTime()
      if (localTime > driveTime) {
        await uploadFile(folderId, content, entry, driveFile.id)
        uploaded++
      }
    } else {
      await uploadFile(folderId, content, entry)
      uploaded++
    }
    onProgress?.(`Uploading… ${uploaded}/${entriesToUpload.length}`)
  }

  // Download Drive → local: only entries not already present and not deleted
  const driveOnlyFiles = driveFiles.filter(f => {
    const eid = f.appProperties?.entryId
    return eid && !localByCanonicalId[eid] && !deletedSet.has(eid)
  })

  for (const f of driveOnlyFiles) {
    const content = await downloadFile(f.id)
    const parsed = markdownToEntry(content)
    if (parsed) {
      await onNewEntry(parsed)
      downloaded++
    }
    onProgress?.(`Downloading… ${downloaded}/${driveOnlyFiles.length}`)
  }

  return { uploaded, downloaded }
}
