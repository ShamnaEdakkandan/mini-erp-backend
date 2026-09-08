"""Route Django administration and the customer API."""

from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

urlpatterns = [
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema", template_name="operations/swagger.html"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    path("api/", include("operations.urls")),
    path("api/auth/", include("accounts.urls")),
    path("admin/", admin.site.urls),
    path("api/", include("customers.urls")),
]
