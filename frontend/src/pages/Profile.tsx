import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, Eye, EyeOff, KeyRound, LogOut, MailWarning, Save, ShieldCheck, UserRound } from "lucide-react";
import { api } from "../api";
import { useApp } from "../context";
import { useAction } from "../hooks/useAction";
import { Avatar, displayName } from "../components/Avatar";
import { InstallButton } from "../components/InstallButton";
import { Button, ErrorBox, PageIntro } from "../components/ui";
import { EmailSettings } from "./dashboard/EmailSettings";
import { PushSettings } from "./dashboard/PushSettings";
import { VerifyBanner } from "./dashboard/VerifyBanner";

const CONTACTO = "joseortegahac@gmail.com";

function NameForm() {
  const { user, updateUser, toast } = useApp();
  const { busy, error, run } = useAction();
  if (!user) return null;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    run(async () => {
      const result = await api.updateProfile(String(data.get("first_name")), String(data.get("last_name")));
      updateUser(result.user);
      toast("Guardamos tu nombre.");
    });
  }
  return (
    <form className="form-stack profile-card" onSubmit={submit}>
      <h2>Tu nombre</h2>
      <p className="hint">Lo ve el equipo cuando revisa tus solicitudes. Nunca aparece en los avisos públicos.</p>
      <div className="profile-name-grid">
        <label>
          Nombre
          <input name="first_name" defaultValue={user.first_name} autoComplete="given-name" maxLength={150} required />
        </label>
        <label>
          Apellidos
          <input name="last_name" defaultValue={user.last_name} autoComplete="family-name" maxLength={150} />
        </label>
      </div>
      {error && <ErrorBox message={error} />}
      <Button type="submit" variant="secondary" busy={busy}>
        <Save size={17} /> Guardar nombre
      </Button>
    </form>
  );
}

function PasswordForm() {
  const { user, updateUser, toast } = useApp();
  const { busy, error, setError, run } = useAction();
  const [visible, setVisible] = useState(false);
  if (!user) return null;
  const creating = !user.has_password;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const password = String(data.get("password"));
    if (password !== String(data.get("confirmation"))) {
      setError("Las contraseñas nuevas deben coincidir.");
      return;
    }
    run(async () => {
      const result = await api.changePassword(String(data.get("current") ?? ""), password);
      updateUser(result.user);
      form.reset();
      toast(creating ? "Creaste tu contraseña. Ya puedes entrar también con tu correo." : "Cambiaste tu contraseña.");
    });
  }
  return (
    <form className="form-stack profile-card" onSubmit={submit}>
      <h2>{creating ? "Crear una contraseña" : "Cambiar contraseña"}</h2>
      <p className="hint">
        {creating
          ? "Entras con Google y no necesitas contraseña. Si quieres, crea una para entrar también con tu correo."
          : "Usa al menos 8 caracteres y no solo números. Mejor una que no uses en otro lugar."}
      </p>
      {!creating && (
        <label>
          Contraseña actual
          <input name="current" type={visible ? "text" : "password"} autoComplete="current-password" required />
        </label>
      )}
      <label>
        Contraseña nueva
        <div className="password-field">
          <input name="password" type={visible ? "text" : "password"} autoComplete="new-password" minLength={8} required />
          <button type="button" className="icon-button" onClick={() => setVisible((value) => !value)} aria-label={visible ? "Ocultar contraseñas" : "Mostrar contraseñas"}>
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </label>
      <label>
        Confírmala
        <input name="confirmation" type={visible ? "text" : "password"} autoComplete="new-password" minLength={8} required />
      </label>
      {error && <ErrorBox message={error} />}
      <Button type="submit" variant="secondary" busy={busy}>
        <KeyRound size={17} /> {creating ? "Crear contraseña" : "Cambiar contraseña"}
      </Button>
    </form>
  );
}

export function Profile() {
  const { user, signOut } = useApp();
  if (!user) return null;
  const since = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(new Date(user.date_joined));
  return (
    <div className="page-container profile-page">
      <PageIntro label="TU CUENTA" title="Mi perfil" />
      <VerifyBanner />
      <section className="profile-hero" aria-label="Tu cuenta">
        <Avatar user={user} size={96} />
        <div className="profile-hero-copy">
          <h2>{displayName(user)}</h2>
          <p>{user.email}</p>
          <div className="profile-chips">
            {user.email_verified ? (
              <span className="profile-chip is-ok"><BadgeCheck size={15} /> Correo verificado</span>
            ) : (
              <span className="profile-chip is-wait"><MailWarning size={15} /> Falta confirmar el correo</span>
            )}
            <span className="profile-chip">
              <UserRound size={15} /> {user.has_password ? "Correo y contraseña" : "Entras con Google"}
            </span>
            {user.is_staff && <span className="profile-chip is-team"><ShieldCheck size={15} /> Equipo de LocalizaT</span>}
            <span className="profile-chip">Desde {since}</span>
          </div>
        </div>
        <div className="profile-hero-links">
          <Link className="btn btn-primary" to="/mi-espacio">
            Mi espacio <ArrowRight size={17} />
          </Link>
          {(user.is_staff || user.is_point_member) && (
            <Link className="btn btn-secondary" to="/operacion">
              Panel del equipo
            </Link>
          )}
        </div>
      </section>

      <div className="profile-grid">
        <NameForm />
        <section className="profile-card profile-notices" aria-label="Avisos">
          <h2>Avisos</h2>
          <p className="hint">Elige cómo quieres enterarte si aparece algo parecido a lo que reportaste.</p>
          <EmailSettings />
          <PushSettings />
        </section>
        <PasswordForm />
        <section className="profile-card" aria-label="Tu información">
          <h2>Tu información</h2>
          <p className="hint">
            Tus reportes, tu detalle secreto y tus fotos son privados. Lee el{" "}
            <Link className="text-link" to="/privacidad">aviso de privacidad</Link> para saber quién ve qué.
          </p>
          <p className="hint">
            ¿Quieres borrar tu cuenta y tus datos? Escríbenos desde este correo a{" "}
            <a className="text-link" href={`mailto:${CONTACTO}?subject=${encodeURIComponent("Borrar mi cuenta de LocalizaT")}`}>{CONTACTO}</a>.
          </p>
          <InstallButton variant="card" />
          <Button variant="ghost" className="profile-signout" onClick={signOut}>
            <LogOut size={17} /> Cerrar sesión
          </Button>
        </section>
      </div>
    </div>
  );
}
