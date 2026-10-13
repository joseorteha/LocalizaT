// Reduce la foto en el propio celular antes de subirla: con señal 3G, una foto
// de 4 MB se vuelve de ~250 KB. El servidor de todos modos la vuelve a procesar
// y le quita los metadatos (incluida la ubicación GPS).
const MAX_SIDE = 1600;

export async function shrinkPhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Elige una foto.");
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.82),
    );
    return blob && blob.size < file.size ? blob : file;
  } catch {
    // Navegadores viejos o formatos raros (HEIC): se manda tal cual y el
    // servidor decide si la puede leer.
    return file;
  }
}
