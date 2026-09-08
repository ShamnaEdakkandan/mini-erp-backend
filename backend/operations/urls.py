from django.urls import path
from rest_framework.routers import SimpleRouter

from . import views


router = SimpleRouter()
router.register("suppliers", views.SupplierViewSet, basename="supplier")
router.register("products", views.ProductViewSet, basename="product")
router.register("documents", views.DocumentViewSet, basename="document")
router.register("stock-movements", views.StockViewSet, basename="stock-movement")
router.register("returns", views.ReturnViewSet, basename="return")
router.register("expenses", views.ExpenseViewSet, basename="expense")
router.register("transactions", views.TransactionViewSet, basename="transaction")
router.register("users", views.UserViewSet, basename="workspace-user")

urlpatterns = [
    path("settings/", views.SettingsView.as_view()),
    path("dashboard/", views.DashboardView.as_view()),
    path("accounting/", views.AccountingView.as_view()),
    path("reports/<str:report>/", views.ReportView.as_view()),
] + router.urls
