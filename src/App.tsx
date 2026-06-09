/// <reference path="./react-app-env.d.ts" />

import { useState, useEffect } from "react";
import {
  Sparkles,
  LogOut,
  RefreshCw,
  AlertTriangle,
  Check,
  Loader2,
  HardDrive,
  Mail
} from "lucide-react";
import { User } from "firebase/auth";
import { initAuth, googleSignIn, logout } from "./lib/googleAuth";
import {
  listDriveFiles,
  trashDriveFile,
  createDriveFolder,
  moveDriveFile,
  listRecentGmailMessages,
  getGmailMessageDetails,
  trashGmailMessage
} from "./lib/googleApi";
import { DriveFile, GmailMessage, GeminiAnalysisResult } from "./types";
import DashboardStats from "./components/DashboardStats";
import DriveOrganizer from "./components/DriveOrganizer";
import GmailSweeper from "./components/GmailSweeper";
import AiAdvisor from "./components/AiAdvisor";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [files, setFiles] = useState<DriveFile[]>([]);
  const [emails, setEmails] = useState<GmailMessage[]>([]);
  const [lastAnalysis, setLastAnalysis] = useState<GeminiAnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<"drive" | "gmail">("drive");

  // Load configuration and listen to login state changes
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        setNeedsAuth(false);
        loadWorkspaceData(accessToken);
      },
      () => {
        setUser(null);
        setToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  // Main data loader
  const loadWorkspaceData = async (accessToken: string) => {
    setIsLoading(true);
    setErrorMsg("");
    try {
      // 1. Fetch Drive Files
      const drFiles = await listDriveFiles(accessToken);
      setFiles(drFiles);

      // 2. Fetch Gmail messages (limited to 35 message details for speed and quota optimization)
      const msgIds = await listRecentGmailMessages(accessToken, 35);
      const detailPromises = msgIds.map(async (id) => {
        try {
          return await getGmailMessageDetails(accessToken, id);
        } catch (err) {
          console.error(`Skipping loading email detail for message ID: ${id}`, err);
          return null;
        }
      });
      const finalEmails = (await Promise.all(detailPromises)).filter(Boolean) as GmailMessage[];
      setEmails(finalEmails);
    } catch (err: any) {
      console.error("Failed loading data from Google workspace:", err);
      setErrorMsg("Ocurrió un error al conectar con los servicios de Google Workspace. Revisa tu conexión o inicia sesión de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualLogin = async () => {
    setErrorMsg("");
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setNeedsAuth(false);
        loadWorkspaceData(result.accessToken);
      }
    } catch (err: any) {
      console.error("Sign-in popup error:", err);
      setErrorMsg("Fallo al autenticar con Google. Asegúrate de dar los permisos e intenta nuevamente.");
    }
  };

  const handleManualLogout = async () => {
    if (window.confirm("¿Seguro que deseas cerrar la sesión?")) {
      await logout();
      setUser(null);
      setToken(null);
      setFiles([]);
      setEmails([]);
      setLastAnalysis(null);
      setNeedsAuth(true);
    }
  };

  const triggerRefresh = () => {
    const currentToken = token;
    if (currentToken) {
      loadWorkspaceData(currentToken);
    }
  };

  // --- ACTIONS INTERFACE IMPLEMENTATION ---

  const handleSingleTrashFile = async (fileId: string) => {
    if (!token) return;
    setIsProcessing(true);
    setSuccessMsg("");
    try {
      await trashDriveFile(token, fileId);
      setFiles((prev: DriveFile[]) => prev.filter((f: DriveFile) => f.id !== fileId));
      setSuccessMsg("¡Archivo movido a la papelera con éxito!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      alert(`Error al eliminar: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMoveFilesToFolder = async (fileIds: string[], folderName: string) => {
    if (!token || fileIds.length === 0) return;
    setIsProcessing(true);
    setSuccessMsg("");
    try {
      // 1. Create Folder
      const newFolderId = await createDriveFolder(token, folderName);

      // 2. Loop move Drive Files to folder
      for (const id of fileIds) {
        const fileMatch = files.find((f: DriveFile) => f.id === id);
        await moveDriveFile(token, id, newFolderId, fileMatch?.parents);
      }

      setSuccessMsg(`Se organizaron ${fileIds.length} archivo(s) en la nueva carpeta "${folderName}"`);
      setTimeout(() => setSuccessMsg(""), 3000);
      
      // Auto Refresh after restructure
      await loadWorkspaceData(token);
    } catch (err: any) {
      alert(`Error al organizar en carpeta: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSingleTrashEmail = async (messageId: string) => {
    if (!token) return;
    setIsProcessing(true);
    setSuccessMsg("");
    try {
      await trashGmailMessage(token, messageId);
      setEmails((prev: GmailMessage[]) => prev.filter((m: GmailMessage) => m.id !== messageId));
      setSuccessMsg("¡Correo movido a la papelera!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      alert(`Error al eliminar: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- GEMINI ANALYSIS BRIDGE ---
  const handleRunAiAnalysis = async () => {
    if (files.length === 0 && emails.length === 0) {
      alert("No hay archivos escaneados o correos para analizar.");
      return;
    }
    setIsAnalyzing(true);
    setSuccessMsg("");
    try {
      // Collect metadata summaries to minimize API payload size and remain fast!
      const driveMetadataList = files.map((f: DriveFile) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        mimeType: f.mimeType,
        createdTime: f.createdTime,
      }));

      const emailMetadataList = emails.map((e: GmailMessage) => ({
        id: e.id,
        subject: e.subject,
        from: e.from,
        date: e.date,
        snippet: e.snippet,
        sizeEstimate: e.sizeEstimate,
      }));

      const response = await fetch("/api/gemini/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driveFiles: driveMetadataList,
          emailList: emailMetadataList,
        }),
      });

      if (!response.ok) {
        throw new Error("El servicio de Gemini no está disponible temporalmente.");
      }

      const reportData: GeminiAnalysisResult = await response.json();
      setLastAnalysis(reportData);
      setSuccessMsg("¡Análisis de Gemini cargado exitosamente!");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: any) {
      console.error(err);
      alert("Fallo al obtener recomendaciones de Gemini: " + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Helper calculating count of cryptographic or name duplicates
  const duplicatesCount = (): number => {
    const checksumGroups: { [key: string]: number } = {};
    const nameSizeGroups: { [key: string]: number } = {};
    let duplicates = 0;

    files.forEach((file: DriveFile) => {
      if (file.mimeType === "application/vnd.google-apps.folder") return;
      if (file.md5Checksum) {
        checksumGroups[file.md5Checksum] = (checksumGroups[file.md5Checksum] || 0) + 1;
      } else {
        const key = `${file.name.toLowerCase()}_${file.size || "0"}`;
        nameSizeGroups[key] = (nameSizeGroups[key] || 0) + 1;
      }
    });

    Object.values(checksumGroups).forEach((cnt: number) => {
      if (cnt > 1) duplicates += cnt - 1;
    });

    Object.keys(nameSizeGroups).forEach((key: string) => {
      const cnt = nameSizeGroups[key];
      // Skip if md5 checksum covered
      if (cnt > 1) {
        const name = key.split("_")[0];
        const sizeStr = key.split("_")[1];
        const alreadyCovered = files.some(
          (f: DriveFile) =>
            f.md5Checksum &&
            f.name.toLowerCase() === name &&
            (f.size || "0") === sizeStr
        );
        if (!alreadyCovered) {
          duplicates += cnt - 1;
        }
      }
    });

    return duplicates;
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] flex flex-col justify-between" id="app-wrapper">
      {/* --- LANDING LOGIN PANEL (If needs authentication) --- */}
      {needsAuth ? (
        <div className="flex-1 flex items-center justify-center p-6 bg-[#050505]" id="landing-container">
          <div className="max-w-md w-full bg-[#0c0c0c] border border-white/10 rounded-3xl p-8 shadow-2xl text-center">
            {/* Elegant logo */}
            <div className="w-16 h-16 bg-orange-500/10 text-orange-500 border border-orange-500/20 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-lg" id="landing-logo">
              <Sparkles className="w-8 h-8" />
            </div>

            <h1 className="text-2xl font-light text-white tracking-tight mb-2">
              Google Workspace AI Clean-Up
            </h1>
            <p className="text-[11px] text-[#999999] max-w-sm mx-auto leading-relaxed mb-6 font-light">
              Organiza, filtra y deshazte del desorden digital en tu bandeja o nube de manera centralizada. 
              Encuentra fotos duplicadas, correos descartables o adjuntos pesados en un panel unificado.
            </p>

            {errorMsg && (
              <div className="bg-[#ff6b6b]/10 border border-[#ff6b6b]/20 rounded-xl p-3 text-left text-xs text-[#ff8787] mb-4 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Official Material Standard Google Sign In Button */}
            <button
              type="button"
              onClick={handleManualLogin}
              className="gsi-material-button w-full flex items-center justify-center"
              id="google-sig-in-btn"
            >
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: "block" }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                </div>
                <span className="gsi-material-button-contents">Conectar con Google Workspace</span>
              </div>
            </button>

            <p className="text-[9px] text-[#777777] mt-5">
              Tus credenciales de autenticación se manejan directamente mediante Firebase Auth de Google.
            </p>
          </div>
        </div>
      ) : (
        /* --- MAIN DASHBOARD INTERFACE CONTAINER --- */
        <div className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-6 py-6" id="dashboard-hub">
          {/* Header row */}
          <div className="flex items-center justify-between border-b border-white/5 pb-5 mb-6 flex-wrap gap-4" id="main-header">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-xl">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-light text-white tracking-tight" id="dash-heading-title">
                  Workspace AI Organizer & CleanUp
                </h1>
                <p className="text-[10px] uppercase tracking-widest text-[#999999]">
                  Almacenamiento para {user?.email || "tu cuenta de Google"}
                </p>
              </div>
            </div>

            {/* Quick controller actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={triggerRefresh}
                disabled={isLoading}
                className="bg-white/5 hover:bg-white/10 text-white text-xs font-semibold px-4.5 py-2.5 rounded-full transition-all border border-white/5 flex items-center gap-1.5"
                title="Sincronizar de Google Drive y Gmail"
              >
                {isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Sincronizar
              </button>

              <button
                type="button"
                onClick={handleManualLogout}
                className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold px-4.5 py-2.5 rounded-full transition-all border border-rose-500/10 flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                Cerrar sesión
              </button>
            </div>
          </div>

          {/* Success Notification Bar */}
          {successMsg && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-3.5 px-5 mb-6 text-xs font-semibold text-emerald-400 flex items-center gap-2 animate-fade-in shadow-sm">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Loading States Screen */}
          {isLoading && files.length === 0 && emails.length === 0 ? (
            <div className="py-24 text-center">
              <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
              <h2 className="text-base font-light text-white font-serif italic">Analizando archivos de Drive y correos de Gmail...</h2>
              <p className="text-xs text-white/45 mt-1 max-w-sm mx-auto">
                Esto procesará archivos duplicados y firmas de seguridad en lote directos desde tu nube.
              </p>
            </div>
          ) : (
            <>
              {/* Stats Grid */}
              <DashboardStats
                files={files}
                emails={emails}
                duplicatesCount={duplicatesCount()}
                onAnalyzeAi={handleRunAiAnalysis}
                isAnalyzing={isAnalyzing}
              />

              {/* AI Gemini Recommendations Card */}
              <AiAdvisor
                files={files}
                emails={emails}
                lastAnalysis={lastAnalysis}
                onRunAnalysis={handleRunAiAnalysis}
                isAnalyzing={isAnalyzing}
                onTrashFile={handleSingleTrashFile}
                onTrashEmail={handleSingleTrashEmail}
                isProcessing={isProcessing}
              />

              {/* Organizer Module Sections with beautiful Service Selector */}
              <div className="flex border-b border-white/5 mb-6 gap-2" id="resource-tabs">
                <button
                  onClick={() => setActiveTab("drive")}
                  className={`pb-3 px-4 text-sm font-semibold transition-all border-b-2 flex items-center gap-2 ${
                    activeTab === "drive"
                      ? "border-orange-500 text-orange-400"
                      : "border-transparent text-[#999999] hover:text-white"
                  }`}
                >
                  <HardDrive className="w-4 h-4" />
                  Archivos en Google Drive ({files.length})
                </button>
                <button
                  onClick={() => setActiveTab("gmail")}
                  className={`pb-3 px-4 text-sm font-semibold transition-all border-b-2 flex items-center gap-2 ${
                    activeTab === "gmail"
                      ? "border-orange-500 text-orange-400"
                      : "border-transparent text-[#999999] hover:text-white"
                  }`}
                >
                  <Mail className="w-4 h-4" />
                  Bandeja de Gmail ({emails.length})
                </button>
              </div>

              {/* Render dynamic subcomponents directly depending on selection */}
              {activeTab === "drive" ? (
                <DriveOrganizer
                  files={files}
                  onTrashFile={handleSingleTrashFile}
                  onMoveToFolder={handleMoveFilesToFolder}
                  isProcessing={isProcessing}
                />
              ) : (
                <GmailSweeper
                  emails={emails}
                  onTrashEmail={handleSingleTrashEmail}
                  isProcessing={isProcessing}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* Elegant minimalist footer */}
      <footer className="py-6 border-t border-white/5 bg-[#080808] text-center text-[10px] uppercase tracking-widest text-[#777777]">
        Google Workspace Organizer & CleanUp AI &bull; Desarrollado con Gemini & Firebase Auth
      </footer>
    </div>
  );
}
