from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("reports", "0003_report_publication_review_reason"),
    ]

    operations = [
        migrations.AlterField(
            model_name="report",
            name="category",
            field=models.CharField(
                choices=[
                    ("bag", "Bolsa o mochila"),
                    ("clothing", "Ropa"),
                    ("accessory", "Accesorio"),
                    ("book", "Libro o cuaderno"),
                    ("phone", "Celular"),
                    ("credential", "Credencial o identificación"),
                    ("document", "Documento"),
                    ("other", "Otro objeto"),
                ],
                max_length=16,
            ),
        ),
    ]
