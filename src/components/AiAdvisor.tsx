import { Sparkles, Loader2, AlertTriangle, CheckSquare, RefreshCw, Trash2, HelpCircle } from "lucide-react";
import { DriveFile, GmailMessage, GeminiAnalysisResult } from "../types";

interface AiAdvisorProps {
  files: DriveFile[];
  emails: GmailMessage[];
  lastAnalysis: GeminiAnalysisResult | null;
  onRunAnalysis: () => Promise<void>;
  isAnalyzing: boolean;
  onTrashFile: (fileId: string) => Promise<void>;
  onTrashEmail: (messageId: string) => Promise<void>;
  isProcessing: boolean;
}

export default function AiAdvisor({
  files,
  emails,
  lastAnalysis,
  onRunAnalysis,
  isAnalyzing,
  onTrashFile,
  onTrashEmail,
  isProcessing,
}: AiAdvisorProps) {
  const handleActionOnItem = async (candidate: { id?: string; type?: string; name: string }) => {
    if (!candidate.id) {
      alert("No se puede completar la acción automática porque el archivo o correo no proporciona un ID válido.");
      return;
    }

    const conf = window.confirm(`¿Quieres enviar a la Papelera el recurso de IA sugerido: "${candidate.name}"?`);
    if (!conf) return;

    try {
      if (candidate.type === "GMAIL_EMAIL") {
        await onTrashEmail(candidate.id);
      } else {
        await onTrashFile(candidate.id);
      }
      alert("Elemento enviado a la papelera con éxito. Pulsa 'Refrescar Información' para actualizar.");
    } catch (err: any) {
      alert(`Error al limpiar: ${err.message}`);
    }
  };

  return (
    <div className="bg-[#0c0c0c] border border-white/10 text-[#e0e0e0] rounded-3xl p-6 shadow-2xl mb-8" id="ai-advisor-container">
      {/* Title Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-5 mb-5 flex-wrap gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-orange-500/10 text-orange-400 rounded-2xl border border-orange-500/20 shadow-inner">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-light tracking-tight text-white mb-0.5">Asistente de Limpieza Digital con Gemini AI</h2>
            <p className="text-[10px] uppercase tracking-widest text-[#999999]">
              Análisis inteligente de metadatos de Google Workspace
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={isAnalyzing || isProcessing || (files.length === 0 && emails.length === 0)}
          onClick={onRunAnalysis}
          className="bg-white hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-500 text-black font-semibold px-5 py-2.5 text-xs rounded-full transition-all shadow-sm flex items-center gap-2"
          id="btn-ai-analyze"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Gemini Analizando...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-orange-500" />
              Solicitar Recomendaciones AI
            </>
          )}
        </button>
      </div>

      {/* Main Body */}
      {isAnalyzing && (
        <div className="py-12 flex flex-col items-center justify-center text-center">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
          <p className="text-sm font-semibold text-white">Gemini está analizando la estructura de tu cuenta...</p>
          <p className="text-[11px] text-white/40 mt-1 max-w-sm">
            Esto podría tardar unos segundos mientras procesa colecciones de metadatos, firmas hash y correos publicitarios.
          </p>
        </div>
      )}

      {!isAnalyzing && !lastAnalysis && (
        <div className="py-10 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
          <Sparkles className="w-8 h-8 text-orange-500/40 mx-auto mb-3" />
          <p className="text-sm font-light text-white font-serif italic">Recomendaciones listas para generar</p>
          <p className="text-[11px] text-[#888888] mt-1.5 max-w-md mx-auto leading-relaxed">
            Haga clic en el botón superior para enviar de manera segura metadatos a Gemini. Ningún contenido de tus archivos privados ni claves saldrán del servidor.
          </p>
        </div>
      )}

      {!isAnalyzing && lastAnalysis && (
        <div className="space-y-6">
          {/* Assessment Summary */}
          <div className="bg-white/[0.03] rounded-2xl p-5 border border-white/5">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-orange-400 mb-2">Evaluación de Almacenamiento</h3>
            <p className="text-xs leading-relaxed text-white/95 font-medium">{lastAnalysis.overallAssessment}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cleanup Candidates Suggested by AI */}
            <div className="bg-white/[0.03] rounded-2xl p-5 border border-white/5 flex flex-col justify-between">
              <div>
                <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#ff6b6b] mb-3 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Desorden Digital Detectado ({lastAnalysis.cleanupCandidates?.length || 0})
                </h3>
                {(!lastAnalysis.cleanupCandidates || lastAnalysis.cleanupCandidates.length === 0) ? (
                  <p className="text-xs text-white/40 italic">No se sugieren candidatos obvios.</p>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    {lastAnalysis.cleanupCandidates.map((item, idx) => (
                      <div key={idx} className="bg-white/5 rounded-xl p-3 border border-white/5 hover:bg-white/10 transition-all flex items-start justify-between gap-2">
                        <div className="truncate">
                          <span className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded mr-1.5 block self-start w-fit mb-1 bg-[#ff6b6b]/10 text-[#ff8787]">
                            {item.type === "GMAIL_EMAIL" ? "Gmail" : "Drive"}
                          </span>
                          <span className="text-xs font-semibold text-white truncate block">{item.name}</span>
                          <span className="text-[10px] text-[#999999] block mt-0.5 leading-tight">{item.reason}</span>
                        </div>
                        {item.id && (
                          <button
                            type="button"
                            onClick={() => handleActionOnItem(item)}
                            className="bg-[#ff6b6b]/20 hover:bg-[#ff6b6b] text-[#ff8787] hover:text-white p-1 rounded transition-all text-[10px] shrink-0 font-bold px-2.5 self-center border border-[#ff6b6b]/20"
                          >
                            Tirar
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* AI Custom Org Tips */}
            <div className="bg-white/[0.03] rounded-2xl p-5 border border-white/5 flex flex-col justify-between">
              <div>
                <h3 className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400 mb-3 flex items-center gap-1">
                  <CheckSquare className="w-3.5 h-3.5" /> Consejos de Organización sugeridos
                </h3>
                {(!lastAnalysis.organizationTips || lastAnalysis.organizationTips.length === 0) ? (
                  <p className="text-xs text-white/40 italic">Gemini considera que tus pautas de orden están correctas.</p>
                ) : (
                  <ul className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    {lastAnalysis.organizationTips.map((tip, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs leading-relaxed text-[#cccccc]">
                        <span className="p-1 px-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-bold text-[9px] shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
