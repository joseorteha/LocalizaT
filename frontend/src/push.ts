import { api } from "./api";

function applicationServerKey(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const bytes = atob(padded);
  const key = new Uint8Array(new ArrayBuffer(bytes.length));
  for (let index = 0; index < bytes.length; index += 1) key[index] = bytes.charCodeAt(index);
  return key;
}

export function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && window.isSecureContext;
}

export async function preparePushWorker() {
  if (!pushSupported()) throw new Error("Este navegador no admite avisos push en este contexto.");
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  let timeoutId: number | undefined;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(
          () => reject(new Error("No se pudo preparar el servicio de avisos. Recarga la página e inténtalo otra vez.")),
          12000,
        );
      }),
    ]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
}

export async function currentPushSubscription() {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration("/");
  return registration ? registration.pushManager.getSubscription() : null;
}

export async function enablePush(publicKey: string) {
  if (!pushSupported()) throw new Error("Este navegador no admite avisos push en este contexto.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("No se concedió el permiso de notificaciones.");
  const registration = await preparePushWorker();
  const previous = await registration.pushManager.getSubscription();
  if (previous && !(await api.pushSubscriptionStatus(previous.endpoint)).subscribed) {
    await previous.unsubscribe();
  }
  let subscription: PushSubscription;
  try {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey(publicKey),
    });
  } catch {
    throw new Error("No pudimos activar los avisos en este dispositivo. Recarga la página e inténtalo otra vez.");
  }
  const serialized = subscription.toJSON();
  if (!serialized.endpoint || !serialized.keys) throw new Error("La suscripción del dispositivo está incompleta.");
  try {
    await api.savePushSubscription(serialized);
  } catch (error) {
    await subscription.unsubscribe();
    throw error;
  }
}

export async function disablePush() {
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  await api.deletePushSubscription(subscription.endpoint);
  await subscription.unsubscribe();
}
