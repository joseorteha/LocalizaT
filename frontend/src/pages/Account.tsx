import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, KeyRound, MailCheck } from "lucide-react";
import { api } from "../api";
import { useApp } from "../context";
import { useAction } from "../hooks/useAction";
import { Button, EmptyState, ErrorBox, PageIntro } from "../components/ui";

// Llega desde el enlace del correo «Cambia tu contraseña».
export function ResetPassword() {
  const [params] = useSearchParams();
  const uid = params.get("uid") ?? "";
  const token = params.get("token") ?? "";
  const { busy, error, setError, run } = useAction();
  const [visible, setVisible] = useState(false);
  const { updateUser, toast } = useApp();
  const navigate = useNavigate();
  if (!uid || !token)
    return (
      <div className="page-container">
        <EmptyState
          category="credential"
          title="Este enlace está incompleto"
          text="Abre el enlace completo desde el correo, o pide uno nuevo desde «Entrar › ¿Olvidaste tu contraseña?»."
        />
      </div>
    );
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password"));
    if (password !== String(data.get("confirmation"))) {
      setError("Las contraseñas deben coincidir.");
      return;
    }
    run(async () => {
      const result = await api.passwordResetConfirm(uid, token, password);
      updateUser(result.user);
      toast("Listo: cambiaste tu contraseña y ya entraste a tu cuenta.");
      navigate("/mi-espacio", { replace: true });
    });
  }
  return (
    <div className="page-container narrow-page">
      <PageIntro label="TU CUENTA" title="Elige una contraseña nueva" description="Úsala para entrar desde cualquier celular o computadora." />
      <form className="form-stack account-form" onSubmit={submit}>
        <label>
          Contraseña nueva
          <div className="password-field">
            <input name="password" type={visible ? "text" : "password"} autoComplete="new-password" minLength={8} required autoFocus />
            <button type="button" className="icon-button" onClick={() => setVisible((value) => !value)} aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}>
              {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <small>Al menos 8 caracteres y no solo números.</small>
        </label>
        <label>
          Confírmala
          <input name="confirmation" type={visible ? "text" : "password"} autoComplete="new-password" minLength={8} required />
        </label>
        {error && <ErrorBox message={error} />}
        <Button type="submit" busy={busy}>
          <KeyRound size={18} /> Guardar contraseña
        </Button>
      </form>
    </div>
  );
}

// Llega desde el enlace del correo «Confirma tu correo».
export function VerifyEmail() {
  const [params] = useSearchParams();
  const uid = params.get("uid") ?? "";
  const token = params.get("token") ?? "";
  const { user, updateUser } = useApp();
  const [state, setState] = useState<"working" | "done" | "error">(uid && token ? "working" : "error");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!uid || !token) return;
    let active = true;
    api
      .verifyEmail(uid, token)
      .then(() => {
        if (!active) return;
        setState("done");
        if (user) updateUser({ ...user, email_verified: true });
      })
      .catch((caught) => {
        if (!active) return;
        setState("error");
        setMessage(caught instanceof Error ? caught.message : "No pudimos confirmar tu correo.");
      });
    return () => {
      active = false;
    };
    // Solo al abrir el enlace: verificar dos veces no cambia nada.
  }, [uid, token]);
  return (
    <div className="page-container">
      {state === "working" ? (
        <p className="loading-message" aria-busy="true">Confirmando tu correo…</p>
      ) : state === "done" ? (
        <EmptyState category="document" title="¡Tu correo quedó confirmado!" text="Ahora te avisaremos por correo cuando aparezca algo parecido a lo que reportaste. Puedes apagar estos avisos en Mi espacio › Novedades.">
          <Link className="btn btn-primary" to="/mi-espacio">
            <MailCheck size={18} /> Ir a mi espacio <ArrowRight size={17} />
          </Link>
        </EmptyState>
      ) : (
        <EmptyState category="credential" title="No pudimos confirmar tu correo" text={message || "El enlace está incompleto. Ábrelo completo desde el correo."}>
          <Link className="btn btn-secondary" to="/mi-espacio">
            Pedir otro correo desde Mi espacio
          </Link>
        </EmptyState>
      )}
    </div>
  );
}
