"""Correos de LocalizaT: plantilla con la marca, cola de envío y reintentos.

Los correos nunca se mandan dentro de la petición web: se guardan en EmailDelivery
y el worker los envía (así una caída del servidor de correo no rompe un formulario).
"""
import logging
from datetime import timedelta
from html import escape

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import transaction
from django.utils import timezone

from .models import EmailDelivery, Notification

log = logging.getLogger("localizat.mail")

PETROL, LIME, INK, MUTED = "#0E4E5A", "#D6E65A", "#0F2A30", "#56707A"
# Correos con un enlace de un solo uso: su contenido se borra al enviarse.
ONE_TIME_KINDS = {EmailDelivery.Kind.VERIFY, EmailDelivery.Kind.RESET}


def site_link(path):
    return f"{settings.SITE_URL}{path}"


def render(*, heading, paragraphs, button_label="", button_url="", footnote=""):
    """Devuelve (texto, html) con el mismo contenido."""
    text = [heading, ""] + paragraphs
    if button_url:
        text += ["", f"{button_label}: {button_url}"]
    if footnote:
        text += ["", footnote]
    text += ["", "— LocalizaT · Lo encontrado puede volver.", "Sierra de Zongolica, Veracruz."]

    body = "".join(
        f'<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:{INK}">{escape(item)}</p>' for item in paragraphs
    )
    button = (
        f'<p style="margin:24px 0"><a href="{escape(button_url)}" '
        f'style="display:inline-block;background:{PETROL};color:#ffffff;text-decoration:none;'
        f'font-weight:700;font-size:16px;padding:14px 26px;border-radius:999px">{escape(button_label)}</a></p>'
        f'<p style="margin:0 0 14px;font-size:13px;color:{MUTED}">Si el botón no abre, copia este enlace en tu navegador:<br>'
        f'<span style="word-break:break-all">{escape(button_url)}</span></p>'
        if button_url else ""
    )
    note = f'<p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:{MUTED}">{escape(footnote)}</p>' if footnote else ""
    html = f"""<!doctype html><html lang="es"><body style="margin:0;padding:0;background:#F4F8F7">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F8F7;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;font-family:Manrope,Segoe UI,Arial,sans-serif">
<tr><td style="background:{PETROL};padding:22px 28px;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px">Localiza<span style="color:{LIME}">T</span></td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;color:{INK}">{escape(heading)}</h1>
{body}{button}{note}
</td></tr>
<tr><td style="padding:16px 28px 24px;border-top:1px solid #DBE6E5;font-size:12px;line-height:1.5;color:{MUTED}">
LocalizaT · Lo encontrado puede volver. · Sierra de Zongolica, Veracruz.<br>
Nunca te pediremos contraseñas, NIP ni pagos por correo.</td></tr>
</table></td></tr></table></body></html>"""
    return "\n".join(text), html


def queue(user, kind, subject, *, notification=None, **content):
    text, html = render(**content)
    return EmailDelivery.objects.create(
        recipient=user, notification=notification, kind=kind, to_email=user.email,
        subject=subject[:150], text_body=text, html_body=html,
    )


PREFERENCES_NOTE = "Recibes este correo porque tienes avisos por correo activados. Puedes apagarlos en Mi espacio › Avisos."


def queue_for_notification(notification):
    """Copia por correo de un aviso importante, si la persona lo permite."""
    user = notification.recipient
    if not (user.email_verified and user.email_notifications):
        return None
    kind = notification.kind
    # Varias coincidencias seguidas llegan en un solo correo cada media hora.
    if kind == Notification.Kind.MATCH and EmailDelivery.objects.filter(
        recipient=user, kind=EmailDelivery.Kind.MATCH, created_at__gte=timezone.now() - timedelta(minutes=30),
    ).exists():
        return None
    report = notification.report
    if report is not None and report.owner_id == user.pk:
        url = site_link(f"/mis-reportes/{report.pk}")
    else:
        url = site_link("/mi-espacio?section=alerts")
    if kind == Notification.Kind.MATCH:
        subject = "Apareció algo parecido a tu reporte"
        heading = "Apareció algo parecido"
        paragraphs = [
            "Hay un aviso público que podría corresponder a tu reporte en LocalizaT.",
            "Revísalo con calma: el parecido no confirma que sea el mismo objeto. Si crees que es tuyo, "
            "solicita la devolución desde tu caso; el equipo comprobará tu detalle secreto antes de coordinar la entrega.",
        ]
        label = "Ver la posible coincidencia"
    else:
        subject = notification.title
        heading = notification.title
        paragraphs = [notification.body]
        label = "Ver mi caso"
    return queue(user, kind, subject, notification=notification, heading=heading, paragraphs=paragraphs,
                 button_label=label, button_url=url, footnote=PREFERENCES_NOTE)


def queue_verification(user, link):
    return queue(
        user, EmailDelivery.Kind.VERIFY, "Confirma tu correo en LocalizaT",
        heading="Confirma tu correo",
        paragraphs=[
            "Gracias por crear tu cuenta en LocalizaT.",
            "Confirma que este correo es tuyo para que podamos avisarte cuando aparezca algo parecido a lo que reportaste.",
        ],
        button_label="Confirmar mi correo", button_url=link,
        footnote="Si no creaste una cuenta en LocalizaT, ignora este correo: no se activará nada.",
    )


def queue_password_reset(user, link):
    return queue(
        user, EmailDelivery.Kind.RESET, "Cambia tu contraseña de LocalizaT",
        heading="Cambia tu contraseña",
        paragraphs=[
            "Recibimos una solicitud para cambiar la contraseña de tu cuenta en LocalizaT.",
            "El enlace funciona una sola vez durante las próximas 2 horas.",
        ],
        button_label="Elegir una contraseña nueva", button_url=link,
        footnote="Si no lo pediste tú, ignora este correo: tu contraseña no cambia.",
    )


def process_next_email():
    now = timezone.now()
    with transaction.atomic():
        delivery = (EmailDelivery.objects.select_for_update(skip_locked=True)
                    .filter(status__in=[EmailDelivery.Status.PENDING, EmailDelivery.Status.SENDING],
                            next_attempt_at__lte=now)
                    .order_by("next_attempt_at", "pk").first())
        if not delivery:
            return False
        delivery.status = EmailDelivery.Status.SENDING
        delivery.attempts += 1
        delivery.next_attempt_at = now + timedelta(minutes=5)
        delivery.save(update_fields=["status", "attempts", "next_attempt_at"])
    try:
        message = EmailMultiAlternatives(delivery.subject, delivery.text_body, settings.DEFAULT_FROM_EMAIL, [delivery.to_email])
        message.attach_alternative(delivery.html_body, "text/html")
        message.send()
    except Exception:
        log.exception("No se pudo enviar el correo %s", delivery.pk)
        delivery.status = EmailDelivery.Status.FAILED if delivery.attempts >= 4 else EmailDelivery.Status.PENDING
        if delivery.status == EmailDelivery.Status.PENDING:
            delivery.next_attempt_at = timezone.now() + timedelta(minutes=2 ** delivery.attempts)
        delivery.save(update_fields=["status", "next_attempt_at"])
        return True
    delivery.status = EmailDelivery.Status.SENT
    delivery.sent_at = timezone.now()
    fields = ["status", "sent_at"]
    if delivery.kind in ONE_TIME_KINDS:
        delivery.text_body = delivery.html_body = ""
        fields += ["text_body", "html_body"]
    delivery.save(update_fields=fields)
    return True
