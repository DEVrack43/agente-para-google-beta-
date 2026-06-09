import { useState, useMemo } from "react";
import {
  Mail,
  Trash2,
  AlertTriangle,
  Info,
  Calendar,
  Layers,
  Inbox,
  Filter,
  CheckCircle,
  Square,
  CheckSquare,
  ExternalLink
} from "lucide-react";
import { GmailMessage } from "../types";

interface GmailSweeperProps {
  emails: GmailMessage[];
  onTrashEmail: (messageId: string) => Promise<void>;
  isProcessing: boolean;
}

export default function GmailSweeper({
  emails,
  onTrashEmail,
  isProcessing,
}: GmailSweeperProps) {
  const [filterType, setFilterType] = useState<"all" | "promo" | "old" | "heavy">("promo");
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [emailToTrash, setEmailToTrash] = useState<string | null>(null);
  const [bulkTrashList, setBulkTrashList] = useState<string[]>([]);

  // Format Helper for Email Dates
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  // Helper to determine if email is promotional/newsletter or low value
  const isPromotional = (email: GmailMessage) => {
    const fromLower = (email.from || "").toLowerCase();
    const subjectLower = (email.subject || "").toLowerCase();
    const snippetLower = (email.snippet || "").toLowerCase();

    const isNewsSender =
      fromLower.includes("newsletter") ||
      fromLower.includes("noreply") ||
      fromLower.includes("no-reply") ||
      fromLower.includes("promo") ||
      fromLower.includes("marketing") ||
      fromLower.includes("info@") ||
      fromLower.includes("notificacion");

    const isNewsSubject =
      subjectLower.includes("oferta") ||
      subjectLower.includes("newsletter") ||
      subjectLower.includes("promoción") ||
      subjectLower.includes("invitación") ||
      subjectLower.includes("suscripción") ||
      subjectLower.includes("descuento");

    const hasPromoLabels =
      email.labels?.includes("CATEGORY_PROMOTIONS") ||
      email.labels?.includes("CATEGORY_SOCIAL") ||
      email.labels?.includes("CATEGORY_UPDATES");

    return isNewsSender || isNewsSubject || hasPromoLabels;
  };

  // Helper to check if email is old (e.g., 6 months back)
  const isOldEmail = (email: GmailMessage) => {
    if (!email.date) return false;
    try {
      const msgTimestamp = new Date(email.date).getTime();
      const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000;
      return msgTimestamp < sixMonthsAgo;
    } catch {
      return false;
    }
  };

  // Filters candidates based on toggle
  const filteredEmails = useMemo(() => {
    return emails.filter((email) => {
      if (filterType === "promo") {
        return isPromotional(email);
      }
      if (filterType === "old") {
        return isOldEmail(email);
      }
      if (filterType === "heavy") {
        return (email.sizeEstimate || 0) > 200 * 1024; // > 200KB
      }
      return true; // All emails
    });
  }, [emails, filterType]);

  const handleSelectAll = () => {
    if (selectedEmails.length === filteredEmails.length) {
      setSelectedEmails([]);
    } else {
      setSelectedEmails(filteredEmails.map((e) => e.id));
    }
  };

  const handleToggleEmail = (id: string) => {
    setSelectedEmails((prev) =>
      prev.includes(id) ? prev.filter((eid) => eid !== id) : [...prev, id]
    );
  };

  const triggerSingleTrashMsg = (id: string) => {
    setEmailToTrash(id);
    setBulkTrashList([]);
    setShowConfirmModal(true);
  };

  const triggerBulkTrashMsg = (ids: string[]) => {
    if (ids.length === 0) return;
    setEmailToTrash(null);
    setBulkTrashList(ids);
    setShowConfirmModal(true);
  };

  const executeConfirmTrash = async () => {
    setShowConfirmModal(false);
    if (emailToTrash) {
      await onTrashEmail(emailToTrash);
      setEmailToTrash(null);
    } else if (bulkTrashList.length > 0) {
      for (const id of bulkTrashList) {
        await onTrashEmail(id);
      }
      setSelectedEmails([]);
      setBulkTrashList([]);
    }
  };

  // Quick action: selects all newsletters or automatic noreply notifications in current scan to clean in a single click
  const selectAllPromotionsToClean = () => {
    const promoIds = emails.filter((e) => isPromotional(e)).map((e) => e.id);
    if (promoIds.length > 0) {
      triggerBulkTrashMsg(promoIds);
    } else {
      alert("No se detectaron correos publicitarios o promocionales para limpiar.");
    }
  };

  return (
    <div className="bg-[#111111] border border-white/5 rounded-3xl p-6 shadow-2xl mb-8" id="gmail-sweeper-container">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 pb-5 mb-5 gap-4">
        <div>
          <h2 className="text-xl font-light text-white tracking-tight flex items-center gap-2">
            <Mail className="text-orange-500 w-5 h-5" />
            Limpieza y Control de Gmail (Bandeja de Entrada)
          </h2>
          <p className="text-[10px] uppercase tracking-widest text-[#999999] mt-1">
            Detecta boletines de noticias, correos promocionales masivos y notificaciones automáticas.
          </p>
        </div>

        {/* Tab filters */}
        <div className="flex bg-white/[0.02] p-1 rounded-xl border border-white/10 self-start md:self-auto">
          <button
            onClick={() => {
              setFilterType("promo");
              setSelectedEmails([]);
            }}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              filterType === "promo"
                ? "bg-white text-black shadow-md"
                : "text-white/60 hover:text-white"
            }`}
          >
            Promociones & Alertas
          </button>
          <button
            onClick={() => {
              setFilterType("old");
              setSelectedEmails([]);
            }}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              filterType === "old"
                ? "bg-white text-black shadow-md"
                : "text-white/60 hover:text-white"
            }`}
          >
            Correos Antiguos (+6m)
          </button>
          <button
            onClick={() => {
              setFilterType("heavy");
              setSelectedEmails([]);
            }}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              filterType === "heavy"
                ? "bg-white text-black shadow-md"
                : "text-white/60 hover:text-white"
            }`}
          >
            Adjuntos Pesados
          </button>
          <button
            onClick={() => {
              setFilterType("all");
              setSelectedEmails([]);
            }}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              filterType === "all"
                ? "bg-white text-black shadow-md"
                : "text-white/60 hover:text-white"
            }`}
          >
            Todos
          </button>
        </div>
      </div>

      {/* Info Warning */}
      <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 mb-6 flex items-start gap-3">
        <Info className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
        <div className="text-xs text-white/80 leading-relaxed">
          <span className="font-semibold text-orange-400">Depuración Segura:</span> Los correos que mandes a la papelera desde aquí se guardan en la carpeta <span className="font-semibold text-[#e0e0e0]">Papelera</span> de tu cuenta de Gmail durante 30 días, dándote la opción de revertir el cambio desde tu cliente de correo oficial en cualquier momento.
        </div>
      </div>

      {/* Action panel */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest font-semibold text-[#888888]">
            Candidatos identificados ({filteredEmails.length})
          </span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {filterType === "promo" && (
            <button
              onClick={selectAllPromotionsToClean}
              disabled={isProcessing}
              className="bg-white hover:bg-neutral-200 text-black text-xs font-semibold px-4 py-2 rounded-full transition-all shadow-sm flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5 text-orange-500" />
              Depurar Todas las Promociones y Alertas
            </button>
          )}

          {selectedEmails.length > 0 && (
            <button
              onClick={() => triggerBulkTrashMsg(selectedEmails)}
              disabled={isProcessing}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 ml-auto sm:ml-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Enviar Seleccionados a Papelera ({selectedEmails.length})
            </button>
          )}
        </div>
      </div>

      {/* Emails elements table */}
      {filteredEmails.length === 0 ? (
        <div className="py-12 text-center text-white/40 border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
          <Inbox className="w-10 h-10 text-white/20 mx-auto mb-2" />
          <p className="text-xs">¡Bandeja optimizada! No hay correos en esta categoría actualmente.</p>
        </div>
      ) : (
        <div className="overflow-hidden border border-white/5 rounded-2xl">
          <div className="bg-white/[0.02] px-4 py-3 border-b border-white/5 flex items-center">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-white/40 hover:text-white shrink-0 mr-4"
            >
              {selectedEmails.length === filteredEmails.length ? (
                <CheckSquare className="w-4 h-4 text-orange-400" />
              ) : (
                <Square className="w-4 h-4" />
              )}
            </button>
            <div className="grid grid-cols-12 gap-4 w-full text-[10px] uppercase tracking-widest font-semibold text-white/50">
              <span className="col-span-3">Remitente</span>
              <span className="col-span-6">Asunto y Vista previa</span>
              <span className="col-span-2">Fecha</span>
              <span className="col-span-1 text-right">Acción</span>
            </div>
          </div>

          <div className="divide-y divide-white/5 text-xs text-white/80">
            {filteredEmails.map((email) => {
              const isSelected = selectedEmails.includes(email.id);
              return (
                <div
                  key={email.id}
                  className={`px-4 py-3 flex items-center transition-all hover:bg-white/[0.02] ${
                    isSelected ? "bg-white/[0.02]" : ""
                  }`}
                >
                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={() => handleToggleEmail(email.id)}
                    className="text-white/40 hover:text-white shrink-0 mr-4"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-orange-400" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>

                  <div className="grid grid-cols-12 gap-4 w-full items-center">
                    {/* Sender */}
                    <div className="col-span-3 truncate">
                      <span className="text-xs font-semibold text-white truncate block">
                        {email.from?.replace(/<.*>/, "") || "Remitente"}
                      </span>
                      <span className="text-[10px] text-white/40 block truncate font-mono">
                        {email.from?.match(/<([^>]+)>/)?.[1] || email.from}
                      </span>
                    </div>

                    {/* Subject snippet */}
                    <div className="col-span-6">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {email.isUnread && (
                          <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0 inline-block" title="No leído"></span>
                        )}
                        <span className="text-xs font-medium text-white/90 truncate max-w-[200px] sm:max-w-xs md:max-w-md inline-block">
                          {email.subject}
                        </span>
                        {email.sizeEstimate && email.sizeEstimate > 100000 && (
                          <span className="text-[9px] bg-white/10 text-white/80 px-1.5 py-0.5 rounded font-bold font-mono">
                            {Math.round(email.sizeEstimate / 1024)} KB
                          </span>
                        )}
                        {isPromotional(email) && (
                          <span className="text-[9px] bg-orange-500/10 border border-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                            Promo
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-white/40 truncate mt-0.5">
                        {email.snippet}
                      </p>
                    </div>

                    {/* Timestamp */}
                    <div className="col-span-2 text-[10px] text-white/50 font-mono whitespace-nowrap">
                      {formatDate(email.date)}
                    </div>

                    {/* Trash single trigger */}
                    <div className="col-span-1 text-right">
                      <button
                        onClick={() => triggerSingleTrashMsg(email.id)}
                        disabled={isProcessing}
                        className="p-1.5 hover:bg-rose-500/10 text-white/40 hover:text-rose-400 rounded transition-all"
                        title="Mandar a la Papelera"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- CONFIRMATION DETAILED GMAIL DESTRUCTION MODAL --- */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#111111] rounded-3xl p-6 max-w-md w-full shadow-2xl border border-white/10 text-[#e0e0e0]">
            <div className="flex items-center gap-3 text-rose-400 mb-4">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
              <h3 className="text-lg font-light tracking-tight text-white">¿Enviar correos a la papelera?</h3>
            </div>
            
            <p className="text-white/70 text-xs leading-relaxed mb-5">
              Confirmación de seguridad requerida para triturar correos electrónicos:
              <br className="mb-2" />
              Estás a punto de mover a la Papelera{" "}
              <strong>
                {emailToTrash
                  ? "el correo electrónico seleccionado"
                  : `${bulkTrashList.length} correos electrónicos`}
              </strong>. 
              <br className="mb-2" />
              Se almacenarán en la papelera oficial de Gmail por 30 días antes de su eliminación permanente.
            </p>

            <div className="flex justify-end gap-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 bg-white/5 text-white rounded-xl hover:bg-white/10 transition-all font-semibold"
              >
                No, Esperar
              </button>
              <button
                type="button"
                onClick={executeConfirmTrash}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all font-semibold shadow-sm"
              >
                Sí, Enviar a Papelera
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
