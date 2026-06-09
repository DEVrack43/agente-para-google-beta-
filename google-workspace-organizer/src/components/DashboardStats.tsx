import { Database, HardDrive, Mail, Trash2, ShieldAlert } from "lucide-react";
import { DriveFile, GmailMessage } from "../types";

interface DashboardStatsProps {
  files: DriveFile[];
  emails: GmailMessage[];
  duplicatesCount: number;
  onAnalyzeAi: () => void;
  isAnalyzing: boolean;
}

export default function DashboardStats({
  files,
  emails,
  duplicatesCount,
  onAnalyzeAi,
  isAnalyzing,
}: DashboardStatsProps) {
  // Drive Size summation
  const totalDriveSize = files.reduce((acc, file) => {
    return acc + (file.size ? parseInt(file.size, 10) : 0);
  }, 0);

  // Email size summation
  const totalEmailSize = emails.reduce((acc, email) => {
    return acc + (email.sizeEstimate || 0);
  }, 0);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const imageFiles = files.filter((f) => f.mimeType.startsWith("image/"));
  const docsFiles = files.filter((f) =>
    f.mimeType.includes("document") ||
    f.mimeType.includes("word") ||
    f.mimeType.includes("pdf") ||
    f.mimeType.includes("spreadsheet")
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8" id="dashboard-stats-grid">
      {/* Total Storage Card */}
      <div className="bg-[#111111] border border-white/5 rounded-2xl p-6 shadow-2xl flex flex-col justify-between" id="stat-card-storage">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] uppercase tracking-widest text-[#999999]">Almacenamiento Escaneado</span>
          <div className="p-2.5 bg-white/5 text-orange-500 rounded-xl border border-white/10">
            <Database className="w-4 h-4" />
          </div>
        </div>
        <div>
          <h3 className="text-3xl font-light text-serif-italic font-serif text-white tracking-tight" id="storage-value">
            {formatSize(totalDriveSize + totalEmailSize)}
          </h3>
          <p className="text-[10px] text-[#777777] mt-1.5 uppercase tracking-wider">
            Drive: {formatSize(totalDriveSize)} &bull; Correo: {formatSize(totalEmailSize)}
          </p>
        </div>
      </div>

      {/* Drive Documents & Photos Card */}
      <div className="bg-[#111111] border border-white/5 rounded-2xl p-6 shadow-2xl flex flex-col justify-between" id="stat-card-files">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] uppercase tracking-widest text-[#999999]">Archivos en Drive</span>
          <div className="p-2.5 bg-white/5 text-emerald-400 rounded-xl border border-white/10">
            <HardDrive className="w-4 h-4" />
          </div>
        </div>
        <div>
          <h3 className="text-3xl font-light text-serif-italic font-serif text-white tracking-tight">
            {files.length} <span className="text-sm font-normal text-[#777777] lowercase italic">ítems</span>
          </h3>
          <p className="text-[10px] text-[#777777] mt-1.5 uppercase tracking-wider">
            {imageFiles.length} Fotos &bull; {docsFiles.length} Docs
          </p>
        </div>
      </div>

      {/* Gmail Inbox Sweep Status Card */}
      <div className="bg-[#111111] border border-white/5 rounded-2xl p-6 shadow-2xl flex flex-col justify-between" id="stat-card-emails">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] uppercase tracking-widest text-[#999999]">Correos Recientes</span>
          <div className="p-2.5 bg-white/5 text-blue-400 rounded-xl border border-white/10">
            <Mail className="w-4 h-4" />
          </div>
        </div>
        <div>
          <h3 className="text-3xl font-light text-serif-italic font-serif text-white tracking-tight">
            {emails.length} <span className="text-sm font-normal text-[#777777] lowercase italic">analizados</span>
          </h3>
          <p className="text-[10px] text-[#777777] mt-1.5 uppercase tracking-wider font-mono">
            {emails.filter((e) => e.isUnread).length} sin leer &bull; {emails.filter(e => (e.sizeEstimate || 0) > 100000).length} pesados
          </p>
        </div>
      </div>

      {/* Duplicate Candidates Card */}
      <div className="bg-[#111111] border border-white/5 rounded-2xl p-6 shadow-2xl flex flex-col justify-between" id="stat-card-duplicates">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] uppercase tracking-widest text-[#999999]">Grupo Duplicados Drive</span>
          <div className="p-2.5 bg-white/5 text-rose-400 rounded-xl border border-white/10">
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div>
            <h3 className="text-3xl font-light text-serif-italic font-serif text-white tracking-tight">
              {duplicatesCount} <span className="text-sm font-normal text-[#777777] lowercase italic">grupos</span>
            </h3>
            <p className="text-[10px] text-[#777777] mt-1.5 uppercase tracking-wider">
              Copias idénticas listas para eliminar
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
