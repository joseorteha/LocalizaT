from django.contrib import admin
from django.urls import path

from accounts import api as accounts_api
from audit import api as audit_api
from claims import api as claims_api
from custody import api as custody_api
from matching import api as matching_api
from notifications import api as notifications_api
from reports import api as reports_api


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", reports_api.health, name="health"),
    path("api/auth/csrf/", accounts_api.csrf, name="csrf"),
    path("api/auth/signup/", accounts_api.signup, name="signup"),
    path("api/auth/login/", accounts_api.login_view, name="login"),
    path("api/auth/logout/", accounts_api.logout_view, name="logout"),
    path("api/auth/me/", accounts_api.me, name="me"),
    path("api/auth/config/", accounts_api.auth_config, name="auth-config"),
    path("api/auth/google/", accounts_api.google_login, name="google-login"),
    path("api/reports/", reports_api.ReportListCreateView.as_view(), name="reports"),
    path("api/reports/<uuid:pk>/", reports_api.ReportDetailView.as_view(), name="report-detail"),
    path("api/reports/<uuid:pk>/close/", reports_api.CloseOwnReportView.as_view(), name="report-close"),
    path("api/reports/<uuid:pk>/publication/", reports_api.PublicationRequestView.as_view(), name="publication-request"),
    path("api/reports/<uuid:pk>/suggestions/", matching_api.OwnSuggestionsView.as_view(), name="own-suggestions"),
    path("api/public/reports/", reports_api.PublicReportListView.as_view(), name="public-reports"),
    path("api/public/reports/<uuid:pk>/", reports_api.PublicReportDetailView.as_view(), name="public-report-detail"),
    path("api/public/report-map/", reports_api.PublicReportMapView.as_view(), name="public-report-map"),
    path("api/ops/reports/<uuid:pk>/publication/", reports_api.PublicationReviewView.as_view(), name="publication-review"),
    path("api/ops/publications/", reports_api.PendingPublicationsView.as_view(), name="pending-publications"),
    path("api/ops/metrics/", audit_api.MetricsView.as_view(), name="ops-metrics"),
    path("api/ops/suggestions/", matching_api.ReviewQueueView.as_view(), name="review-queue"),
    path("api/ops/suggestions/<int:pk>/review/", matching_api.ReviewSuggestionView.as_view(), name="review-suggestion"),
    path("api/claims/", claims_api.ClaimsView.as_view(), name="claims"),
    path("api/claims/<int:pk>/", claims_api.ClaimDetailView.as_view(), name="claim-detail"),
    path("api/ops/claims/<int:pk>/decision/", claims_api.ClaimDecisionView.as_view(), name="claim-decision"),
    path("api/points/", custody_api.PointsView.as_view(), name="points"),
    path("api/custody/intake/", custody_api.IntakeView.as_view(), name="custody-intake"),
    path("api/custody/inventory/", custody_api.InventoryView.as_view(), name="custody-inventory"),
    path("api/custody/transfer/", custody_api.TransferView.as_view(), name="custody-transfer"),
    path("api/handovers/", custody_api.HandoverView.as_view(), name="handovers"),
    path("api/handovers/<int:pk>/confirm/", custody_api.ConfirmHandoverView.as_view(), name="handover-confirm"),
    path("api/notifications/", notifications_api.InboxView.as_view(), name="notifications"),
    path("api/push/config/", notifications_api.PushConfigView.as_view(), name="push-config"),
    path("api/push/subscriptions/", notifications_api.PushSubscriptionView.as_view(), name="push-subscriptions"),
    path("api/notifications/<int:pk>/read/", notifications_api.MarkReadView.as_view(), name="notification-read"),
]
