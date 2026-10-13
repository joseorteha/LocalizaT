import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  Check,
  Compass,
  Eye,
  EyeOff,
  LogOut,
  Menu,
  Moon,
  Plus,
  Sun,
  UserRound,
  WifiOff,
  X,
} from "lucide-react";
import { api, type User } from "./api";
import { GoogleButton } from "./GoogleButton";
import { FeedbackButton } from "./components/FeedbackButton";
import { InstallButton } from "./components/InstallButton";
import { Avatar, displayName } from "./components/Avatar";
import { nahuatlReady, useLanguage, useT } from "./i18n";
import { flushReports } from "./outbox";
import { Privacy } from "./pages/Privacy";
import { Terms } from "./pages/Terms";
import { SessionContext, useApp } from "./context";
import { useAction } from "./hooks/useAction";
import { useOnline, usePrefersReducedMotion } from "./lib";
import { useTheme } from "./theme";
import { Button, EmptyState, ErrorBox, Modal } from "./components/ui";
const Home = lazy(() =>
  import("./pages/Home").then((module) => ({ default: module.Home })),
);
const Explore = lazy(() =>
  import("./pages/explore/Explore").then((module) => ({
    default: module.Explore,
  })),
);
const PublicDetail = lazy(() =>
  import("./pages/explore/PublicDetail").then((module) => ({
    default: module.PublicDetail,
  })),
);
const Dashboard = lazy(() =>
  import("./pages/dashboard/Dashboard").then((module) => ({
    default: module.Dashboard,
  })),
);
const OwnReportDetail = lazy(() =>
  import("./pages/dashboard/OwnReportDetail").then((module) => ({
    default: module.OwnReportDetail,
  })),
);
const ReportWizard = lazy(() =>
  import("./pages/ReportWizard").then((module) => ({
    default: module.ReportWizard,
  })),
);
const ResetPassword = lazy(() =>
  import("./pages/Account").then((module) => ({
    default: module.ResetPassword,
  })),
);
const VerifyEmail = lazy(() =>
  import("./pages/Account").then((module) => ({
    default: module.VerifyEmail,
  })),
);
const Profile = lazy(() =>
  import("./pages/Profile").then((module) => ({
    default: module.Profile,
  })),
);
const Operations = lazy(() =>
  import("./pages/operations/Operations").then((module) => ({
    default: module.Operations,
  })),
);

function Protected({
  children,
  operator = false,
}: {
  children: ReactNode;
  operator?: boolean;
}) {
  const { user, sessionLoading, openAuth } = useApp();
  const location = useLocation();
  if (sessionLoading)
    return (
      <div className="page-container loading-page" aria-busy="true">
        Preparando tu espacio…
      </div>
    );
  if (!user)
    return (
      <div className="page-container">
        <EmptyState
          title="Necesitas una cuenta"
          text="Con una cuenta puedes guardar reportes, consultar posibles coincidencias y seguir cada solicitud. Puedes crearla con correo y contraseña o continuar con Google."
        >
          <div className="empty-actions">
            <Button
              onClick={() =>
                openAuth(location.pathname + location.search, "signup")
              }
            >
              Crear mi cuenta <ArrowRight size={17} />
            </Button>
            <Button
              variant="secondary"
              onClick={() => openAuth(location.pathname + location.search)}
            >
              Ya tengo cuenta
            </Button>
          </div>
        </EmptyState>
      </div>
    );
  if (operator && !user.is_staff && !user.is_point_member)
    return (
      <div className="page-container">
        <EmptyState
          title="Un espacio para el equipo"
          text="Este panel requiere acceso de operación. Puedes seguir tus reportes en Mi espacio."
        >
          <Link className="btn btn-primary" to="/mi-espacio">
            Ir a mi espacio
          </Link>
        </EmptyState>
      </div>
    );
  return children;
}

type AuthMode = "login" | "signup" | "reset";

function AuthDialog({
  mode,
  setMode,
  onClose,
  onSuccess,
}: {
  mode: AuthMode | null;
  setMode: (mode: AuthMode) => void;
  onClose: () => void;
  onSuccess: (user: User, mode: "login" | "signup") => void;
}) {
  const { busy, error, setError, run } = useAction();
  const [visible, setVisible] = useState(false);
  const [resetSent, setResetSent] = useState("");
  useEffect(() => {
    setError("");
    setVisible(false);
    setResetSent("");
  }, [mode, setError]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (mode === "reset") {
      const email = String(data.get("email")).trim();
      run(async () => {
        await api.passwordReset(email);
        setResetSent(email);
      });
      return;
    }
    const password = String(data.get("password"));
    if (mode === "signup" && password !== String(data.get("confirmation"))) {
      setError("Las contraseñas deben coincidir.");
      return;
    }
    const current = mode === "signup" ? "signup" : "login";
    run(async () => {
      const result = await api[current](String(data.get("email")), password);
      onSuccess(result.user, current);
    });
  }
  const onGoogle = useCallback(
    (credential: string) =>
      run(async () => {
        const result = await api.googleLogin(credential);
        onSuccess(result.user, mode === "signup" ? "signup" : "login");
      }),
    [run, onSuccess, mode],
  );
  if (mode === "reset")
    return (
      <Modal
        open
        onOpenChange={(open) => {
          if (!open && !busy) onClose();
        }}
        title="Recupera tu cuenta"
        description="Escribe el correo de tu cuenta y te mandamos un enlace para elegir una contraseña nueva."
      >
        <div className="auth-mark">
          <img src="/isotipo.svg" alt="" />
        </div>
        {resetSent ? (
          <div className="form-stack">
            <p className="reset-sent" role="status">
              Si hay una cuenta con <strong>{resetSent}</strong>, en unos minutos
              te llegará un correo con el enlace. Revisa también la carpeta de
              spam. El enlace sirve durante 2 horas.
            </p>
            <Button variant="secondary" onClick={() => setMode("login")}>
              Volver a entrar
            </Button>
          </div>
        ) : (
          <form className="form-stack" onSubmit={submit} key="reset">
            <label>
              Correo electrónico
              <input name="email" type="email" autoFocus autoComplete="email" placeholder="tu@correo.com" required maxLength={254} />
            </label>
            {error && <ErrorBox message={error} />}
            <Button type="submit" busy={busy}>
              Enviarme el enlace <ArrowRight size={17} />
            </Button>
            <p className="hint">
              ¿Entraste con Google? No necesitas contraseña: usa «Continuar con Google».
            </p>
          </form>
        )}
        <p className="auth-switch">
          <button type="button" onClick={() => setMode("login")}>
            Ya la recordé, quiero entrar
          </button>
        </p>
      </Modal>
    );
  return (
    <Modal
      open={mode !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      title={mode === "signup" ? "Crear mi cuenta" : "Entrar a mi cuenta"}
      description={
        mode === "signup"
          ? "Crea tu cuenta con correo y contraseña o continúa con Google. Así podrás seguir tus reportes y solicitudes."
          : "Entra con tu correo y contraseña, o continúa con Google."
      }
    >
      <div className="auth-mark">
        <img src="/isotipo.svg" alt="" />
      </div>
      <form className="form-stack" onSubmit={submit} key={mode}>
        <label>
          Correo electrónico
          <input
            name="email"
            type="email"
            autoFocus
            autoComplete="email"
            placeholder="tu@correo.com"
            required
            maxLength={254}
          />
        </label>
        <label>
          Contraseña
          <div className="password-field">
            <input
              name="password"
              type={visible ? "text" : "password"}
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              minLength={8}
              required
            />
            <button
              type="button"
              className="icon-button"
              onClick={() => setVisible((value) => !value)}
              aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {mode === "signup" && (
            <small>
              Al menos 8 caracteres y no solo números. Mejor una que no uses en
              otro lugar.
            </small>
          )}
          {mode === "login" && (
            <button type="button" className="text-link forgot-link" onClick={() => setMode("reset")}>
              ¿Olvidaste tu contraseña?
            </button>
          )}
        </label>
        {mode === "signup" && (
          <label>
            Confirma tu contraseña
            <input
              name="confirmation"
              type={visible ? "text" : "password"}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
        )}
        {error && <ErrorBox message={error} />}
        <Button type="submit" busy={busy}>
          {mode === "signup" ? "Crear mi cuenta" : "Entrar"}
          <ArrowRight size={17} />
        </Button>
      </form>
      <GoogleButton onToken={onGoogle} onError={setError} />
      <p className="auth-switch">
        {mode === "signup" ? "¿Ya tienes cuenta?" : "¿No tienes cuenta?"}{" "}
        <button
          type="button"
          onClick={() => setMode(mode === "signup" ? "login" : "signup")}
        >
          {mode === "signup" ? "Entra aquí" : "Créala aquí"}
        </button>
      </p>
    </Modal>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [authNext, setAuthNext] = useState("/mi-espacio");
  const [notice, setNotice] = useState("");
  const [noticeKind, setNoticeKind] = useState<"success" | "error">("success");
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [unreadVersion, setUnreadVersion] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const reduced = usePrefersReducedMotion();
  const online = useOnline();
  const { theme, toggle: toggleTheme } = useTheme();
  const t = useT();
  const { lang, setLang } = useLanguage();
  const themeLabel = theme === "dark" ? "Usar modo claro" : "Usar modo oscuro";
  const toast = (message: string, kind: "success" | "error" = "success") => {
    setNoticeKind(kind);
    setNotice(message);
  };
  const openAuth = (
    next = "/mi-espacio",
    mode: "login" | "signup" = "login",
  ) => {
    setAuthNext(next);
    setAuthMode(mode);
    setMenuOpen(false);
  };
  useEffect(() => {
    api
      .me()
      .then((result) => setUser(result.user))
      .catch(() =>
        toast(
          "No pudimos conectar con tu sesión. Puedes volver a intentar entrar.",
          "error",
        ),
      )
      .finally(() => setSessionLoading(false));
  }, []);
  useEffect(() => {
    // Se vuelve a contar al cambiar de pantalla: así la campana se mantiene al día
    // sin estar consultando al servidor todo el tiempo.
    if (!user) {
      setUnread(0);
      return;
    }
    let active = true;
    api
      .notices()
      .then((items) => {
        if (active) setUnread(items.filter((item) => !item.read_at).length);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user, location.pathname, unreadVersion]);
  useEffect(() => {
    // Reportes guardados sin señal: se envían solos al volver la conexión
    // (y al abrir la app), siempre que haya una sesión abierta.
    if (!user || !online) return;
    let active = true;
    flushReports().then(({ sent, rejected }) => {
      if (!active) return;
      if (sent.length)
        toast(
          sent.length === 1
            ? `Volvió la señal: enviamos tu reporte ${sent[0].folio}.`
            : `Volvió la señal: enviamos ${sent.length} reportes que tenías pendientes.`,
        );
      if (rejected.length)
        toast(`No pudimos enviar un reporte guardado: ${rejected[0]} Vuelve a hacerlo, por favor.`, "error");
    });
    return () => {
      active = false;
    };
  }, [user, online]);
  useEffect(() => {
    // Las confirmaciones se van solas; los errores se quedan hasta cerrarlos,
    // para que nadie se pierda un problema por leer despacio.
    if (!notice || noticeKind === "error") return;
    const timer = window.setTimeout(() => setNotice(""), 7000);
    return () => clearTimeout(timer);
  }, [notice, noticeKind]);
  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
    const titles: Record<string, string> = {
      "/": "Lo encontrado puede volver",
      "/explorar": "Explorar avisos",
      "/mi-espacio": "Mi espacio",
      "/reportar": "Nuevo reporte",
      "/operacion": "Panel del equipo",
      "/restablecer": "Cambiar contraseña",
      "/verificar": "Confirmar correo",
      "/perfil": "Mi perfil",
    };
    const title =
      titles[location.pathname] ??
      (location.pathname.startsWith("/avisos/")
        ? "Aviso"
        : location.pathname.startsWith("/mis-reportes/")
          ? "Mi caso"
          : "Página no encontrada");
    document.title = `${title} · LocalizaT`;
    document.body.classList.toggle("is-focused-task", location.pathname === "/reportar");
  }, [location.pathname]);
  async function signOut() {
    try {
      const { disablePush } = await import("./push");
      await disablePush().catch(() => {});
      await api.logout();
      setUser(null);
      navigate("/");
      toast("Cerraste tu sesión. Hasta pronto.");
    } catch (caught) {
      toast(
        caught instanceof Error
          ? caught.message
          : "No pudimos cerrar la sesión.",
        "error",
      );
    }
  }
  return (
    <SessionContext.Provider
      value={{
        user,
        sessionLoading,
        openAuth,
        toast,
        unread,
        refreshUnread: () => setUnreadVersion((value) => value + 1),
        updateUser: setUser,
        signOut,
      }}
    >
      <a className="skip-link" href="#main">
        Saltar al contenido
      </a>
      {!online && (
        <div className="offline-banner" role="status">
          <WifiOff size={18} />
          <span>
            Sin conexión. Lo que escribas en un reporte se guarda en este
            celular y puedes dejarlo listo para que se envíe solo cuando
            vuelva la señal.
          </span>
        </div>
      )}
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand-link" to="/" aria-label="LocalizaT, inicio" viewTransition>
            {/* En oscuro se usa la versión clara del logo. */}
            <img className="logo-light" src="/localizat-logo.svg" alt="LocalizaT" />
            <img className="logo-dark" src="/localizat-logo-claro.svg" alt="" aria-hidden="true" />
          </Link>
          <nav className="desktop-nav" aria-label="Navegación principal">
            <NavLink to="/" end viewTransition>
              {t("nav.home")}
            </NavLink>
            <NavLink to="/explorar" viewTransition>{t("nav.explore")}</NavLink>
            {user && <NavLink to="/mi-espacio" viewTransition>{t("nav.space")}</NavLink>}
            <Link
              to="/#como-funciona"
              onClick={(event) => {
                if (location.pathname === "/") {
                  event.preventDefault();
                  document.getElementById("como-funciona")?.scrollIntoView({
                    behavior: reduced ? "instant" : "smooth",
                  });
                }
              }}
            >
              {t("nav.how")}
            </Link>
          </nav>
          <div className="header-actions">
            <button
              type="button"
              className="icon-button theme-toggle"
              onClick={toggleTheme}
              aria-label={themeLabel}
              title={themeLabel}
            >
              {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            {user ? (
              <>
                <Link
                  to="/mi-espacio?section=alerts"
                  className="icon-button notification-nav"
                  aria-label={
                    unread ? `Novedades: ${unread} sin leer` : "Novedades"
                  }
                >
                  <Bell size={20} />
                  {unread > 0 && (
                    <span className="bell-count" aria-hidden="true">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </Link>
                <Link to="/perfil" className="account-button" aria-label="Mi perfil" title="Mi perfil">
                  <Avatar user={user} />
                  <span>{user.first_name || displayName(user)}</span>
                </Link>
                <button
                  className="icon-button logout-nav"
                  onClick={signOut}
                  aria-label="Cerrar sesión"
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <button className="login-link" onClick={() => openAuth()}>
                {t("nav.login")} <ArrowRight size={16} />
              </button>
            )}
            <Link to="/reportar" className="btn btn-primary header-report">
              <Plus size={17} />
              {t("nav.create")}
            </Link>
            <button
              className="icon-button mobile-menu-toggle"
              aria-expanded={menuOpen}
              aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
              onClick={() => setMenuOpen((value) => !value)}
            >
              {menuOpen ? <X size={23} /> : <Menu size={23} />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="mobile-menu" aria-label="Navegación móvil">
            <Link to="/">{t("nav.home")}</Link>
            <Link to="/explorar">{t("nav.explore")}</Link>
            <Link to="/mi-espacio">{t("nav.space")}</Link>
            {user && <Link to="/perfil">Mi perfil</Link>}
            {user && (user.is_staff || user.is_point_member) && (
              <Link to="/operacion">Panel del equipo</Link>
            )}
            <button onClick={toggleTheme}>
              {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
              {themeLabel}
            </button>
            <InstallButton />
            <FeedbackButton variant="menu" />
            {user && <button onClick={signOut}>Cerrar sesión</button>}
          </nav>
        )}
      </header>
      <main id="main" tabIndex={-1}>
        <Suspense
          fallback={
            <div className="page-container loading-page">
              Preparando el camino…
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/explorar" element={<Explore />} />
            <Route path="/avisos/:id" element={<PublicDetail />} />
            <Route
              path="/mi-espacio"
              element={
                <Protected>
                  <Dashboard />
                </Protected>
              }
            />
            <Route path="/reportar" element={<ReportWizard />} />
            <Route
              path="/perfil"
              element={
                <Protected>
                  <Profile />
                </Protected>
              }
            />
            <Route path="/privacidad" element={<Privacy />} />
            <Route path="/terminos" element={<Terms />} />
            <Route path="/restablecer" element={<ResetPassword />} />
            <Route path="/verificar" element={<VerifyEmail />} />
            <Route
              path="/mis-reportes/:id"
              element={
                <Protected>
                  <OwnReportDetail />
                </Protected>
              }
            />
            <Route
              path="/operacion"
              element={
                <Protected operator>
                  <Operations />
                </Protected>
              }
            />
            <Route
              path="*"
              element={
                <div className="page-container">
                  <EmptyState
                    title="Este camino no tiene un aviso"
                    text="La página pudo cambiar o el aviso ya no está disponible."
                  >
                    <Link className="btn btn-primary" to="/explorar">
                      Explorar avisos <ArrowRight size={17} />
                    </Link>
                  </EmptyState>
                </div>
              }
            />
          </Routes>
        </Suspense>
      </main>
      <footer className="site-footer">
        <div className="footer-top">
          <Link to="/" className="footer-logo">
            <img src="/localizat-logo-claro.svg" alt="LocalizaT" />
          </Link>
          <p>
            {t("footer.tagline")}
            <br />
            <span>{t("footer.community")}</span>
          </p>
          <Link to="/reportar" className="footer-cta">
            {t("footer.cta")} <ArrowRight size={22} />
          </Link>
        </div>
        <div className="footer-bottom">
          <span>Sierra de Zongolica · Veracruz, México</span>
          <div>
            <Link to="/explorar">Avisos</Link>
            <Link to="/mi-espacio">Mi espacio</Link>
            <Link to="/privacidad">Privacidad</Link>
            <Link to="/terminos">Términos</Link>
            {user && (user.is_staff || user.is_point_member) && (
              <Link to="/operacion">Panel del equipo</Link>
            )}
            <FeedbackButton />
            <InstallButton variant="footer" />
            {nahuatlReady && (
              <button
                type="button"
                className="footer-language"
                onClick={() => setLang(lang === "es" ? "nah" : "es")}
                aria-label={t("language.label")}
              >
                {lang === "es" ? "Nāhuatl" : "Español"}
              </button>
            )}
          </div>
          <span>Hecho para la Sierra de Zongolica.</span>
        </div>
      </footer>
      <nav className="bottom-nav" aria-label="Accesos rápidos">
        <NavLink to="/explorar" viewTransition>
          <Compass size={20} />
          {t("bottom.explore")}
        </NavLink>
        <NavLink to="/reportar" className="bottom-create" viewTransition>
          <Plus size={23} />
          {t("bottom.report")}
        </NavLink>
        <NavLink to="/mi-espacio" viewTransition>
          <UserRound size={20} />
          {t("nav.space")}
        </NavLink>
      </nav>
      {location.pathname !== "/reportar" && <FeedbackButton variant="floating" />}
      <AuthDialog
        mode={authMode}
        setMode={setAuthMode}
        onClose={() => setAuthMode(null)}
        onSuccess={(signedIn, mode) => {
          setUser(signedIn);
          setAuthMode(null);
          navigate(authNext);
          toast(
            mode === "signup"
              ? signedIn.email_verified
                ? "Tu cuenta está lista."
                : "Tu cuenta está lista. Te mandamos un correo para confirmar tu dirección."
              : "Hola de nuevo. Entraste a tu cuenta.",
          );
        }}
      />
      {notice && (
          <div
            key={notice}
            className={`toast ${noticeKind === "error" ? "toast-error" : ""}`}
            role={noticeKind === "error" ? "alert" : "status"}
          >
            {noticeKind === "error" ? (
              <AlertCircle size={18} />
            ) : (
              <Check size={18} />
            )}
            <span>{notice}</span>
            <button
              className="icon-button"
              onClick={() => setNotice("")}
              aria-label="Cerrar aviso"
            >
              <X size={17} />
            </button>
          </div>
      )}
    </SessionContext.Provider>
  );
}
