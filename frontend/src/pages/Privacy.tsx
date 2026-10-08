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
        description="LocalizaT es un proyecto comunitario, sin fines de lucro, para reportar y buscar objetos perdidos y encontrados en la Sierra de Zongolica. Aquí te contamos, en palabras claras, qué datos te pedimos y cómo los cuidamos."
      />
      <article className="legal-prose">
        <p className="legal-updated">Última actualización: 8 de octubre de 2026.</p>

        <h2>Qué información guardamos</h2>
        <ul>
          <li>
            <strong>Tu correo.</strong> Para crear tu cuenta y poder avisarte.
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
            <strong>Datos mínimos para que la app funcione,</strong> como la
            sesión que mantiene tu inicio de sesión activo.
          </li>
        </ul>

        <h2>Para qué los usamos</h2>
        <ul>
          <li>Comparar tu reporte con los demás y avisarte si aparece algo parecido.</li>
          <li>Coordinar la devolución y comprobar quién es la persona dueña.</li>
          <li>Mantener tu cuenta y tu sesión.</li>
        </ul>
        <p>
          No vendemos tus datos, no los usamos para publicidad ni los
          compartimos con nadie fuera de lo necesario para que LocalizaT
          funcione.
        </p>

        <h2>Qué es público y qué es privado</h2>
        <p>
          <strong>Público:</strong> solo el aviso que tú decides compartir, con
          datos generales (tipo de objeto, zona general y fecha). Los dibujos son
          de referencia, no fotos reales.
        </p>
        <p>
          <strong>Privado:</strong> tu correo, tu descripción completa, tu detalle
          secreto y tu contacto. Nada de eso se muestra a la comunidad.
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
          Si activas las notificaciones, usamos una suscripción de tu navegador
          para avisarte cuando haya una posible coincidencia. Puedes desactivarlas
          cuando quieras desde «Mi espacio».
        </p>

        <h2>Dónde se guardan</h2>
        <p>
          Tus datos viajan siempre por una conexión segura (HTTPS) y se guardan en
          servidores de nube que usamos solo para operar LocalizaT. Aplicamos
          medidas razonables para protegerlos.
        </p>

        <h2>Por cuánto tiempo</h2>
        <p>
          Guardamos tu información mientras tengas cuenta o un reporte activo.
          Puedes pedirnos que borremos tu cuenta y tus datos cuando quieras.
        </p>

        <h2>Tus derechos</h2>
        <p>
          Puedes pedirnos acceder, corregir o borrar tu información. Escríbenos a{" "}
          <a href={`mailto:${CONTACTO}`}>{CONTACTO}</a> y te ayudamos.
        </p>

        <h2>Cambios a este aviso</h2>
        <p>
          Si cambiamos algo importante, actualizaremos esta página y la fecha de
          arriba. Al seguir usando LocalizaT, aceptas la versión vigente.
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
