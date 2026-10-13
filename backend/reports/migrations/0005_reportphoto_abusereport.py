import uuid

import django.db.models.deletion
import reports.models
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("reports", "0004_alter_report_category"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ReportPhoto",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("image", models.FileField(max_length=200, storage=reports.models.private_storage, upload_to=reports.models.photo_path)),
                ("width", models.PositiveIntegerField()),
                ("height", models.PositiveIntegerField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("report", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="photos", to="reports.report")),
            ],
            options={"ordering": ["created_at"]},
        ),
        migrations.CreateModel(
            name="AbuseReport",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("fingerprint", models.CharField(max_length=64)),
                ("reason", models.CharField(choices=[("false", "Parece falso o engañoso"), ("offensive", "Es ofensivo o inapropiado"), ("personal", "Muestra datos personales"), ("spam", "Es publicidad o spam"), ("other", "Otro motivo")], max_length=12)),
                ("details", models.CharField(blank=True, max_length=300)),
                ("status", models.CharField(choices=[("open", "Por revisar"), ("dismissed", "Sin problema"), ("actioned", "Aviso retirado")], default="open", max_length=12)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("resolved_at", models.DateTimeField(blank=True, null=True)),
                ("report", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="abuse_reports", to="reports.report")),
                ("reporter", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="abuse_reports", to=settings.AUTH_USER_MODEL)),
                ("resolved_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="resolved_abuse_reports", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["created_at"],
                "indexes": [models.Index(fields=["status", "created_at"], name="abuse_review_idx")],
                "constraints": [models.UniqueConstraint(fields=("report", "fingerprint"), name="one_abuse_report_per_person")],
            },
        ),
    ]
