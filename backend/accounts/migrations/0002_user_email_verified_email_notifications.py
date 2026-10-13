from django.db import migrations, models


def google_accounts_are_verified(apps, schema_editor):
    # Las cuentas creadas con Google no tienen contraseña utilizable y Google ya
    # comprobó su correo; las demás deberán confirmarlo.
    User = apps.get_model("accounts", "User")
    User.objects.filter(password__startswith="!").update(email_verified=True)


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="email_verified",
            field=models.BooleanField(default=False, verbose_name="correo verificado"),
        ),
        migrations.AddField(
            model_name="user",
            name="email_notifications",
            field=models.BooleanField(default=True, verbose_name="recibir avisos por correo"),
        ),
        migrations.RunPython(google_accounts_are_verified, migrations.RunPython.noop),
    ]
