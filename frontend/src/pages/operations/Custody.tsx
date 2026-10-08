import { useState, type FormEvent } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { api, type Inventory } from "../../api";
import { useLoad } from "../../lib";
import { useApp } from "../../context";
import { useAction } from "../../hooks/useAction";
import { Button, EmptyState, ErrorBox, Modal, Tag } from "../../components/ui";

export function Custody() {
  const load = useLoad(api.inventory);
  const points = useLoad(api.points);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [transfer, setTransfer] = useState<Inventory | null>(null);
  const { busy, error, setError, run } = useAction();
  const { user, toast } = useApp();
  const availablePoints =
    points.data?.filter(
      (point) => user?.is_staff || user?.point_ids.includes(point.id),
    ) ?? [];
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    run(async () => {
      if (transfer)
        await api.transfer(
          transfer.report_id,
          Number(data.get("point")),
          String(data.get("note")),
        );
      else
        await api.intake(
          String(data.get("folio")),
          Number(data.get("point")),
          String(data.get("note")),
        );
      toast(transfer ? "Traslado registrado." : "Recepción registrada.");
      setTransfer(null);
      setIntakeOpen(false);
      load.reload();
    });
  }
  return (
    <>
      <div className="section-action-row">
        <p>Objetos en los puntos a los que tienes acceso.</p>
        <Button
          onClick={() => {
            setIntakeOpen(true);
            setError("");
          }}
        >
          <Plus size={17} />
          Registrar recepción
        </Button>
      </div>
      {load.loading ? (
        <p>Cargando inventario…</p>
      ) : load.error ? (
        <ErrorBox message={load.error} retry={load.reload} />
      ) : !load.data?.length ? (
        <EmptyState
          title="El inventario está disponible."
          text="Los objetos recibidos en un punto aparecerán aquí, con su folio e historial de custodia."
        />
      ) : (
        <div className="case-list">
          {load.data.map((item) => (
            <article className="ops-row" key={item.report_id}>
              <div>
                <span className="tiny-label">{item.folio}</span>
                <h3>{item.description}</h3>
                <p>{item.point_name}</p>
              </div>
              <Tag value={item.status} />
              {user?.is_staff && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setTransfer(item);
                    setError("");
                  }}
                >
                  Trasladar
                  <ArrowRight size={16} />
                </Button>
              )}
            </article>
          ))}
        </div>
      )}
      <Modal
        open={intakeOpen || transfer !== null}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setIntakeOpen(false);
            setTransfer(null);
          }
        }}
        title={
          transfer
            ? "Un movimiento, con constancia."
            : "Registrar un objeto recibido."
        }
        description="Registra el movimiento únicamente después de verificar el objeto y el punto participante."
      >
        <form className="form-stack" onSubmit={submit}>
          {transfer ? (
            <p>
              <strong>{transfer.folio}</strong> · {transfer.point_name}
            </p>
          ) : (
            <label>
              Folio del hallazgo
              <input name="folio" required maxLength={15} placeholder="LT-…" />
            </label>
          )}
          <label>
            {transfer ? "Punto de destino" : "Punto que recibe"}
            <select name="point" required defaultValue="">
              <option value="" disabled>
                Selecciona un punto activo
              </option>
              {(transfer ? points.data : availablePoints)
                ?.filter((point) => point.id !== transfer?.point_id)
                .map((point) => (
                  <option key={point.id} value={point.id}>
                    {point.name} · {point.public_area}
                  </option>
                ))}
            </select>
          </label>
          {!points.loading && !points.data?.length && (
            <p className="hint">
              No hay puntos activos configurados. El equipo debe registrar y
              confirmar sus condiciones antes de recibir objetos.
            </p>
          )}
          <label>
            Constancia del movimiento
            <textarea
              name="note"
              required
              minLength={8}
              maxLength={500}
              rows={3}
              placeholder="Estado del objeto y referencia de la recepción…"
            />
          </label>
          {error && <ErrorBox message={error} />}
          <Button type="submit" busy={busy} disabled={!points.data?.length}>
            Guardar movimiento
            <ArrowRight size={17} />
          </Button>
        </form>
      </Modal>
    </>
  );
}
