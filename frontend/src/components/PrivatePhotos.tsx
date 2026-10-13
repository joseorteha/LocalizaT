import { useRef, type ChangeEvent } from "react";
import { Camera, Trash2 } from "lucide-react";
import { api } from "../api";
import { useApp } from "../context";
import { useAction } from "../hooks/useAction";
import { useLoad } from "../lib";
import { shrinkPhoto } from "../photos";

const MAX_PHOTOS = 3;

// Fotos privadas de un reporte: las ve solo la persona dueña del reporte y el
// equipo. Las imágenes se piden a Django con la sesión (nunca hay enlace público).
export function PrivatePhotos({ reportId, editable }: { reportId: string; editable: boolean }) {
  const photos = useLoad(() => api.photos(reportId), reportId);
  const { busy, run } = useAction();
  const { toast } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const list = photos.data ?? [];
  function add(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    run(
      async () => {
        await api.uploadPhoto(reportId, await shrinkPhoto(file));
        toast("Guardamos la foto. Solo la ven tú y el equipo.");
        photos.reload();
      },
      { onError: (message) => toast(message, "error") },
    );
  }
  function remove(id: string) {
    run(
      async () => {
        await api.deletePhoto(id);
        toast("Quitaste la foto.");
        photos.reload();
      },
      { onError: (message) => toast(message, "error") },
    );
  }
  if (photos.loading && !photos.data) return null;
  if (!list.length && !editable) return null;
  return (
    <div className="photo-field">
      <p className="photo-field-label">
        Fotos privadas <small>({list.length} de {MAX_PHOTOS})</small>
      </p>
      <p className="hint">Solo las ven tú y el equipo. Nunca se publican.</p>
      <div className="photo-grid">
        {list.map((photo, index) => (
          <figure key={photo.id}>
            <a href={photo.url} target="_blank" rel="noreferrer">
              <img src={photo.url} alt={`Foto ${index + 1} del objeto`} loading="lazy" />
            </a>
            {editable && (
              <button
                type="button"
                className="icon-button photo-remove"
                disabled={busy}
                onClick={() => remove(photo.id)}
                aria-label={`Quitar la foto ${index + 1}`}
              >
                <Trash2 size={15} />
              </button>
            )}
          </figure>
        ))}
        {editable && list.length < MAX_PHOTOS && (
          <button type="button" className="photo-add" disabled={busy} onClick={() => input.current?.click()}>
            <Camera size={22} aria-hidden="true" />
            <span>{busy ? "Subiendo…" : "Agregar foto"}</span>
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={add} />
    </div>
  );
}
