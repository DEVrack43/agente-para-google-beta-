import { useState, useMemo } from "react";
import {
  File,
  Image as ImageIcon,
  FileText,
  AlertTriangle,
  FolderOpen,
  Trash2,
  Folder,
  Search,
  Check,
  CheckSquare,
  Square,
  ExternalLink,
  Loader2,
  ChevronRight,
  Info
} from "lucide-react";
import { DriveFile, DuplicateGroup } from "../types";

interface DriveOrganizerProps {
  files: DriveFile[];
  onTrashFile: (fileId: string) => Promise<void>;
  onMoveToFolder: (fileIds: string[], folderName: string) => Promise<void>;
  isProcessing: boolean;
}

export default function DriveOrganizer({
  files,
  onTrashFile,
  onMoveToFolder,
  isProcessing,
}: DriveOrganizerProps) {
  const [activeTab, setActiveTab] = useState<"explorer" | "duplicates">("duplicates");
  const [filterCategory, setFilterCategory] = useState<"all" | "images" | "documents" | "large">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedExplorerFiles, setSelectedExplorerFiles] = useState<string[]>([]);
  const [organizationFolderName, setOrganizationFolderName] = useState("AI Organizado");
  const [showConfirmTrashModal, setShowConfirmTrashModal] = useState(false);
  const [fileToTrash, setFileToTrash] = useState<string | null>(null);
  const [bulkTrashList, setBulkTrashList] = useState<string[]>([]);

  // Format File Size
  const formatSize = (bytesStr?: string) => {
    if (!bytesStr) return "0 Bytes";
    const bytes = parseInt(bytesStr, 10);
    if (isNaN(bytes)) return "-";
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) {
      return <ImageIcon className="w-4 h-4 text-emerald-500" />;
    }
    if (
      mimeType.includes("document") ||
      mimeType.includes("word") ||
      mimeType.includes("pdf")
    ) {
      return <FileText className="w-4 h-4 text-indigo-500" />;
    }
    if (mimeType.includes("folder")) {
      return <Folder className="w-4 h-4 text-amber-500" />;
    }
    return <File className="w-4 h-4 text-slate-400" />;
  };

  // --- EXPLORER FILTERING ---
  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      // Don't list folders directly in this simple cleanUp view
      if (file.mimeType === "application/vnd.google-apps.folder") return false;

      // Category toggle
      if (filterCategory === "images" && !file.mimeType.startsWith("image/")) return false;
      if (
        filterCategory === "documents" &&
        !(
          file.mimeType.includes("document") ||
          file.mimeType.includes("word") ||
          file.mimeType.includes("pdf") ||
          file.mimeType.includes("spreadsheet")
        )
      ) {
        return false;
      }
      if (filterCategory === "large") {
        const size = file.size ? parseInt(file.size, 10) : 0;
        if (size < 10 * 1024 * 1024) return false; // > 10MB
      }

      // Search searchQuery
      if (
        searchQuery &&
        !file.name.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }

      return true;
    });
  }, [files, filterCategory, searchQuery]);

  // --- DUPLICATE COLLATING ENGINE ---
  const duplicateGroups = useMemo(() => {
    // Stage 1: Group files by md5Checksum first (if available and not empty)
    const checksumGroups: { [key: string]: DriveFile[] } = {};
    const nameSizeGroups: { [key: string]: DriveFile[] } = {};

    files.forEach((file) => {
      // Exclude folders
      if (file.mimeType === "application/vnd.google-apps.folder") return;

      if (file.md5Checksum) {
        if (!checksumGroups[file.md5Checksum]) {
          checksumGroups[file.md5Checksum] = [];
        }
        checksumGroups[file.md5Checksum].push(file);
      } else {
        // Fallback: match by Name + Size
        const key = `${file.name.toLowerCase()}_${file.size || "0"}`;
        if (!nameSizeGroups[key]) {
          nameSizeGroups[key] = [];
        }
        nameSizeGroups[key].push(file);
      }
    });

    const groups: DuplicateGroup[] = [];

    // Add exact checksum groups
    Object.keys(checksumGroups).forEach((md5) => {
      const groupFiles = checksumGroups[md5];
      if (groupFiles.length > 1) {
        // Sort files so the oldest (original) is first
        const sorted = [...groupFiles].sort(
          (a, b) =>
            new Date(a.createdTime || "").getTime() -
            new Date(b.createdTime || "").getTime()
        );
        groups.push({
          hashOrKey: md5,
          name: sorted[0].name,
          mimeType: sorted[0].mimeType,
          size: parseInt(sorted[0].size || "0", 10),
          files: sorted,
        });
      }
    });

    // Add Name+Size matches that are not already covered
    Object.keys(nameSizeGroups).forEach((key) => {
      const groupFiles = nameSizeGroups[key];
      if (groupFiles.length > 1) {
        const sorted = [...groupFiles].sort(
          (a, b) =>
            new Date(a.createdTime || "").getTime() -
            new Date(b.createdTime || "").getTime()
        );
        // Only output if not already bundled
        if (!groups.some((g) => g.name === sorted[0].name && g.size === parseInt(sorted[0].size || "0", 10))) {
          groups.push({
            hashOrKey: key,
            name: sorted[0].name,
            mimeType: sorted[0].mimeType,
            size: parseInt(sorted[0].size || "0", 10),
            files: sorted,
          });
        }
      }
    });

    return groups;
  }, [files]);

  const handleSelectAllExplorer = () => {
    if (selectedExplorerFiles.length === filteredFiles.length) {
      setSelectedExplorerFiles([]);
    } else {
      setSelectedExplorerFiles(filteredFiles.map((f) => f.id));
    }
  };

  const handleToggleExplorerFile = (id: string) => {
    setSelectedExplorerFiles((prev) =>
      prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id]
    );
  };

  // Prepares the trash action with a clear dialog
  const triggerSingleTrash = (fileId: string) => {
    setFileToTrash(fileId);
    setBulkTrashList([]);
    setShowConfirmTrashModal(true);
  };

  const triggerBulkTrash = (ids: string[]) => {
    if (ids.length === 0) return;
    setFileToTrash(null);
    setBulkTrashList(ids);
    setShowConfirmTrashModal(true);
  };

  const executeConfirmTrash = async () => {
    setShowConfirmTrashModal(false);
    if (fileToTrash) {
      await onTrashFile(fileToTrash);
      setFileToTrash(null);
    } else if (bulkTrashList.length > 0) {
      // Loop with confirmation completed
      for (const id of bulkTrashList) {
        await onTrashFile(id);
      }
      setSelectedExplorerFiles([]);
      setBulkTrashList([]);
    }
  };

  // Helper to pre-select duplicates for quick removal
  // It suggests trashing all files in each group except the one created earliest (the original!)
  const selectAllSecondaryCopies = () => {
    const idsToTrash: string[] = [];
    duplicateGroups.forEach((group) => {
      // From index 1 onwards are subsequent copies
      for (let i = 1; i < group.files.length; i++) {
        idsToTrash.push(group.files[i].id);
      }
    });

    if (idsToTrash.length > 0) {
      triggerBulkTrash(idsToTrash);
    } else {
      alert("No se detectaron copias redundantes adicionales.");
    }
  };

  return (
    <div className="bg-[#111111] border border-white/5 rounded-3xl p-6 shadow-2xl mb-8" id="drive-organizer-container">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 pb-5 mb-5 gap-4">
        <div>
          <h2 className="text-xl font-light text-white tracking-tight flex items-center gap-2">
            <FolderOpen className="text-orange-500 w-5 h-5" />
            Gestor de Archivos de Google Drive
          </h2>
          <p className="text-[10px] uppercase tracking-widest text-[#999999] mt-1">
            Organiza tus documentos, filtra tus fotos e identifica archivos redundantes.
          </p>
        </div>

        {/* Tab triggers */}
        <div className="flex bg-white/[0.02] p-1 rounded-xl border border-white/10 self-start md:self-auto">
          <button
            onClick={() => setActiveTab("duplicates")}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "duplicates"
                ? "bg-white text-black shadow-md"
                : "text-white/60 hover:text-white"
            }`}
            id="tab-duplicates"
          >
            Detector de Duplicados ({duplicateGroups.length})
          </button>
          <button
            onClick={() => setActiveTab("explorer")}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "explorer"
                ? "bg-white text-black shadow-md"
                : "text-white/60 hover:text-white"
            }`}
            id="tab-explorer"
          >
            Explorador por Categorías
          </button>
        </div>
      </div>

      {/* --- DETECTOR DE DUPLICADOS TAB --- */}
      {activeTab === "duplicates" && (
        <div>
          {/* Quick info banner */}
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 mb-6 flex items-start gap-3">
            <Info className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
            <div className="text-xs text-white/80 leading-relaxed">
              <span className="font-semibold text-orange-400">¿Cómo funciona?</span> Agrupamos los archivos que tienen la misma firma digital (checksum hash) o idéntico nombre y tamaño exacto. 
              Conserva el archivo original (el más antiguo) y elimina copias duplicadas para liberar almacenamiento.
            </div>
          </div>

          {duplicateGroups.length === 0 ? (
            <div className="py-12 text-center text-white/40 border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
              <Check className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-white/80">¡Tu Google Drive está limpio!</p>
              <p className="text-xs text-white/40 mt-1">No se encontraron archivos duplicados exactos en el escaneo.</p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-semibold text-[#888888] uppercase tracking-widest">
                  Grupos de Archivos Duplicados ({duplicateGroups.length})
                </span>
                <button
                  type="button"
                  onClick={selectAllSecondaryCopies}
                  disabled={isProcessing}
                  className="bg-white hover:bg-neutral-200 text-black text-xs font-semibold px-4 py-2 rounded-full transition-all shadow-sm flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5 text-orange-500" />
                  Depurar Copias Redundantes (Auto)
                </button>
              </div>

              {/* Group elements */}
              <div className="space-y-4">
                {duplicateGroups.map((group, groupIdx) => (
                  <div
                    key={group.hashOrKey}
                    className="border border-white/5 bg-white/[0.01] rounded-2xl overflow-hidden hover:border-white/10 transition-all"
                  >
                    {/* Header values */}
                    <div className="bg-white/[0.02] px-4 py-3 border-b border-white/5 flex items-center justify-between flex-wrap gap-2">
                       <div className="flex items-center gap-2">
                        {getFileIcon(group.mimeType)}
                        <span className="text-sm font-medium text-white truncate max-w-xs md:max-w-md">
                          {group.name}
                        </span>
                        <span className="text-[10px] bg-white/10 text-white/85 px-2.5 py-0.5 rounded-full font-mono">
                          {formatSize(group.size.toString())}
                        </span>
                      </div>
                      <span className="text-[10px] text-white/40 italic uppercase tracking-wider">
                        {group.files.length} copias encontradas
                      </span>
                    </div>

                    {/* Files within this group */}
                    <div className="divide-y divide-white/5">
                      {group.files.map((file, fileIdx) => {
                        const isOriginal = fileIdx === 0;
                        return (
                          <div
                            key={file.id}
                            className={`px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.02] transition-all ${
                              isOriginal ? "bg-emerald-500/[0.02]" : ""
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              {file.thumbnailLink ? (
                                <img
                                  src={file.thumbnailLink}
                                  alt=""
                                  referrerPolicy="no-referrer"
                                  className="w-10 h-10 object-cover rounded-md border border-white/10"
                                />
                              ) : (
                                <div className="p-2.5 bg-white/5 text-white/60 rounded-lg">
                                  {getFileIcon(file.mimeType)}
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-white/90 truncate max-w-[180px] sm:max-w-xs">
                                    {file.name}
                                  </span>
                                  {isOriginal ? (
                                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                                      Original (Más Antiguo)
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded">
                                      Copia Redundante
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-white/40 mt-1">
                                  ID: <span className="font-mono text-white/30">{file.id.substring(0, 10)}...</span> &bull; Creado: {file.createdTime ? new Date(file.createdTime).toLocaleString() : "Desconocida"}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-auto text-xs">
                              {file.webViewLink && (
                                <a
                                  href={file.webViewLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 px-2.5 hover:bg-white/5 rounded text-white/65 hover:text-white flex items-center gap-1 border border-white/5"
                                >
                                  Ver <ExternalLink className="w-3 h-3 text-orange-500" />
                                </a>
                              )}
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => triggerSingleTrash(file.id)}
                                className={`text-[11px] font-semibold p-1 px-3.5 rounded-lg transition-all flex items-center gap-1 ${
                                  isOriginal
                                    ? "text-white/40 hover:text-rose-400 hover:bg-white/5"
                                    : "text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20"
                                }`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                {isOriginal ? "Eliminar" : "Papelera"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- EXPLORER POR CATEGORIAS TAB --- */}
      {activeTab === "explorer" && (
        <div>
          {/* Filters / Command actions */}
          <div className="flex flex-col md:flex-row gap-4 mb-4 justify-between" id="explorer-toolbar">
            <div className="flex flex-wrap items-center gap-2" id="category-selector-pills">
              <button
                onClick={() => setFilterCategory("all")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                  filterCategory === "all"
                    ? "bg-white text-black"
                    : "bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                Todos los archivos
              </button>
              <button
                onClick={() => setFilterCategory("images")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                  filterCategory === "images"
                    ? "bg-emerald-600 text-white"
                    : "bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                Fotos / Imágenes
              </button>
              <button
                onClick={() => setFilterCategory("documents")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                  filterCategory === "documents"
                    ? "bg-indigo-650 text-white border border-indigo-500/20"
                    : "bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                Documentos
              </button>
              <button
                onClick={() => setFilterCategory("large")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                  filterCategory === "large"
                    ? "bg-rose-800 text-white"
                    : "bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                Grandes (+10MB)
              </button>
            </div>

            {/* Keyword search bar */}
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-white/40" />
              <input
                type="text"
                placeholder="Buscar archivos por nombre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-white/10 rounded-xl text-xs bg-white/[0.01] text-white focus:bg-white/[0.04] focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Bulk actions */}
          {selectedExplorerFiles.length > 0 && (
            <div className="bg-white/[0.03] text-white rounded-2xl p-4 mb-4 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in shadow-2xl">
              <span className="text-xs font-medium text-white/90">
                Seleccionado: <strong className="text-orange-400">{selectedExplorerFiles.length}</strong> archivo(s)
              </span>
              <div className="flex items-center gap-2 flex-wrap text-white">
                {/* Organize field */}
                <div className="flex items-center bg-[#151515] rounded-xl border border-white/10 p-1">
                  <input
                    type="text"
                    value={organizationFolderName}
                    onChange={(e) => setOrganizationFolderName(e.target.value)}
                    placeholder="Nombre de carpeta"
                    className="px-2.5 py-1 text-xs bg-transparent focus:outline-none w-32 font-medium text-white"
                  />
                  <button
                    onClick={() => onMoveToFolder(selectedExplorerFiles, organizationFolderName)}
                    disabled={isProcessing}
                    className="bg-white hover:bg-neutral-200 text-black text-xs px-3.5 py-1.5 font-bold rounded-lg transition-all"
                  >
                    Organizar Carpeta
                  </button>
                </div>
                {/* Trash selected */}
                <button
                  onClick={() => triggerBulkTrash(selectedExplorerFiles)}
                  disabled={isProcessing}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs px-4 py-2 font-semibold rounded-xl transition-all shadow-sm"
                >
                  Mover a Papelera ({selectedExplorerFiles.length})
                </button>
              </div>
            </div>
          )}

          {/* Files List Table */}
          {filteredFiles.length === 0 ? (
            <div className="py-12 text-center text-white/40 border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
              <Folder className="w-10 h-10 text-white/20 mx-auto mb-2" />
              <p className="text-xs">No se encontraron archivos en esta sección o búsqueda.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-white/5 rounded-2xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/5">
                    <th className="p-3 pl-4 w-10">
                      <button
                        type="button"
                        onClick={handleSelectAllExplorer}
                        className="text-white/40 hover:text-white"
                        title="Seleccionar todo"
                      >
                        {selectedExplorerFiles.length === filteredFiles.length ? (
                          <CheckSquare className="w-4 h-4 text-orange-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="p-3 text-[10px] uppercase tracking-widest font-semibold text-white/50">Nombre del Archivo</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest font-semibold text-white/50">Tipo</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest font-semibold text-white/50">Creado</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest font-semibold text-white/50">Tamaño</th>
                    <th className="p-3 text-[10px] uppercase tracking-widest font-semibold text-white/50 text-right pr-4">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-xs text-white/80">
                  {filteredFiles.map((file) => {
                    const isSelected = selectedExplorerFiles.includes(file.id);
                    return (
                      <tr
                        key={file.id}
                        className={`hover:bg-white/[0.02] transition-all ${
                          isSelected ? "bg-white/[0.02]" : ""
                        }`}
                      >
                        <td className="p-3 pl-4">
                          <button
                            type="button"
                            onClick={() => handleToggleExplorerFile(file.id)}
                            className="text-white/40 hover:text-white"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-orange-400" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2.5 max-w-[280px] sm:max-w-md">
                            {file.thumbnailLink ? (
                              <img
                                src={file.thumbnailLink}
                                alt=""
                                referrerPolicy="no-referrer"
                                className="w-8 h-8 object-cover rounded border border-white/10"
                              />
                            ) : (
                              <div className="p-2 bg-white/5 rounded">
                                {getFileIcon(file.mimeType)}
                              </div>
                            )}
                            <div className="truncate">
                              <span className="text-xs font-semibold text-white truncate block">
                                {file.name}
                              </span>
                              {file.md5Checksum && (
                                <span className="text-[10px] font-mono text-white/30 block truncate">
                                  md5: {file.md5Checksum}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-white/60">
                          <span className="truncate max-w-[120px] block font-mono" title={file.mimeType}>
                            {file.mimeType.split("/")[1] || file.mimeType}
                          </span>
                        </td>
                        <td className="p-3 text-white/50">
                          {file.createdTime ? new Date(file.createdTime).toLocaleDateString() : ""}
                        </td>
                        <td className="p-3">
                          <span className="text-white/80 block font-mono">
                            {formatSize(file.size)}
                          </span>
                          <span className="text-[10px] text-white/40 block italic">
                            {file.ownerNames?.[0] || "Mí"}
                          </span>
                        </td>
                        <td className="p-3 text-right pr-4">
                          <div className="flex items-center justify-end gap-2.5">
                            {file.webViewLink && (
                              <a
                                href={file.webViewLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 hover:bg-white/5 rounded text-white/40 hover:text-white"
                                title="Ver en Drive"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-orange-500" />
                              </a>
                            )}
                            <button
                              onClick={() => triggerSingleTrash(file.id)}
                              disabled={isProcessing}
                              className="p-1.5 hover:bg-rose-550/10 text-white/40 hover:text-rose-400 rounded"
                              title="Enviar a Papelera"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* --- CONFIRM TRASH MANDATORY MODAL --- */}
      {showConfirmTrashModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#111111] rounded-3xl p-6 max-w-md w-full shadow-2xl border border-white/10 text-[#e0e0e0]">
            <div className="flex items-center gap-3 text-rose-400 mb-4">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
              <h3 className="text-lg font-light tracking-tight text-white">Mandar a la Papelera de Google Drive</h3>
            </div>
            
            <p className="text-white/70 text-xs leading-relaxed mb-5">
              ¿Estás seguro de que deseas enviar{" "}
              <strong>
                {fileToTrash
                  ? "el archivo seleccionado"
                  : `${bulkTrashList.length} archivo(s)`}
              </strong>{" "}
              a la Papelera? 
              <br className="mb-2" />
              Esta acción moverá los elementos a la sección de papelera de tu Google Drive, donde se eliminarán definitivamente después de 30 días, a menos que decidas recuperarlos manualmente.
            </p>

            <div className="flex justify-end gap-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setShowConfirmTrashModal(false)}
                className="px-4 py-2 bg-white/5 text-white rounded-xl hover:bg-white/10 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeConfirmTrash}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all shadow-sm"
              >
                Mover a Papelera
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
