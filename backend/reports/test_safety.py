import shutil
import tempfile
import uuid
from datetime import date
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from notifications.models import Notification
from reports.models import AbuseReport, Report, ReportPhoto


def jpeg_with_gps(size=(2400, 1800)):
    """Foto JPEG con EXIF (incluida una etiqueta GPS) como las de un celular."""
    image = Image.new("RGB", size, (30, 120, 140))
    exif = Image.Exif()
    exif[0x8825] = {1: "N", 2: (18.0, 40.0, 0.0)}  # GPSInfo
    exif[0x010F] = "MarcaDeCelular"  # Make
    buffer = BytesIO()
    image.save(buffer, format="JPEG", exif=exif)
    return SimpleUploadedFile("foto.jpg", buffer.getvalue(), content_type="image/jpeg")


class SafetyBase(TestCase):
    def setUp(self):
        cache.clear()
        users = get_user_model().objects
        self.owner = users.create_user(email="dueno@example.com", password="StrongPass_2026!")
        self.other = users.create_user(email="otra@example.com", password="StrongPass_2026!")
        self.staff = users.create_superuser(email="equipo@example.com", password="StrongPass_2026!")
        self.client = APIClient()

    def make_report(self, publish=True):
        self.client.force_authenticate(self.owner)
        response = self.client.post("/api/reports/", {
            "client_request_id": str(uuid.uuid4()), "kind": "found", "category": "phone",
            "description": "Celular negro con funda transparente", "approximate_area": "Zongolica",
            "occurred_on": date.today().isoformat(), "ownership_clue": "",
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        report = Report.objects.get(pk=response.data["id"])
        if publish:
            published = self.client.post(f"/api/reports/{report.pk}/publication/", {"mode": "instant", "municipality": "Zongolica"}, format="json")
            self.assertEqual(published.status_code, 200, published.data)
            report.refresh_from_db()
        self.client.force_authenticate(None)
        return report


class AbuseReportTests(SafetyBase):
    def denounce(self, report, ip, reason="false", details=""):
        return self.client.post(f"/api/public/reports/{report.pk}/abuse/", {"reason": reason, "details": details},
                                format="json", REMOTE_ADDR=ip)

    def test_anyone_can_report_once(self):
        report = self.make_report()
        first = self.denounce(report, "10.0.0.1")
        again = self.denounce(report, "10.0.0.1")
        self.assertEqual(first.status_code, 201)
        self.assertEqual(again.json().get("already"), True)
        self.assertEqual(report.abuse_reports.count(), 1)

    def test_other_reason_needs_details(self):
        report = self.make_report()
        self.assertEqual(self.denounce(report, "10.0.0.2", reason="other").status_code, 400)
        self.assertEqual(self.denounce(report, "10.0.0.2", reason="nada").status_code, 400)

    def test_private_reports_cannot_be_reported(self):
        report = self.make_report(publish=False)
        self.assertEqual(self.denounce(report, "10.0.0.3").status_code, 404)

    def test_owner_cannot_report_own_notice(self):
        report = self.make_report()
        self.client.force_authenticate(self.owner)
        response = self.client.post(f"/api/public/reports/{report.pk}/abuse/", {"reason": "spam"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_three_reports_move_notice_to_review_and_staff_can_restore_it(self):
        report = self.make_report()
        for index in range(3):
            self.assertEqual(self.denounce(report, f"10.0.1.{index}").status_code, 201)
        report.refresh_from_db()
        self.assertEqual(report.publication_status, Report.Publication.PENDING)
        self.assertTrue(Notification.objects.filter(recipient=self.owner, title="Tu aviso está en revisión").exists())
        public = self.client.get("/api/public/reports/").json()
        self.assertEqual(public["count"], 0)

        self.client.force_authenticate(self.staff)
        queue = self.client.get("/api/ops/abuse/").json()
        self.assertEqual(queue[0]["open_count"], 3)
        decided = self.client.post(f"/api/ops/abuse/{report.pk}/decision/", {"decision": "dismiss"}, format="json")
        self.assertEqual(decided.status_code, 200)
        report.refresh_from_db()
        self.assertEqual(report.publication_status, Report.Publication.PUBLIC)
        self.assertFalse(AbuseReport.objects.filter(status=AbuseReport.Status.OPEN).exists())

    def test_staff_can_hide_reported_notice_with_reason(self):
        report = self.make_report()
        self.denounce(report, "10.0.2.1", reason="personal")
        self.client.force_authenticate(self.staff)
        missing_reason = self.client.post(f"/api/ops/abuse/{report.pk}/decision/", {"decision": "hide"}, format="json")
        self.assertEqual(missing_reason.status_code, 400)
        hidden = self.client.post(f"/api/ops/abuse/{report.pk}/decision/",
                                  {"decision": "hide", "reason": "Mostraba un número de teléfono."}, format="json")
        self.assertEqual(hidden.status_code, 200)
        report.refresh_from_db()
        self.assertEqual(report.publication_status, Report.Publication.PRIVATE)
        self.assertEqual(report.publication_review_reason, "Mostraba un número de teléfono.")

    def test_only_staff_sees_abuse_queue(self):
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get("/api/ops/abuse/").status_code, 403)

    def test_abuse_reports_are_rate_limited(self):
        report = self.make_report()
        statuses = [self.denounce(report, "10.0.9.9", reason="spam").status_code for _ in range(11)]
        self.assertEqual(statuses[-1], 429)


class PrivateMediaMixin:
    def setUp(self):
        super().setUp()
        self.media = tempfile.mkdtemp()
        self.override = override_settings(PRIVATE_MEDIA_ROOT=self.media)
        self.override.enable()

    def tearDown(self):
        self.override.disable()
        shutil.rmtree(self.media, ignore_errors=True)
        super().tearDown()


class PhotoTests(PrivateMediaMixin, SafetyBase):
    def upload(self, report, file):
        self.client.force_authenticate(self.owner)
        return self.client.post(f"/api/reports/{report.pk}/photos/", {"photo": file}, format="multipart")

    def test_photo_is_resized_and_metadata_removed(self):
        report = self.make_report(publish=False)
        response = self.upload(report, jpeg_with_gps())
        self.assertEqual(response.status_code, 201, response.data)
        self.assertLessEqual(max(response.data["width"], response.data["height"]), 1600)
        photo = ReportPhoto.objects.get(pk=response.data["id"])
        with photo.image.open("rb") as stored:
            image = Image.open(stored)
            self.assertEqual(image.format, "JPEG")
            exif = image.getexif()
            self.assertNotIn(0x8825, exif)  # sin GPS
            self.assertNotIn(0x010F, exif)  # sin marca del celular

    def test_only_owner_and_staff_can_open_photos(self):
        report = self.make_report(publish=False)
        photo_id = self.upload(report, jpeg_with_gps((800, 600))).data["id"]
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(f"/api/photos/{photo_id}/").status_code, 404)
        self.assertEqual(self.client.get(f"/api/reports/{report.pk}/photos/").status_code, 404)
        self.client.force_authenticate(self.staff)
        staff_view = self.client.get(f"/api/photos/{photo_id}/")
        self.assertEqual(staff_view.status_code, 200)
        self.assertEqual(staff_view["Content-Type"], "image/jpeg")
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(f"/api/photos/{photo_id}/").status_code, 403)

    def test_photo_limit_and_invalid_files(self):
        report = self.make_report(publish=False)
        for _ in range(3):
            self.assertEqual(self.upload(report, jpeg_with_gps((400, 300))).status_code, 201)
        self.assertEqual(self.upload(report, jpeg_with_gps((400, 300))).status_code, 409)
        other = self.make_report(publish=False)
        fake = SimpleUploadedFile("virus.jpg", b"esto no es una imagen", content_type="image/jpeg")
        self.assertEqual(self.upload(other, fake).status_code, 400)

    def test_owner_can_delete_photo(self):
        report = self.make_report(publish=False)
        photo_id = self.upload(report, jpeg_with_gps((400, 300))).data["id"]
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.delete(f"/api/photos/{photo_id}/").status_code, 404)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.delete(f"/api/photos/{photo_id}/").status_code, 204)
        self.assertFalse(ReportPhoto.objects.exists())


class HealthTests(TestCase):
    def test_health_reports_worker_heartbeat(self):
        cache.clear()
        response = self.client.get("/api/health/").json()
        self.assertEqual(response, {"status": "ok", "worker": "sin_latido"})
        from django.utils import timezone

        cache.set("worker:heartbeat", timezone.now().isoformat(), 300)
        self.assertEqual(self.client.get("/api/health/").json()["worker"], "ok")
