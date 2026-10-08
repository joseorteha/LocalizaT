import assert from "node:assert/strict";
import { test } from "node:test";
import {
  lostProgress,
  foundProgress,
  claimProgress,
  primaryClaim,
  statusLabel,
} from "./domain.ts";

const loss = {
  kind: "lost",
  status: "active",
  publication_status: "private",
  match_count: 0,
};

test("publicación y entrega no comparten la etiqueta pending", () => {
  assert.equal(statusLabel("pending", "publication"), "Pendiente de revisión");
  assert.equal(statusLabel("pending", "handover"), "Entrega iniciada");
});

test("una pérdida privada puede revisar coincidencias sin publicar", () => {
  assert.equal(lostProgress(loss).action, "explore");
  const progress = lostProgress({ ...loss, match_count: 2 });
  assert.equal(progress.action, "matches");
  assert.equal(
    progress.steps.filter((step) => step.state === "done").length,
    1,
  );
});

test("un aviso público sin hallazgos no simula avance de propiedad", () => {
  const progress = lostProgress({ ...loss, publication_status: "public" });
  assert.equal(progress.action, "explore");
  assert.equal(progress.steps[2].state, "todo");
});

test("aprobar la propiedad no confirma la recepción", () => {
  const progress = claimProgress({ status: "approved", handover: null });
  assert.equal(progress.steps[3].state, "todo");
  assert.match(progress.next, /no confirma la entrega/);
});

test("una entrega iniciada sigue esperando la confirmación", () => {
  const progress = claimProgress({
    status: "approved",
    handover: { status: "pending" },
  });
  assert.equal(progress.steps[3].state, "current");
  assert.equal(progress.tone, "action");
});

test("una solicitud rechazada no invita a completar la entrega", () => {
  const progress = claimProgress({ status: "rejected", handover: null });
  assert.equal(
    progress.steps.some((step) => step.state === "current"),
    false,
  );
  assert.equal(progress.steps[2].state, "todo");
});

test("el hallador no conserva un objeto que ya está en un punto", () => {
  const progress = foundProgress({
    ...loss,
    kind: "found",
    status: "reserved",
    holder: "point",
  });
  assert.match(progress.next, /punto de resguardo/);
  assert.doesNotMatch(progress.next, /Conserva el objeto/);
});

test("una solicitud rechazada reciente no oculta la recepción pendiente", () => {
  const pending = {
    id: 1,
    status: "approved",
    handover: { status: "pending" },
  };
  const rejected = { id: 2, status: "rejected", handover: null };
  assert.equal(primaryClaim([rejected, pending])?.id, 1);
});

test("la confirmación final sí completa el recorrido", () => {
  const progress = claimProgress({
    status: "approved",
    handover: { status: "confirmed" },
  });
  assert.equal(
    progress.steps.every((step) => step.state === "done"),
    true,
  );
});
