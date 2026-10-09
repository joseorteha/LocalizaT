import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  HeartHandshake,
  Search,
  ShieldCheck,
  Sparkle,
} from "lucide-react";
import { api } from "../api";
import { useLoad, usePrefersReducedMotion } from "../lib";
import { RouteScene } from "../components/Art";
import {
  EmptyState,
  ErrorBox,
  PublicCard,
  Reveal,
  SkeletonCards,
} from "../components/ui";

export function Home() {
  const latest = useLoad(() => api.publicReports({ page_size: "3" }));
  const reduced = usePrefersReducedMotion();
  const location = useLocation();
  useEffect(() => {
    if (location.hash)
      document
        .querySelector(location.hash)
        ?.scrollIntoView({ behavior: reduced ? "instant" : "smooth" });
  }, [location.hash, reduced]);
  const steps = [
    {
      number: "01",
      title: "Cuéntanos qué pasó.",
      text: "Registra lo que perdiste o encontraste. Una zona, una fecha y algunos detalles son el inicio.",
      icon: Search,
    },
    {
      number: "02",
      title: "Revisa posibles coincidencias.",
      text: "Comparamos los reportes con ayuda de IA, incluso si describen el objeto con otras palabras. Si encontramos un parecido, lo verás en Mi espacio. Tú decides si corresponde al tuyo.",
      icon: Sparkle,
    },
    {
      number: "03",
      title: "Verificamos antes de entregar.",
      text: "Si reconoces un hallazgo, solicita la devolución con un detalle que no aparezca en el aviso. El equipo revisa la solicitud y, si la aprueba, ayuda a coordinar la entrega.",
      icon: HeartHandshake,
    },
  ];
  return (
    <>
      <section className="hero container">
        {/* Sin animaciones de entrada: lo primero que se ve debe ser útil al instante. */}
        <div className="hero-copy">
          <p className="eyebrow">
            <span />
            OBJETOS PERDIDOS Y ENCONTRADOS
          </p>
          <h1 aria-label="Lo encontrado puede volver.">
            {["Lo encontrado", "puede", "volver."].map((word, index) => (
              <span className={`hero-line line-${index}`} key={word}>
                <span>{word}</span>
              </span>
            ))}
          </h1>
          <div>
            <p className="hero-description">
              Busca lo que perdiste o reporta lo que encontraste en la Sierra de
              Zongolica. Aquí puedes seguir tu caso y ayudar a que un objeto
              vuelva a su dueño.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary" to="/reportar?kind=lost">
                Perdí algo <ArrowUpRight size={19} />
              </Link>
              <Link className="btn btn-accent" to="/reportar?kind=found">
                Encontré algo <ArrowUpRight size={19} />
              </Link>
            </div>
            <Link className="text-link hero-browse" to="/explorar?kind=found">
              Primero quiero ver los objetos encontrados{" "}
              <ArrowRight size={17} />
            </Link>
            <div className="hero-trust">
              <ShieldCheck size={17} />
              <span>
                Tú eliges si compartes un aviso. Tu correo y tu detalle secreto
                no se publican.
              </span>
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <RouteScene />
        </div>
      </section>
      <section id="como-funciona" className="how-section">
        <div className="container">
          <Reveal className="section-heading">
            <div>
              <p className="eyebrow">
                <span />
                DEL ENCUENTRO AL REGRESO
              </p>
              <h2>
                Funciona
                <br />
                en tres pasos.
              </h2>
            </div>
            <p>
              La app sugiere posibles coincidencias.
              <br />
              Las personas comprueban y coordinan la devolución.
            </p>
          </Reveal>
          <div className="steps-grid">
            {steps.map((step) => (
              <Reveal key={step.number} className="step-card">
                <div className="step-top">
                  <span>{step.number}</span>
                  <step.icon size={27} strokeWidth={1.5} />
                </div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
      {/* La franja corre en bucle: el segundo grupo repite el primero para que
          no haya un corte; los lectores de pantalla solo leen el primero. */}
      <div className="community-ribbon">
        <div className="container">
          {[false, true].map((copy) => (
            <span key={String(copy)} className="ribbon-group" aria-hidden={copy || undefined}>
              <span>HECHO PARA NUESTRA SIERRA</span>
              <span className="ribbon-star">✳</span>
              <span>LO QUE SE PIERDE PUEDE REGRESAR</span>
              <span className="ribbon-star">✳</span>
              <span>DE PERSONA A PERSONA</span>
              <span className="ribbon-star">✳</span>
            </span>
          ))}
        </div>
      </div>
      <section className="section container">
        <Reveal className="section-heading">
          <div>
            <p className="eyebrow">
              <span />
              AVISOS DE LA COMUNIDAD
            </p>
            <h2>¿Reconoces alguno?</h2>
          </div>
          <div>
            <p>
              Estos son los avisos que ha publicado la comunidad. Los dibujos
              son solo de referencia; no son fotos reales de los objetos.
            </p>
            <Link className="text-link" to="/explorar">
              Explorar todos los avisos <ArrowUpRight size={18} />
            </Link>
          </div>
        </Reveal>
        {latest.loading ? (
          <SkeletonCards />
        ) : latest.error ? (
          <ErrorBox message={latest.error} retry={latest.reload} />
        ) : latest.data && latest.data.results.length > 0 ? (
          <div className="card-grid">
            {latest.data.results.map((report) => (
              <Reveal key={report.id}>
                <PublicCard report={report} />
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="home-empty">
            <EmptyState
              title="Todavía no hay avisos."
              text="Si perdiste o encontraste algo, registra un reporte. Al final podrás elegir si compartes un aviso con la comunidad."
            >
              <Link to="/reportar" className="text-link">
                Crear un reporte <ArrowRight size={17} />
              </Link>
            </EmptyState>
            <div className="home-empty-side">
              <span className="display-symbol">↗</span>
              <p>
                A veces, todo empieza
                <br />
                con alguien que dice:
                <br />
                <strong>“yo lo encontré”.</strong>
              </p>
            </div>
          </div>
        )}
      </section>
      <section
        className="section container help-section"
        aria-labelledby="help-title"
      >
        <div>
          <p className="eyebrow">
            <span /> ANTES DE EMPEZAR
          </p>
          <h2 id="help-title">Para que todo esté claro.</h2>
          <p>
            Reportar es solo el primer paso. Para que algo vuelva, nos ayudamos
            entre todos.
          </p>
        </div>
        <div className="help-questions">
          <details>
            <summary>¿Qué puedo reportar?</summary>
            <p>
              Casi cualquier objeto: mochilas, bolsas, ropa, libros, cuadernos,
              accesorios, y también celulares, credenciales y documentos. Para
              los objetos delicados —como un celular o una identificación— el
              equipo verifica con más cuidado antes de devolverlos, y nunca
              debes escribir contraseñas, NIP ni datos del banco.
            </p>
          </details>
          <details>
            <summary>¿Mi reporte se publica al guardarlo?</summary>
            <p>
              El reporte completo queda privado. Puedes publicar al momento un
              aviso básico con el tipo de objeto y la región. Si añades texto o
              una zona más precisa, el equipo lo revisa antes de mostrarlo. No
              se publica tu correo ni tu detalle de propiedad.
            </p>
          </details>
          <details>
            <summary>¿Cómo sé si apareció algo parecido?</summary>
            <p>
              Entra a Mi espacio y abre tu reporte para consultar posibles
              coincidencias. Las novedades aparecen en la campana. También
              puedes activar avisos en este dispositivo; no enviamos correo ni SMS.
            </p>
          </details>
          <details>
            <summary>¿Qué pasa si reconozco mi objeto?</summary>
            <p>
              Abre el aviso y toca «Solicitar devolución». Te pediremos un
              detalle que no aparezca en el aviso. El equipo revisa la propiedad
              antes de coordinar la entrega. Una coincidencia no garantiza la
              recuperación.
            </p>
          </details>
        </div>
      </section>
      <section className="purpose-section container">
        <Reveal className="purpose-card">
          <div className="purpose-art">
            <svg viewBox="0 0 400 260" fill="none" aria-hidden="true">
              <path
                d="M-20 200c100-170 160-170 205-70s125 50 170-40 110 20 60 90"
                stroke="#D6E65A"
                strokeWidth="5"
              />
              <path
                d="M-20 220c100-170 160-170 205-70s125 50 170-40 110 20 60 90"
                stroke="#7FB3BA"
                strokeWidth="2"
              />
              <circle cx="160" cy="96" r="18" fill="#FFFFFF" />
              <circle cx="234" cy="96" r="18" fill="#D6E65A" />
              <path
                d="M133 174v-29q0-27 27-27t27 27v29m20 0v-29q0-27 27-27t27 27v29"
                stroke="#FFFFFF"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <path
                d="M180 153q18 15 35 0"
                stroke="#D6E65A"
                strokeWidth="5"
                strokeLinecap="round"
              />
            </svg>
            <span>HAY ALGUIEN DEL OTRO LADO.</span>
          </div>
          <div className="purpose-copy">
            <p className="eyebrow">
              <span />
              POR QUÉ LO HACEMOS
            </p>
            <h2>
              Detrás de cada objeto que vuelve,
              <br />
              hay una persona.
            </h2>
            <p>
              Una mochila puede traer el trabajo de todo un día. Un cuaderno,
              meses de tarea. Aquí, quien quiere ayudar encuentra cómo hacerlo.
            </p>
            <Link className="text-link" to="/reportar">
              Ayuda a que algo vuelva <ArrowRight size={18} />
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
