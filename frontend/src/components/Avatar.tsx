import { useState } from "react";
import type { User } from "../api";

// Las fotos de Google traen su tamaño en la dirección («=s96-c»): se pide una
// más grande cuando el avatar se ve en grande, para que no salga borrosa.
function sized(url: string, size: number) {
  const pixels = Math.min(512, Math.ceil(size * 2));
  return /=s\d+(-c)?$/.test(url) ? url.replace(/=s\d+(-c)?$/, `=s${pixels}-c`) : url;
}

export const displayName = (user: User) =>
  [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email.split("@")[0];

// Foto de perfil (la de Google) o, si no hay o no carga, la inicial del nombre.
export function Avatar({ user, size = 34 }: { user: User; size?: number }) {
  const [broken, setBroken] = useState(false);
  const initial = (user.first_name || user.email)[0]?.toUpperCase() ?? "?";
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }} aria-hidden="true">
      {user.avatar_url && !broken ? (
        // Sin «referrer»: así Google entrega la foto aunque la página esté en otro dominio.
        <img src={sized(user.avatar_url, size)} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      ) : (
        initial
      )}
    </span>
  );
}
