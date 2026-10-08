import { useEffect, useState } from "react";
import { CheckCheck } from "lucide-react";
import { api } from "../../api";
import { claimProgress } from "../../domain";
import { categoryName, useLoad } from "../../lib";
import { useApp } from "../../context";
import { useAction } from "../../hooks/useAction";
import { Button, ErrorBox, Modal, NextStep } from "../../components/ui";

export function ClaimDialog({
  claimId,
  onClose,
  onUpdated,
}: {
  claimId: number | null;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const load = useLoad(
    () => (claimId ? api.claim(claimId) : Promise.resolve(null)),
    String(claimId),
  );
  const [accepted, setAccepted] = useState(false);
  const { busy, error, setError, run } = useAction();
  const { toast } = useApp();
  const claim = load.data;
  useEffect(() => {
    setAccepted(false);
    setError("");
  }, [claimId, setError]);
  function confirm() {
    if (!claim?.handover) return;
    run(async () => {
      await api.confirmHandover(claim.handover!.id);
      toast("¡Qué bueno que lo recuperaste! Caso cerrado.");
      load.reload();
      onUpdated();
    });
  }
  return (
    <Modal
      open={claimId !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      title={
        claim
          ? claim.found_summary.public_summary ||
            categoryName(claim.found_summary.category)
          : "Tu solicitud de devolución"
      }
      description="Aquí ves el estado de tu solicitud y la respuesta del equipo."
    >
      {load.loading ? (
        <p className="loading-message">Cargando tu caso…</p>
      ) : load.error ? (
        <ErrorBox message={load.error} retry={load.reload} />
      ) : (
        claim && (
          <div className="form-stack">
            <NextStep progress={claimProgress(claim)} />
            {claim.decision_reason && (
              <div className="private-evidence">
                <span className="tiny-label">LO QUE RESPONDIÓ EL EQUIPO</span>
                <p>{claim.decision_reason}</p>
              </div>
            )}
            <div>
              <span className="tiny-label">TU DETALLE SECRETO</span>
              <p>{claim.evidence}</p>
            </div>
            {claim.handover?.status === "pending" && (
              <>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(event) => setAccepted(event.target.checked)}
                  />
                  Ya tengo el objeto y revisé que es mío.
                </label>
                {error && <ErrorBox message={error} />}
                <Button disabled={!accepted} busy={busy} onClick={confirm}>
                  <CheckCheck size={18} />
                  Confirmar que lo recibí
                </Button>
              </>
            )}
          </div>
        )
      )}
    </Modal>
  );
}
