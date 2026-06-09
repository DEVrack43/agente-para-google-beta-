import { DriveFile, GmailMessage } from "../types";

// --- GOOGLE DRIVE API FUNCTIONS ---

/**
 * Lists files from Google Drive (excluding trashed files by default).
 * Fetches relevant metadata including md5Checksum, owners, parents, sizes, etc.
 */
export async function listDriveFiles(
  accessToken: string,
  queryOption: string = ""
): Promise<DriveFile[]> {
  const fields = "files(id, name, mimeType, size, createdTime, md5Checksum, thumbnailLink, iconLink, webViewLink, owners)";
  // Always filter out trashed files
  let q = "trashed = false";
  if (queryOption) {
    q += ` and (${queryOption})`;
  }

  const url = `https://www.googleapis.com/drive/v3/files?pageSize=150&fields=${encodeURIComponent(
    fields
  )}&q=${encodeURIComponent(q)}&orderBy=createdTime%20desc`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || "Failed to list Drive files");
  }

  const data = await response.json();
  return (data.files || []).map((file: any) => ({
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    size: file.size,
    createdTime: file.createdTime,
    md5Checksum: file.md5Checksum,
    thumbnailLink: file.thumbnailLink,
    iconLink: file.iconLink,
    webViewLink: file.webViewLink,
    parents: file.parents,
    ownerNames: (file.owners || []).map((o: any) => o.displayName || o.emailAddress),
  }));
}

/**
 * Moves a Google Drive file to Trash.
 */
export async function trashDriveFile(accessToken: string, fileId: string): Promise<boolean> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ trashed: true }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || "Failed to trash Drive file");
  }
  return true;
}

/**
 * Creates folders in Google Drive.
 */
export async function createDriveFolder(
  accessToken: string,
  folderName: string,
  parentId?: string
): Promise<string> {
  const url = `https://www.googleapis.com/drive/v3/files`;
  const body: any = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) {
    body.parents = [parentId];
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || "Failed to create folder");
  }

  const data = await response.json();
  return data.id;
}

/**
 * Move Drive file into a folder by adding new parent and removing current parents.
 */
export async function moveDriveFile(
  accessToken: string,
  fileId: string,
  newFolderId: string,
  currentParents?: string[]
): Promise<boolean> {
  let url = `https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${newFolderId}`;
  if (currentParents && currentParents.length > 0) {
    url += `&removeParents=${currentParents.join(",")}`;
  }

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || "Failed to move file folder");
  }
  return true;
}


// --- GMAIL API FUNCTIONS ---

/**
 * Lists recent messages in Gmail.
 */
export async function listRecentGmailMessages(
  accessToken: string,
  maxResults: number = 40,
  query: string = ""
): Promise<string[]> {
  let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`;
  if (query) {
    url += `&q=${encodeURIComponent(query)}`;
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || "Failed to list Gmail messages");
  }

  const data = await response.json();
  return (data.messages || []).map((m: any) => m.id);
}

/**
 * Fetches Gmail message details for a given ID.
 */
export async function getGmailMessageDetails(
  accessToken: string,
  messageId: string
): Promise<GmailMessage> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch message details for ${messageId}`);
  }

  const data = await response.json();
  const headers = data.payload?.headers || [];
  
  const subjectHeader = headers.find((h: any) => h.name.toLowerCase() === "subject");
  const fromHeader = headers.find((h: any) => h.name.toLowerCase() === "from");
  const dateHeader = headers.find((h: any) => h.name.toLowerCase() === "date");

  const unread = (data.labelIds || []).includes("UNREAD");

  return {
    id: data.id,
    threadId: data.threadId,
    subject: subjectHeader ? subjectHeader.value : "(Sin asunto)",
    from: fromHeader ? fromHeader.value : "Desconocido",
    date: dateHeader ? dateHeader.value : "",
    snippet: data.snippet || "",
    sizeEstimate: data.sizeEstimate || 0,
    labels: data.labelIds || [],
    isUnread: unread,
  };
}

/**
 * Sends a Gmail message to Trash.
 */
export async function trashGmailMessage(accessToken: string, messageId: string): Promise<boolean> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/trash`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || "Failed to trash email");
  }
  return true;
}
