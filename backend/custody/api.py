from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from audit.models import record
from claims.models import Claim
from notifications.models import Notification
from reports.models import Report

from .models import CustodyEvent, CustodyPoint, CustodyRecord, Handover


class IntakeInput(serializers.Serializer):
    report_id = serializers.UUIDField(required=False)
    folio = serializers.CharField(required=False, max_length=15)
    point_id = serializers.IntegerField()
    note = serializers.CharField(min_length=8, max_length=500)

    def validate(self, attrs):
        if not attrs.get("report_id") and not attrs.get("folio"):
            raise serializers.ValidationError("Indica el folio del hallazgo.")
        return attrs


class TransferInput(serializers.Serializer):
    report_id = serializers.UUIDField()
    target_point_id = serializers.IntegerField()
    note = serializers.CharField(min_length=8, max_length=500)


class HandoverInput(serializers.Serializer):
    claim_id = serializers.IntegerField()
    note = serializers.CharField(min_length=8, max_length=500)


class PointsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        points = CustodyPoint.objects.filter(active=True).order_by("name")
        return Response([{"id": item.pk, "name": item.name, "public_area": item.public_area} for item in points])


class IntakeView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        serializer = IntakeInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        lookup = {"pk": data["report_id"]} if data.get("report_id") else {"folio": data["folio"].strip().upper()}
        report = get_object_or_404(Report.objects.select_for_update(), kind=Report.Kind.FOUND, **lookup)
        point = get_object_or_404(CustodyPoint, pk=data["point_id"], active=True)
        if not (request.user.is_staff or point.members.filter(pk=request.user.pk).exists()):
            return Response({"error": "No perteneces a este punto."}, status=403)
        if report.status not in (Report.Status.ACTIVE, Report.Status.RESERVED) or report.holder != Report.Holder.FINDER:
            return Response({"error": "Este hallazgo no puede recibirse en el punto."}, status=409)
        CustodyRecord.objects.create(report=report, current_point=point)
        report.holder = Report.Holder.POINT
        report.save(update_fields=["holder"])
        event = CustodyEvent.objects.create(report=report, point=point, actor=request.user,
                                            action=CustodyEvent.Action.INTAKE, note=data["note"])
        record(actor=request.user, action="custody.intake", obj=event)
        Notification.objects.create(recipient=report.owner, kind=Notification.Kind.HANDOVER,
                                    title="Objeto recibido en un punto", body="Tu hallazgo fue registrado en un punto de resguardo.", report=report)
        return Response({"event_id": event.pk, "holder": report.holder}, status=201)


class TransferView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        if not request.user.is_staff:
            return Response({"error": "El traslado requiere autorización del equipo."}, status=403)
        serializer = TransferInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        report = get_object_or_404(Report.objects.select_for_update(), pk=data["report_id"], kind=Report.Kind.FOUND)
        custody = get_object_or_404(CustodyRecord.objects.select_for_update(), report=report, released_at__isnull=True)
        point = get_object_or_404(CustodyPoint, pk=data["target_point_id"], active=True)
        if custody.current_point_id == point.pk:
            return Response({"error": "El objeto ya está en ese punto."}, status=409)
        if report.status == Report.Status.RETURNED:
            return Response({"error": "El objeto ya fue entregado."}, status=409)
        custody.current_point = point
        custody.save(update_fields=["current_point", "updated_at"])
        event = CustodyEvent.objects.create(report=report, point=point, actor=request.user,
                                            action=CustodyEvent.Action.TRANSFER, note=data["note"])
        record(actor=request.user, action="custody.transfer", obj=event)
        return Response({"event_id": event.pk, "point_id": point.pk}, status=201)


class HandoverView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Handover.objects.select_related("report", "claim")
        if not request.user.is_staff:
            queryset = queryset.filter(Q(claim__claimant=request.user) | Q(point__members=request.user, point__active=True)).distinct()
        return Response([{"id": item.pk, "claim_id": item.claim_id, "status": item.status,
                          "report_id": str(item.report_id), "summary": item.report.public_summary,
                          "initiated_at": item.initiated_at, "confirmed_at": item.confirmed_at}
                         for item in queryset.order_by("-initiated_at")[:100]])

    @transaction.atomic
    def post(self, request):
        serializer = HandoverInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        claim_id = serializer.validated_data["claim_id"]
        claim_ref = get_object_or_404(Claim, pk=claim_id)
        report = Report.objects.select_for_update().get(pk=claim_ref.found_report_id)
        claim = Claim.objects.select_for_update().select_related("claimant").get(pk=claim_id)
        if claim.status != Claim.Status.APPROVED or report.status != Report.Status.RESERVED:
            return Response({"error": "No existe una reclamación aprobada disponible para entrega."}, status=409)
        if Handover.objects.filter(report=report).exists():
            return Response({"error": "La entrega ya fue iniciada."}, status=409)
        point = None
        if report.holder == Report.Holder.POINT:
            custody = get_object_or_404(CustodyRecord, report=report, released_at__isnull=True)
            point = custody.current_point
            if not (request.user.is_staff or (point.active and point.members.filter(pk=request.user.pk).exists())):
                return Response({"error": "No perteneces al punto que tiene el objeto."}, status=403)
        elif not request.user.is_staff:
            return Response({"error": "La entrega desde el hallador requiere al equipo."}, status=403)
        handover = Handover.objects.create(report=report, claim=claim, point=point,
                                           initiated_by=request.user, note=serializer.validated_data["note"])
        event = CustodyEvent.objects.create(report=report, point=point, actor=request.user,
                                            action=CustodyEvent.Action.HANDOVER_STARTED, note="Entrega iniciada; falta confirmación del reclamante.")
        record(actor=request.user, action="handover.started", obj=handover)
        Notification.objects.create(recipient=claim.claimant, kind=Notification.Kind.HANDOVER,
                                    title="Confirma la recepción", body="Confirma en LocalizaT únicamente después de recibir el objeto.", report=report)
        return Response({"handover_id": handover.pk, "status": handover.status}, status=201)


class ConfirmHandoverView(APIView):
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, pk):
        handover_ref = get_object_or_404(Handover, pk=pk, claim__claimant=request.user)
        report = Report.objects.select_for_update().get(pk=handover_ref.report_id)
        handover = Handover.objects.select_for_update().get(pk=pk)
        if handover.status != Handover.Status.PENDING or report.status != Report.Status.RESERVED:
            return Response({"error": "Esta entrega ya fue confirmada o cambió de estado."}, status=409)
        handover.status = Handover.Status.CONFIRMED
        handover.confirmed_at = timezone.now()
        handover.save(update_fields=["status", "confirmed_at"])
        report.status = Report.Status.RETURNED
        report.save(update_fields=["status"])
        if handover.claim.lost_report_id:
            Report.objects.filter(pk=handover.claim.lost_report_id, status=Report.Status.ACTIVE).update(status=Report.Status.RETURNED)
        if handover.point_id:
            custody = CustodyRecord.objects.select_for_update().get(report=report)
            custody.released_at = handover.confirmed_at
            custody.save(update_fields=["released_at", "updated_at"])
        event = CustodyEvent.objects.create(report=report, point=handover.point, actor=request.user,
                                            action=CustodyEvent.Action.HANDOVER_CONFIRMED, note="Recepción confirmada por la cuenta reclamante.")
        record(actor=request.user, action="handover.confirmed", obj=handover)
        Notification.objects.create(recipient=report.owner, kind=Notification.Kind.HANDOVER,
                                    title="Entrega confirmada", body="La cuenta reclamante confirmó la recepción del objeto.", report=report)
        return Response({"status": handover.status, "report_status": report.status})


class InventoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request.user.is_staff and not request.user.custody_points.filter(active=True).exists():
            return Response({"error": "No tienes acceso al inventario."}, status=403)
        queryset = CustodyRecord.objects.filter(released_at__isnull=True).select_related("report", "current_point")
        if not request.user.is_staff:
            queryset = queryset.filter(current_point__members=request.user, current_point__active=True)
        return Response([{"report_id": str(item.report_id), "folio": item.report.folio,
                          "description": item.report.description, "status": item.report.status,
                          "point_id": item.current_point_id, "point_name": item.current_point.name}
                         for item in queryset.order_by("-updated_at")[:100]])
