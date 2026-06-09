export interface GoogleUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string; // in bytes as a string
  createdTime?: string;
  thumbnailLink?: string;
  iconLink?: string;
  md5Checksum?: string;
  webViewLink?: string;
  parents?: string[];
  ownerNames?: string[];
}

export interface GmailMessage {
  id: string;
  threadId: string;
  subject?: string;
  from?: string;
  date?: string;
  snippet?: string;
  sizeEstimate?: number;
  labels?: string[];
  body?: string;
  isUnread?: boolean;
}

export interface DuplicateGroup {
  hashOrKey: string;
  name: string;
  size: number;
  mimeType: string;
  files: DriveFile[];
}

export interface GeminiAnalysisResult {
  overallAssessment: string;
  duplicateCandidates: Array<{
    id?: string;
    name: string;
    reason: string;
    action: "KEEP" | "DELETE" | "ARCHIVE";
  }>;
  cleanupCandidates: Array<{
    id?: string;
    type: "DRIVE_FILE" | "GMAIL_EMAIL";
    name: string;
    reason: string;
    action: "DELETE" | "ARCHIVE";
  }>;
  organizationTips: string[];
}
