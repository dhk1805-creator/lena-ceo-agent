#!/usr/bin/env node
require('./_env');
// Google Drive Manage — Le Na CEO Agent
// Multi-purpose: create-folder, move-file, ensure-path
//
// Usage:
//   node drive-manage.js create-folder <parentId> <folderName>
//   node drive-manage.js move-file <fileId> <targetFolderId>
//   node drive-manage.js ensure-path <rootFolderId> <path>
//     (e.g. ensure-path ROOT_ID "2026/W20" — creates nested folders if needed)
//
// Returns: JSON { success, folderId/fileId, url }

const action = process.argv[2];
const arg1 = process.argv[3];
const arg2 = process.argv[4];

if (!action || !arg1) {
  console.log(JSON.stringify({
    error: 'Usage: drive-manage.js <action> <arg1> <arg2>',
    actions: ['create-folder <parentId> <name>', 'move-file <fileId> <folderId>', 'ensure-path <rootId> <path>']
  }));
  process.exit(1);
}

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get access token');
  return data.access_token;
}

async function driveAPI(path, token, opts = {}) {
  const url = path.startsWith('http') ? path : `https://www.googleapis.com/drive/v3/${path}`;
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(opts.body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {})
  });
  return res.json();
}

// Find existing folder by name in parent
async function findFolder(parentId, name, token) {
  const q = `'${parentId}' in parents and name = '${name.replace(/'/g, "\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const params = new URLSearchParams({ q, fields: 'files(id,name)' });
  const data = await driveAPI(`files?${params}`, token);
  return (data.files && data.files.length > 0) ? data.files[0] : null;
}

// Create folder
async function createFolder(parentId, name, token) {
  return driveAPI('files', token, {
    method: 'POST',
    body: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    }
  });
}

// Ensure nested path exists (e.g. "2026/W20" under rootId)
async function ensurePath(rootId, pathStr, token) {
  const parts = pathStr.split('/').filter(Boolean);
  let currentParent = rootId;
  const created = [];

  for (const part of parts) {
    const existing = await findFolder(currentParent, part, token);
    if (existing) {
      currentParent = existing.id;
      created.push({ name: part, id: existing.id, existed: true });
    } else {
      const newFolder = await createFolder(currentParent, part, token);
      if (!newFolder.id) {
        return { success: false, error: `Failed to create folder "${part}"`, detail: newFolder };
      }
      currentParent = newFolder.id;
      created.push({ name: part, id: newFolder.id, existed: false });
    }
  }

  return {
    success: true,
    folderId: currentParent,
    folderUrl: `https://drive.google.com/drive/folders/${currentParent}`,
    path: pathStr,
    folders: created
  };
}

// Move file to folder
async function moveFile(fileId, targetFolderId, token) {
  // Get current parents
  const file = await driveAPI(`files/${fileId}?fields=parents,name`, token);
  if (!file.parents) {
    return { success: false, error: 'Cannot get file parents', detail: file };
  }

  const currentParents = file.parents.join(',');
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${targetFolderId}&removeParents=${currentParents}&fields=id,name,parents,webViewLink`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  const result = await res.json();

  if (result.id) {
    return {
      success: true,
      fileId: result.id,
      fileName: result.name,
      movedTo: targetFolderId,
      url: result.webViewLink
    };
  }
  return { success: false, error: result };
}

async function main() {
  const token = await getAccessToken();

  switch (action) {
    case 'create-folder': {
      if (!arg2) { console.log(JSON.stringify({ error: 'Need: create-folder <parentId> <name>' })); return; }
      // Check if folder already exists
      const existing = await findFolder(arg1, arg2, token);
      if (existing) {
        console.log(JSON.stringify({
          success: true,
          folderId: existing.id,
          folderUrl: `https://drive.google.com/drive/folders/${existing.id}`,
          name: arg2,
          existed: true,
          note: 'Folder da ton tai'
        }));
        return;
      }
      const folder = await createFolder(arg1, arg2, token);
      if (folder.id) {
        console.log(JSON.stringify({
          success: true,
          folderId: folder.id,
          folderUrl: `https://drive.google.com/drive/folders/${folder.id}`,
          name: arg2,
          existed: false
        }));
      } else {
        console.log(JSON.stringify({ success: false, error: folder }));
      }
      break;
    }

    case 'move-file': {
      if (!arg2) { console.log(JSON.stringify({ error: 'Need: move-file <fileId> <folderId>' })); return; }
      const result = await moveFile(arg1, arg2, token);
      console.log(JSON.stringify(result, null, 2));
      break;
    }

    case 'ensure-path': {
      if (!arg2) { console.log(JSON.stringify({ error: 'Need: ensure-path <rootId> <path>' })); return; }
      const result = await ensurePath(arg1, arg2, token);
      console.log(JSON.stringify(result, null, 2));
      break;
    }

    case 'copy-file': {
      if (!arg2) { console.log(JSON.stringify({ error: 'Need: copy-file <fileId> <targetFolderId>' })); return; }
      // Copy file to target folder (keeps original intact)
      const copyRes = await driveAPI('files/' + arg1 + '/copy', token, {
        method: 'POST',
        body: { parents: [arg2] }
      });
      if (copyRes.id) {
        // Get full info
        const info = await driveAPI('files/' + copyRes.id + '?fields=id,name,webViewLink,mimeType', token);
        console.log(JSON.stringify({
          success: true,
          originalId: arg1,
          copyId: info.id,
          name: info.name,
          type: info.mimeType,
          url: info.webViewLink,
          copiedTo: arg2
        }, null, 2));
      } else {
        console.log(JSON.stringify({ success: false, error: copyRes }));
      }
      break;
    }

    default:
      console.log(JSON.stringify({ error: `Unknown action: ${action}`, actions: ['create-folder', 'move-file', 'copy-file', 'ensure-path'] }));
  }
}

main().catch(e => {
  console.log(JSON.stringify({ error: e.message }));
  process.exit(1);
});
