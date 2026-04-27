const FOLDER_NAME = 'My Diary'
const CONFIG_FOLDER_NAME = '_config'
const PASSWORD_FILE_NAME = '.diary-password'
const DELETED_FILE_NAME = '.diary-deleted'
const PROFILE_PIC_FILE_NAME = 'profile_pic.jpg'
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

// In-session folder ID cache — avoids redundant Drive API calls
let rootFolderId = null
let configFolderId = null
const monthFolderCache = {}  // 'MM.YYYY' → id
const dayFolderCache = {}    // 'MM.YYYY/DD' → id

function clearFolderCache() {
  rootFolderId = null
  configFolderId = null
  Object.keys(monthFolderCache).forEach(k => delete monthFolderCache[k])
  Object.keys(dayFolderCache).forEach(k => delete dayFolderCache[k])
}

// ─── Auth ────────────────────────────────────────────────────────────────────

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
  if (data.refresh_token) localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token)
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

export function isConfigured() { return !!CLIENT_ID && !!CLIENT_SECRET }
export function isSignedIn() { return !!accessToken }

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
  clearFolderCache()
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function api(path, options = {}) {
  const resp = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${accessToken}`, ...options.headers },
  })
  if (resp.status === 401) { accessToken = null; throw new Error('TOKEN_EXPIRED') }
  return resp
}

async function uploadApi(path, options = {}) {
  const resp = await fetch(`https://www.googleapis.com/upload/drive/v3${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${accessToken}`, ...options.headers },
  })
  if (resp.status === 401) { accessToken = null; throw new Error('TOKEN_EXPIRED') }
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Upload failed: ${resp.status}`)
  }
  return resp
}

// ─── Folder management ────────────────────────────────────────────────────────
//
// Drive structure:
//   My Diary/
//     _config/          ← .diary-password, .diary-deleted
//     04.2026/
//       27/             ← entry .md files + attachment files

async function getOrCreateSubfolder(name, parentId) {
  const resp = await api(
    `/files?q=name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)&pageSize=1`
  )
  const { files } = await resp.json()
  if (files?.length) return files[0].id
  const create = await api('/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  })
  return (await create.json()).id
}

async function getRootFolder() {
  if (rootFolderId) return rootFolderId
  const resp = await api(
    `/files?q=name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id)&pageSize=1`
  )
  const { files } = await resp.json()
  if (files?.length) { rootFolderId = files[0].id; return rootFolderId }
  const create = await api('/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  })
  rootFolderId = (await create.json()).id
  return rootFolderId
}

async function getConfigFolder() {
  if (configFolderId) return configFolderId
  configFolderId = await getOrCreateSubfolder(CONFIG_FOLDER_NAME, await getRootFolder())
  return configFolderId
}

// isoDate: '2026-04-27' → creates My Diary/04.2026/27/
async function getDayFolder(isoDate) {
  const [year, month, day] = isoDate.split('-')
  const monthKey = `${month}.${year}`
  const dayKey = `${monthKey}/${day}`
  if (dayFolderCache[dayKey]) return dayFolderCache[dayKey]
  if (!monthFolderCache[monthKey]) {
    monthFolderCache[monthKey] = await getOrCreateSubfolder(monthKey, await getRootFolder())
  }
  dayFolderCache[dayKey] = await getOrCreateSubfolder(day, monthFolderCache[monthKey])
  return dayFolderCache[dayKey]
}

// ─── Entry serialisation ──────────────────────────────────────────────────────

function canonicalId(entry) {
  return String(entry.sourceId || entry.id)
}

export function entryToMarkdown(entry) {
  const title = (entry.title || '').replace(/"/g, '\\"')
  const lines = [
    '---',
    `id: "${canonicalId(entry)}"`,
    `title: "${title}"`,
    `mood: "${entry.mood || ''}"`,
    `createdAt: "${entry.createdAt}"`,
    `updatedAt: "${entry.updatedAt}"`,
  ]
  if (entry.translations && Object.keys(entry.translations).length > 0) {
    lines.push(`translations: ${JSON.stringify(entry.translations)}`)
  }
  lines.push('---', '', entry.body || '')
  return lines.join('\n')
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
  if (entry.translations) {
    try { entry.translations = JSON.parse(entry.translations) }
    catch { entry.translations = {} }
  }
  return entry
}

// ─── File listing ─────────────────────────────────────────────────────────────
//
// Using broad queries without parent filter. With drive.file scope the API only
// returns files created by this app, so broad queries are safe.
// Including `parents` in fields so sync can detect and migrate old flat files.

async function listDriveEntries() {
  const resp = await api(
    `/files?q=mimeType='text/plain' and trashed=false` +
    `&fields=files(id,name,modifiedTime,appProperties,parents)&pageSize=1000`
  )
  const { files } = await resp.json()
  // Filter to files that carry entryId (excludes any stray text files)
  return (files || []).filter(f => f.appProperties?.entryId)
}

async function listDriveAttachments() {
  const resp = await api(
    `/files?q=appProperties has { key='isAttachment' and value='true' } and trashed=false` +
    `&fields=files(id,name,mimeType,appProperties,parents)&pageSize=1000`
  )
  const { files } = await resp.json()
  return files || []
}

// ─── File upload / download ───────────────────────────────────────────────────

async function downloadFile(fileId) {
  const resp = await api(`/files/${fileId}?alt=media`)
  return resp.text()
}

function base64ToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(',')
  const mimeType = header.match(/:(.*?);/)[1]
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
  return new Blob([bytes], { type: mimeType })
}

async function downloadAttachmentAsDataUrl(fileId) {
  const resp = await api(`/files/${fileId}?alt=media`)
  const blob = await resp.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// Uploads or updates an entry .md file.
// oldParentId: when provided and differs from the target day folder, the file
// is moved to the correct location in the same request.
async function uploadFile(content, entry, existingDriveFileId = null, oldParentId = null) {
  const date = (entry.createdAt || new Date().toISOString()).slice(0, 10)
  const dayFolderId = await getDayFolder(date)
  const filename = `${date}_${(entry.title || 'untitled')
    .replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 40)}.md`

  const metadata = {
    name: filename,
    mimeType: 'text/plain',
    appProperties: { entryId: canonicalId(entry) },
  }

  let urlPath
  if (existingDriveFileId) {
    let qs = '?uploadType=multipart'
    if (oldParentId && oldParentId !== dayFolderId) {
      qs += `&addParents=${dayFolderId}&removeParents=${oldParentId}`
    }
    urlPath = `/files/${existingDriveFileId}${qs}`
  } else {
    metadata.parents = [dayFolderId]
    urlPath = '/files?uploadType=multipart'
  }

  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', new Blob([content], { type: 'text/plain' }))
  await uploadApi(urlPath, { method: existingDriveFileId ? 'PATCH' : 'POST', body: form })
}

// Uploads or updates an attachment file.
async function uploadAttachment(attachment, entryCanonicalId, entryCreatedAt, existingFileId = null, oldParentId = null) {
  const date = (entryCreatedAt || new Date().toISOString()).slice(0, 10)
  const dayFolderId = await getDayFolder(date)
  const blob = base64ToBlob(attachment.data)

  const metadata = {
    name: attachment.name,
    mimeType: attachment.type || 'application/octet-stream',
    appProperties: { entryId: entryCanonicalId, isAttachment: 'true', attachmentName: attachment.name },
  }

  let urlPath
  if (existingFileId) {
    let qs = '?uploadType=multipart'
    if (oldParentId && oldParentId !== dayFolderId) {
      qs += `&addParents=${dayFolderId}&removeParents=${oldParentId}`
    }
    urlPath = `/files/${existingFileId}${qs}`
  } else {
    metadata.parents = [dayFolderId]
    urlPath = '/files?uploadType=multipart'
  }

  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', blob)
  await uploadApi(urlPath, { method: existingFileId ? 'PATCH' : 'POST', body: form })
}

// ─── Config files (tombstone + password) ─────────────────────────────────────
//
// Stored in _config/. Migrates automatically from old flat location on first use.

async function findOrMigrateConfigFile(name) {
  const configId = await getConfigFolder()

  // Check new location first
  let resp = await api(
    `/files?q=name='${name}' and '${configId}' in parents and trashed=false&fields=files(id)&pageSize=1`
  )
  let { files } = await resp.json()
  if (files?.length) return files[0].id

  // Check old flat location and migrate if found
  const rootId = await getRootFolder()
  resp = await api(
    `/files?q=name='${name}' and '${rootId}' in parents and trashed=false&fields=files(id)&pageSize=1`
  )
  ;({ files } = await resp.json())
  if (files?.length) {
    try {
      await api(`/files/${files[0].id}?addParents=${configId}&removeParents=${rootId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    } catch {}
    return files[0].id
  }

  return null
}

async function getDeletedIds() {
  try {
    const fileId = await findOrMigrateConfigFile(DELETED_FILE_NAME)
    if (!fileId) return { ids: [], fileId: null }
    const content = await downloadFile(fileId)
    return { ids: JSON.parse(content), fileId }
  } catch {
    return { ids: [], fileId: null }
  }
}

async function saveDeletedIds(ids, existingFileId = null) {
  const configId = await getConfigFolder()
  const metadata = {
    name: DELETED_FILE_NAME,
    mimeType: 'application/json',
    ...(!existingFileId && { parents: [configId] }),
  }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', new Blob([JSON.stringify(ids)], { type: 'application/json' }))
  const url = existingFileId
    ? `/files/${existingFileId}?uploadType=multipart`
    : '/files?uploadType=multipart'
  await uploadApi(url, { method: existingFileId ? 'PATCH' : 'POST', body: form })
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function markEntryDeleted(entry) {
  if (!accessToken) return
  const cid = canonicalId(entry)
  try {
    const [driveFiles, driveAtts] = await Promise.all([
      listDriveEntries(),
      listDriveAttachments(),
    ])
    const entryFile = driveFiles.find(f => f.appProperties?.entryId === cid)
    if (entryFile) await api(`/files/${entryFile.id}`, { method: 'DELETE' })

    // Delete all attachments for this entry
    for (const att of driveAtts.filter(f => f.appProperties?.entryId === cid)) {
      await api(`/files/${att.id}`, { method: 'DELETE' })
    }

    const { ids, fileId } = await getDeletedIds()
    if (!ids.includes(cid)) await saveDeletedIds([...ids, cid], fileId)
  } catch (e) {
    console.error('Failed to mark entry deleted in Drive:', e)
  }
}

export async function uploadSingleEntry(entry) {
  if (!accessToken) return { status: 'not_connected' }
  try {
    const cid = canonicalId(entry)
    const { ids: deletedIds } = await getDeletedIds()
    if (deletedIds.includes(cid)) return { status: 'previously_deleted' }

    const [driveFiles, driveAtts] = await Promise.all([
      listDriveEntries(),
      listDriveAttachments(),
    ])
    const existing = driveFiles.find(f => f.appProperties?.entryId === cid)
    await uploadFile(entryToMarkdown(entry), entry, existing?.id || null, existing?.parents?.[0] || null)

    const driveAttsForEntry = driveAtts.filter(f => f.appProperties?.entryId === cid)
    const localAttNames = new Set((entry.attachments || []).map(a => a.name))

    for (const att of (entry.attachments || [])) {
      const onDrive = driveAttsForEntry.find(f => f.appProperties?.attachmentName === att.name)
      if (!onDrive) await uploadAttachment(att, cid, entry.createdAt)
    }

    for (const driveAtt of driveAttsForEntry) {
      const name = driveAtt.appProperties?.attachmentName
      if (name && !localAttNames.has(name)) {
        await api(`/files/${driveAtt.id}`, { method: 'DELETE' })
      }
    }

    return { status: 'ok' }
  } catch (e) {
    console.error('uploadSingleEntry failed:', e)
    return { status: 'error', message: e.message }
  }
}

export async function restoreAndUpload(entry) {
  if (!accessToken) return
  const cid = canonicalId(entry)
  const { ids, fileId } = await getDeletedIds()
  if (ids.includes(cid)) await saveDeletedIds(ids.filter(id => id !== cid), fileId)
  const driveFiles = await listDriveEntries()
  const existing = driveFiles.find(f => f.appProperties?.entryId === cid)
  await uploadFile(entryToMarkdown(entry), entry, existing?.id || null, existing?.parents?.[0] || null)
}

export async function downloadPasswordConfig() {
  try {
    const fileId = await findOrMigrateConfigFile(PASSWORD_FILE_NAME)
    if (!fileId) return null
    const content = await downloadFile(fileId)
    return JSON.parse(content)
  } catch {
    return null
  }
}

export async function uploadPasswordConfig(config) {
  try {
    const configId = await getConfigFolder()
    const existingId = await findOrMigrateConfigFile(PASSWORD_FILE_NAME)
    const metadata = {
      name: PASSWORD_FILE_NAME,
      mimeType: 'application/json',
      ...(!existingId && { parents: [configId] }),
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

export async function uploadProfilePic(dataUrl) {
  if (!accessToken) return
  try {
    const configId = await getConfigFolder()
    const existingId = await findOrMigrateConfigFile(PROFILE_PIC_FILE_NAME)
    const blob = base64ToBlob(dataUrl)
    const metadata = {
      name: PROFILE_PIC_FILE_NAME,
      mimeType: 'image/jpeg',
      ...(!existingId && { parents: [configId] }),
    }
    const form = new FormData()
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
    form.append('file', blob)
    const url = existingId
      ? `/files/${existingId}?uploadType=multipart`
      : '/files?uploadType=multipart'
    await uploadApi(url, { method: existingId ? 'PATCH' : 'POST', body: form })
  } catch (e) {
    console.error('Failed to upload profile pic:', e)
  }
}

export async function downloadProfilePic() {
  if (!accessToken) return null
  try {
    const fileId = await findOrMigrateConfigFile(PROFILE_PIC_FILE_NAME)
    if (!fileId) return null
    return await downloadAttachmentAsDataUrl(fileId)
  } catch {
    return null
  }
}

export async function sync(localEntries, { onProgress, onNewEntry, onDeleteEntry, onSaveAttachment }) {
  const [driveFiles, driveAttachFiles, { ids: deletedIds }] = await Promise.all([
    listDriveEntries(),
    listDriveAttachments(),
    getDeletedIds(),
  ])
  const deletedSet = new Set(deletedIds)
  const rootId = await getRootFolder()

  const driveByEntryId = {}
  driveFiles.forEach(f => {
    if (f.appProperties?.entryId) driveByEntryId[f.appProperties.entryId] = f
  })

  const driveAttsByEntryId = {}
  driveAttachFiles.forEach(f => {
    const eid = f.appProperties?.entryId
    const name = f.appProperties?.attachmentName
    if (eid && name) {
      if (!driveAttsByEntryId[eid]) driveAttsByEntryId[eid] = {}
      driveAttsByEntryId[eid][name] = f
    }
  })

  const localByCanonicalId = {}
  localEntries.forEach(e => { localByCanonicalId[canonicalId(e)] = e })

  // Apply remote deletions
  for (const id of deletedSet) {
    const localEntry = localByCanonicalId[id]
    if (localEntry) {
      await onDeleteEntry?.(String(localEntry.id))
      delete localByCanonicalId[id]
    }
  }

  const entriesToUpload = localEntries.filter(e => !deletedSet.has(canonicalId(e)))
  let uploaded = 0, downloaded = 0

  for (const entry of entriesToUpload) {
    const cid = canonicalId(entry)
    const driveFile = driveByEntryId[cid]
    const content = entryToMarkdown(entry)
    const date = (entry.createdAt || '').slice(0, 10)

    if (driveFile) {
      const driveTime = new Date(driveFile.modifiedTime).getTime()
      const localTime = new Date(entry.updatedAt).getTime()
      const oldParentId = driveFile.parents?.[0] || null
      const isFlat = oldParentId === rootId

      if (localTime > driveTime) {
        // Update content; also migrates to day folder if currently in old flat location
        await uploadFile(content, entry, driveFile.id, oldParentId)
        uploaded++
      } else if (isFlat) {
        // Content is up-to-date but file is in old flat location — move it
        const dayFolderId = await getDayFolder(date)
        await api(`/files/${driveFile.id}?addParents=${dayFolderId}&removeParents=${rootId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
      }
    } else {
      await uploadFile(content, entry)
      uploaded++
    }

    const driveAttsForEntry = driveAttsByEntryId[cid] || {}
    const driveAttNames = new Set(Object.keys(driveAttsForEntry))
    const localAttNames = new Set((entry.attachments || []).map(a => a.name))

    // Upload local attachments not yet on Drive
    for (const att of (entry.attachments || [])) {
      if (!driveAttNames.has(att.name)) {
        await uploadAttachment(att, cid, entry.createdAt)
      }
    }

    // Download Drive attachments not yet local; migrate flat ones
    for (const [attName, driveAtt] of Object.entries(driveAttsForEntry)) {
      if (!localAttNames.has(attName)) {
        try {
          const dataUrl = await downloadAttachmentAsDataUrl(driveAtt.id)
          await onSaveAttachment?.(entry.id, {
            name: driveAtt.appProperties.attachmentName,
            type: driveAtt.mimeType,
            data: dataUrl,
            size: 0,
          })
        } catch (e) {
          console.error('Failed to download attachment:', attName, e)
        }
      }

      // Migrate attachment from old flat location
      if (driveAtt.parents?.[0] === rootId) {
        try {
          const dayFolderId = await getDayFolder(date)
          await api(`/files/${driveAtt.id}?addParents=${dayFolderId}&removeParents=${rootId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          })
        } catch {}
      }
    }

    onProgress?.(`Syncing… ${uploaded}/${entriesToUpload.length}`)
  }

  // Download Drive-only entries + their attachments
  const driveOnlyFiles = driveFiles.filter(f => {
    const eid = f.appProperties?.entryId
    return eid && !localByCanonicalId[eid] && !deletedSet.has(eid)
  })

  for (const f of driveOnlyFiles) {
    const content = await downloadFile(f.id)
    const parsed = markdownToEntry(content)
    if (parsed) {
      const newLocalId = await onNewEntry(parsed)
      downloaded++
      for (const driveAtt of Object.values(driveAttsByEntryId[parsed.id] || {})) {
        try {
          const dataUrl = await downloadAttachmentAsDataUrl(driveAtt.id)
          await onSaveAttachment?.(newLocalId, {
            name: driveAtt.appProperties.attachmentName,
            type: driveAtt.mimeType,
            data: dataUrl,
            size: 0,
          })
        } catch (e) {
          console.error('Failed to download attachment:', driveAtt.name, e)
        }
      }
    }
    onProgress?.(`Downloading… ${downloaded}/${driveOnlyFiles.length}`)
  }

  return { uploaded, downloaded }
}
