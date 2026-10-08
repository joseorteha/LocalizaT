// Puente (proxy) de /api/* hacia el backend en Contabo.
//
// Por qué existe: Vercel está ignorando los "rewrites" de vercel.json en este
// proyecto (carpeta frontend como Root Directory), así que las llamadas a /api
// daban 404. Las Vercel Functions (archivos dentro de /api) SÍ se detectan
// siempre, por eso reenviamos aquí. Mantiene todo en el mismo dominio para que
// las cookies de sesión sigan funcionando.
export const config = { api: { bodyParser: false } };

const BACKEND = "https://localizat.duckdns.org";

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    const partes = [];
    req.on("data", (c) => partes.push(c));
    req.on("end", () => resolve(partes.length ? Buffer.concat(partes) : undefined));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  const destino = BACKEND + req.url; // req.url ya viene como /api/...?query

  const headers = { ...req.headers };
  delete headers.host;
  delete headers["content-length"];
  delete headers.connection;
  delete headers["accept-encoding"]; // que el backend responda sin comprimir

  const metodo = req.method || "GET";
  let cuerpo;
  if (metodo !== "GET" && metodo !== "HEAD") {
    if (req.body !== undefined && req.body !== null) {
      if (Buffer.isBuffer(req.body) || typeof req.body === "string") {
        cuerpo = req.body;
      } else {
        cuerpo = JSON.stringify(req.body);
        if (!headers["content-type"]) headers["content-type"] = "application/json";
      }
    } else {
      cuerpo = await leerCuerpo(req);
    }
  }

  let respuesta;
  try {
    respuesta = await fetch(destino, { method: metodo, headers, body: cuerpo, redirect: "manual" });
  } catch (err) {
    res.statusCode = 502;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "No se pudo contactar al backend", detalle: String(err) }));
    return;
  }

  res.statusCode = respuesta.status;

  // Reenviar cada cookie por separado (clave para el inicio de sesión).
  const cookies = typeof respuesta.headers.getSetCookie === "function" ? respuesta.headers.getSetCookie() : [];
  if (cookies.length) res.setHeader("set-cookie", cookies);

  respuesta.headers.forEach((valor, nombre) => {
    const k = nombre.toLowerCase();
    if (["set-cookie", "content-encoding", "content-length", "transfer-encoding", "connection"].includes(k)) return;
    res.setHeader(nombre, valor);
  });

  const datos = Buffer.from(await respuesta.arrayBuffer());
  res.end(datos);
}
