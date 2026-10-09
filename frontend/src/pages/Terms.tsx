import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { PageIntro } from "../components/ui";

const CONTACTO = "joseortegahac@gmail.com";

export function Terms() {
  return (
    <div className="page-container legal-page">
      <Link className="back-link" to="/">
        <ArrowLeft size={16} />
        Volver al inicio
      </Link>
      <PageIntro
        label="LAS REGLAS"
        title="Condiciones del servicio"
        description="LocalizaT es un proyecto comunitario en desarrollo para ayudar a reportar y buscar objetos en la Sierra de Zongolica. Estas son las reglas de uso de la plataforma."
      />
      <article className="legal-prose">
        <p className="legal-updated">Última actualización: 8 de octubre de 2026.</p>

        <h2>Para qué sirve LocalizaT</h2>
        <p>
          Sirve para reportar y buscar objetos perdidos o encontrados, y para
          coordinar su devolución con el apoyo de un equipo de la comunidad. No es
          un servicio de paquetería ni una autoridad; es una herramienta para
          ayudarnos entre vecinos.
        </p>

        <h2>Cómo usarla bien</h2>
        <ul>
          <li>Da información verdadera sobre lo que perdiste o encontraste.</li>
          <li>
            Con objetos delicados (celulares, credenciales o documentos) ten más
            cuidado: no compartas contraseñas, NIP ni datos bancarios. Para esos
            casos el equipo hace una verificación más estricta antes de entregar.
          </li>
          <li>
            No publiques datos personales —tuyos o de otras personas—, ni
            teléfonos, direcciones o tu detalle secreto.
          </li>
          <li>
            No uses LocalizaT para engañar, para reclamar algo que no es tuyo ni
            para ningún fin ilegal.
          </li>
          <li>Trata a las demás personas con respeto.</li>
        </ul>

        <h2>Coincidencias y devoluciones</h2>
        <p>
          Una coincidencia es solo un parecido entre dos reportes, no una prueba
          de propiedad. Antes de coordinar una entrega, el equipo evalúa la
          solicitud y los detalles privados para decidir si procede.
        </p>
        <p>
          LocalizaT ayuda a conectar a las personas, pero no garantiza que
          recuperes un objeto ni se hace responsable de lo que ocurra en una
          entrega entre particulares. Actúa siempre con prudencia.
        </p>

        <h2>Tu cuenta</h2>
        <p>
          Cuida tu acceso y no lo compartas. Eres responsable de lo que se haga
          desde tu cuenta y de lo que publiques en ella.
        </p>

        <h2>Revisión y suspensión</h2>
        <p>
          Para cuidar a la comunidad, el equipo puede revisar, rechazar u ocultar
          avisos que no cumplan estas reglas, y suspender cuentas que hagan mal
          uso o pongan en riesgo a otras personas.
        </p>

        <h2>Sin garantías</h2>
        <p>
          LocalizaT se ofrece «tal cual», como un proyecto comunitario. Hacemos lo
          posible por mantenerlo disponible y útil, pero no podemos garantizar que
          funcione sin interrupciones ni que siempre haya un resultado.
        </p>

        <h2>Cambios</h2>
        <p>
          Podemos mejorar el servicio y actualizar estas condiciones. Si sigues
          usando LocalizaT después de un cambio, significa que lo aceptas.
        </p>

        <h2>Contacto</h2>
        <p>
          ¿Dudas o necesitas ayuda? Escríbenos a{" "}
          <a href={`mailto:${CONTACTO}`}>{CONTACTO}</a>.
        </p>

        <p className="legal-see-also">
          Lee también nuestro <Link to="/privacidad">Aviso de privacidad</Link>.
        </p>
      </article>
    </div>
  );
}
