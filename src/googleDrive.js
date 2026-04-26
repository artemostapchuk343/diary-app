const FOLDER_NAME = 'My Diary'
const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

let accessToken = null
let tokenClient = null
let refreshTimer = null

const CONNECTED_KEY = 'gdrive_was_connected'

function scheduleRefresh(expiresIn) {
  clearTimeout(refreshTimer)
  // Refresh 2 minutes before expiry
  const delay = Math.max((expiresIn - 120) * 1000, 10000)
  refreshTimer = setTimeout(() => silentSignIn(), delay)
}

export function isConfigured() {
  return !!CLIENT_ID
}

export function isSignedIn() {
  return !!accessToken
}

function waitForGSI() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve()
    let elapsed = 0
    const interval = setInterval(() => {
      if (window.google?.accounts?.oauth2) { clearInterval(interval); resolve() }
      elapsed += 100
      if (elapsed > 10000) { clearInterval(interval); reject(new Error('Google sign-in script failed to load')) }
    }, 100)
  })
}

export async function signIn() {
  await waitForGSI()
  return new Promise((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: response => {
        if (response.error) return reject(new Error(response.error))
        accessToken = response.access_token
        localStorage.setItem(CONNECTED_KEY, '1')
        scheduleRefresh(response.expires_in)
        resolve()
      },
    })
    tokenClient.requestAccessToken({ prompt: 'consent' })
  })
}

export async function silentSignIn() {
  if (!localStorage.getItem(CONNECTED_KEY)) return false
  await waitForGSI()
  return new Promise(resolve => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: response => {
        if (response.error) return resolve(false)
        accessToken = response.access_token
        scheduleRefresh(response.expires_in)
        resolve(true)
      },
    })
    tokenClient.requestAccessToken({ prompt: '' })
  })
}

export function signOut() {
  clearTimeout(refreshTimer)
  if (accessToken) window.google?.accounts?.oauth2?.revoke(accessToken)
  accessToken = null
  localStorage.removeItem(CONNECTED_KEY)
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

export function entryToMarkdown(entry) {
  const title = (entry.title || '').replace(/"/g, '\\"')
  return [
    '---',
    `id: "${entry.id}"`,
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

async function uploadFile(folderId, content, entry, existingId = null) {
  const filename = `${(entry.createdAt || '').slice(0, 10)}_${(entry.title || 'untitled')
    .replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 40)}.md`

  const metadata = {
    name: filename,
    mimeType: 'text/plain',
    appProperties: { entryId: String(entry.id) },
    ...(!existingId && { parents: [folderId] }),
  }

  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', new Blob([content], { type: 'text/plain' }))

  const url = existingId
    ? `/files/${existingId}?uploadType=multipart`
    : '/files?uploadType=multipart'

  await uploadApi(url, { method: existingId ? 'PATCH' : 'POST', body: form })
}

async function downloadFile(fileId) {
  const resp = await api(`/files/${fileId}?alt=media`)
  return resp.text()
}

export async function sync(localEntries, { onProgress, onNewEntry, onUpdateEntry }) {
  const folderId = await getOrCreateFolder()
  const driveFiles = await listDriveEntries(folderId)

  const driveByEntryId = {}
  const driveByDriveId = {}
  driveFiles.forEach(f => {
    if (f.appProperties?.entryId) driveByEntryId[f.appProperties.entryId] = f
    driveByDriveId[f.id] = f
  })

  const localById = {}
  localEntries.forEach(e => { localById[String(e.id)] = e })

  let uploaded = 0, downloaded = 0

  // Upload local → Drive
  for (const entry of localEntries) {
    const driveFile = driveByEntryId[String(entry.id)]
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
    onProgress?.(`Uploading… ${uploaded}/${localEntries.length}`)
  }

  // Download Drive → local (entries not in local DB)
  const driveOnlyFiles = driveFiles.filter(f => {
    const eid = f.appProperties?.entryId
    return eid && !localById[eid]
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
