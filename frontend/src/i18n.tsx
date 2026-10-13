import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

// Textos principales en español y náhuatl de la Sierra de Zongolica.
//
// Las traducciones al náhuatl deben hacerlas y revisarlas hablantes de la
// región (hay variantes entre comunidades). Mientras falte alguna frase, el
// selector de idioma no aparece: preferimos no mostrar una traducción a medias
// o equivocada. La hoja para el traductor está en frontend/traduccion-nahuatl.csv.
const ES = {
  "nav.home": "Inicio",
  "nav.explore": "Explorar avisos",
  "nav.how": "Cómo funciona",
  "nav.login": "Entrar",
  "nav.create": "Crear reporte",
  "nav.space": "Mi espacio",
  "bottom.explore": "Explorar",
  "bottom.report": "Reportar",
  "footer.tagline": "Lo encontrado puede volver.",
  "footer.community": "Una comunidad, muchos caminos de regreso.",
  "footer.cta": "Haz que algo vuelva",
  "home.eyebrow": "OBJETOS PERDIDOS Y ENCONTRADOS",
  "home.title": "Lo encontrado|puede|volver.",
  "home.description":
    "Busca lo que perdiste o reporta lo que encontraste en la Sierra de Zongolica. Aquí puedes seguir tu caso y ayudar a que un objeto vuelva a su dueño.",
  "home.lost": "Perdí algo",
  "home.found": "Encontré algo",
  "home.browse": "Primero quiero ver los objetos encontrados",
  "home.trust": "Tú eliges si compartes un aviso. Tu correo y tu detalle secreto no se publican.",
  "wizard.question": "¿Qué te pasó?",
  "wizard.lost": "Perdí algo",
  "wizard.lostHint": "Lo estoy buscando.",
  "wizard.found": "Encontré algo",
  "wizard.foundHint": "Quiero devolverlo.",
  "wizard.category": "¿Qué tipo de objeto es?",
  "wizard.next": "Siguiente",
  "wizard.save": "Guardar mi reporte",
  "feedback.open": "¿Algo no se entendió?",
  "language.label": "Idioma",
} as const;

export type TextKey = keyof typeof ES;
export type Lang = "es" | "nah";

// Rellenar con las frases revisadas por hablantes (ver traduccion-nahuatl.csv).
const NAH: Partial<Record<TextKey, string>> = {};

export const nahuatlReady = (Object.keys(ES) as TextKey[]).every((key) => Boolean(NAH[key]?.trim()));

const STORAGE = "localizat:idioma";
const LanguageContext = createContext<{ lang: Lang; setLang: (lang: Lang) => void }>({
  lang: "es",
  setLang: () => {},
});

function initialLang(): Lang {
  if (!nahuatlReady) return "es";
  try {
    return window.localStorage.getItem(STORAGE) === "nah" ? "nah" : "es";
  } catch {
    return "es";
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const setLang = useCallback((value: Lang) => {
    setLangState(value);
    // «nah» es el código general de las lenguas nahuas (ISO 639-2).
    document.documentElement.lang = value;
    try {
      window.localStorage.setItem(STORAGE, value);
    } catch {
      /* sin almacenamiento: dura esta visita */
    }
  }, []);
  return <LanguageContext.Provider value={{ lang, setLang }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function useT() {
  const { lang } = useContext(LanguageContext);
  return useCallback(
    (key: TextKey) => (lang === "nah" && NAH[key]?.trim() ? (NAH[key] as string) : ES[key]),
    [lang],
  );
}
