import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { PageIntro } from "../components/ui";

const CONTACTO = "joseortegahac@gmail.com";

export function Privacy() {
  return (
    <div className="page-container legal-page">
      <Link className="back-link" to="/">
        <ArrowLeft size={16} />
        Volver al inicio
      </Link>
      <PageIntro
        label="TUS DATOS"
        title="Aviso de privacidad"
        description="LocalizaT es un proyecto comunitario en desarrollo para reportar y buscar objetos perdidos y encontrados en la Sierra de Zongolica. Aquí explicamos qué información usa la plataforma y quién puede verla."
      />
      <article className="legal-prose">
        <p className="legal-updated">Última actualización: 8 de octubre de 2026.</p>

        <h2>Qué información guardamos</h2>
        <ul>
          <li>
            <strong>Tu correo.</strong> Para identificar tu cuenta y responder a
            solicitudes relacionadas con ella.
            Si entras con Google, recibimos tu correo y tu nombre; nunca vemos tu
            contraseña de Google.
          </li>
          <li>
            <strong>Lo que escribes en un reporte.</strong> La descripción del
            objeto, el municipio o zona, la fecha y el tipo de objeto.
          </li>
          <li>
            <strong>Tu detalle secreto</strong> (cuando reportas una pérdida). Se
            guarda aparte, <strong>nunca se publica</strong> y solo lo usa el
            equipo para comprobar que el objeto es tuyo.
          </li>
          <li>
            <strong>Datos de uso necesarios para el servicio,</strong> como la
            sesión que mantiene tu inicio de sesión activo y, si activas avisos,
            la suscripción de este navegador.
          </li>
        </ul>

        <h2>Para qué los usamos</h2>
        <ul>
          <li>Comparar reportes y mostrarte posibles coincidencias.</li>
          <li>Coordinar la devolución y comprobar quién es la persona dueña.</li>
          <li>Mantener tu cuenta y tu sesión.</li>
        </ul>
        <p>
          No usamos tus reportes para publicidad. Para operar la plataforma
          utilizamos servicios de alojamiento y, si tú lo eliges, el acceso con
          Google y los avisos del navegador.
        </p>

        <h2>Qué es público y qué es privado</h2>
        <p>
          <strong>Público:</strong> únicamente si decides compartir un aviso. El
          aviso básico muestra el tipo de objeto y una zona general; si propones
          un texto más detallado, el equipo lo revisa antes de publicarlo. La
          fecha también aparece en el aviso. Los dibujos son ilustraciones.
        </p>
        <p>
          <strong>Fuera del aviso público:</strong> tu correo, la descripción
          completa del reporte, el detalle secreto y la información de una
          solicitud de devolución. El acceso se limita a las funciones
          necesarias para dar seguimiento y verificar la propiedad.
        </p>

        <h2>Inicio de sesión con Google</h2>
        <p>
          Si eliges «Continuar con Google», Google nos comparte tu correo y tu
          nombre para crear o reconocer tu cuenta. Ese uso también se rige por la
          política de privacidad de Google. Puedes entrar con correo y contraseña
          si prefieres no usar Google.
        </p>

        <h2>Avisos en tu teléfono</h2>
        <p>
          Si activas los avisos en un dispositivo, guardamos la suscripción de
          ese navegador para enviar posibles coincidencias. Los avisos pasan por
          el servicio de notificaciones del navegador. Puedes desactivarlos en
          «Mi espacio» desde ese mismo dispositivo.
        </p>

        <h2>Dónde se guardan</h2>
        <p>
          En el sitio público, la conexión usa HTTPS. Los datos de la plataforma
          se alojan en servicios de infraestructura que usamos para operarla.
          Limitamos el acceso a los reportes privados al equipo autorizado.
        </p>

        <h2>Por cuánto tiempo</h2>
        <p>
          Conservamos la información necesaria para dar seguimiento a tu cuenta,
          reportes y solicitudes. Si ya no quieres usar LocalizaT, puedes pedir
          la cancelación de tus datos por correo; revisaremos la solicitud y te
          diremos qué información debe conservarse por obligaciones aplicables.
        </p>

        <h2>Tus derechos</h2>
        <p>
          Puedes solicitar acceso, rectificación, cancelación u oposición al uso
          de tus datos. Escríbenos desde el correo de tu cuenta a{" "}
          <a href={`mailto:${CONTACTO}`}>{CONTACTO}</a> e indica qué necesitas;
          verificaremos que la cuenta sea tuya antes de responder.
        </p>

        <h2>Cambios a este aviso</h2>
        <p>
          Si cambiamos cómo usamos los datos, actualizaremos esta página y su
          fecha. Los cambios importantes se comunicarán en la plataforma.
        </p>

        <h2>Contacto</h2>
        <p>
          ¿Dudas sobre tus datos? Escríbenos a{" "}
          <a href={`mailto:${CONTACTO}`}>{CONTACTO}</a>.
        </p>

        <p className="legal-see-also">
          Lee también nuestras <Link to="/terminos">Condiciones del servicio</Link>.
        </p>
      </article>
    </div>
  );
}
