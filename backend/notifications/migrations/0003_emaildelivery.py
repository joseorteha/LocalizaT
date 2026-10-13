import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("notifications", "0002_pushsubscription_pushdelivery"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="EmailDelivery",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("kind", models.CharField(choices=[("match", "Posible coincidencia"), ("claim", "Reclamación"), ("publication", "Publicación"), ("handover", "Entrega"), ("verify", "Verificar correo"), ("reset", "Recuperar contraseña")], max_length=12)),
                ("to_email", models.EmailField(max_length=254)),
                ("subject", models.CharField(max_length=150)),
                ("text_body", models.TextField(blank=True)),
                ("html_body", models.TextField(blank=True)),
                ("status", models.CharField(choices=[("pending", "Pendiente"), ("sending", "En proceso"), ("sent", "Enviado"), ("failed", "Fallido")], default="pending", max_length=12)),
                ("attempts", models.PositiveSmallIntegerField(default=0)),
                ("next_attempt_at", models.DateTimeField(auto_now_add=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("sent_at", models.DateTimeField(blank=True, null=True)),
                ("notification", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="email_deliveries", to="notifications.notification")),
                ("recipient", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="email_deliveries", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "indexes": [models.Index(fields=["status", "next_attempt_at"], name="email_queue_idx")],
            },
        ),
    ]
