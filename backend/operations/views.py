from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q, F
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.filters import SearchFilter, OrderingFilter
from rest_framework.pagination import LimitOffsetPagination
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter, OpenApiExample
from drf_spectacular.types import OpenApiTypes

from . import models, reports, serializers, services
from .permissions import WorkspacePermission, workspace


class Page(LimitOffsetPagination):
    default_limit = 25
    max_limit = 500


class OwnedViewSet(viewsets.ModelViewSet):
    permission_classes = [WorkspacePermission]
    pagination_class = Page
    filter_backends = [SearchFilter, OrderingFilter]
    ordering_fields = ["id", "created_at"]
    ordering = ["-id"]
    search_fields = ["name"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return self.queryset.none()
        owner, _ = workspace(self.request.user)
        query = self.queryset.filter(owner=owner).order_by("id")
        params = self.request.query_params
        fields = {field.name for field in query.model._meta.fields}
        for name in ["status", "category", "kind", "method", "product", "document"]:
            if name in fields and name in params:
                if name in ["product", "document"] and not params[name].isdigit():
                    raise ValidationError({name: "Use a numeric identifier."})
                query = query.filter(**{name: params[name]})
        if "date" in fields:
            validator = reports.ReportFilters(data=params)
            validator.is_valid(raise_exception=True)
            query = reports.dated(query, validator.validated_data)
        return query

    def perform_create(self, serializer):
        serializer.save(owner=workspace(self.request.user)[0])

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        return super().create(request, *args, **kwargs)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        return super().update(request, *args, **kwargs)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        return super().destroy(request, *args, **kwargs)


@extend_schema_view(list=extend_schema(parameters=[OpenApiParameter("status", str, enum=["Active", "Inactive"])]))
class SupplierViewSet(OwnedViewSet):
    """Suppliers belonging to the signed-in workspace. Referenced records cannot be deleted."""
    queryset = models.Supplier.objects.all()
    serializer_class = serializers.SupplierSerializer
    search_fields = ["name", "email", "phone"]


@extend_schema_view(
    list=extend_schema(parameters=[OpenApiParameter("category", str), OpenApiParameter("status", str, enum=["Active", "Inactive"]), OpenApiParameter("stock_status", str, enum=["In Stock", "Low Stock", "Out of Stock"])]),
    create=extend_schema(examples=[OpenApiExample("Product", value={"name": "Keyboard", "sku": "KEY-001", "category": "Electronics", "cost": "20.00", "price": "35.00", "min": 5, "unit": "pcs", "tax": "5.00", "status": "Active"}, request_only=True)]),
)
class ProductViewSet(OwnedViewSet):
    """Product catalogue and current inventory. Stock is read-only; use stock-movements."""
    queryset = models.Product.objects.all()
    serializer_class = serializers.ProductSerializer
    search_fields = ["name", "sku", "category"]
    ordering_fields = ["id", "name", "stock", "price", "cost"]

    def get_queryset(self):
        query = super().get_queryset()
        state = self.request.query_params.get("stock_status")
        if state == "Out of Stock":
            query = query.filter(stock=0)
        elif state == "Low Stock":
            query = query.filter(stock__gt=0, stock__lt=F("min"))
        elif state == "In Stock":
            query = query.filter(stock__gt=0, stock__gte=F("min"))
        elif state:
            raise ValidationError({"stock_status": "Use In Stock, Low Stock, or Out of Stock."})
        return query


@extend_schema_view(
    list=extend_schema(parameters=[OpenApiParameter("kind", str, enum=["Sale", "Purchase Order", "Purchase Bill"]), OpenApiParameter("status", str, enum=["Draft", "Posted"]), OpenApiParameter("date_from", OpenApiTypes.DATE), OpenApiParameter("date_to", OpenApiTypes.DATE)]),
    create=extend_schema(request=serializers.DocumentSerializer, responses={201: serializers.DocumentReadSerializer}, examples=[OpenApiExample("Sale draft - replace IDs with your records", value={"kind": "Sale", "customer": 1, "date": "2026-09-07", "discount": "0.00", "items": [{"product": 1, "quantity": 2, "price": "35.00", "tax": "5.00"}]}, request_only=True)]),
    update=extend_schema(request=serializers.DocumentSerializer, responses=serializers.DocumentReadSerializer),
    partial_update=extend_schema(request=serializers.DocumentSerializer, responses=serializers.DocumentReadSerializer),
)
class DocumentViewSet(OwnedViewSet):
    """Sales, purchase orders, and purchase bills. Only drafts may be edited/deleted.

    Use kind to filter the list. Create a draft with products, then POST its post endpoint.
    Posting is atomic and cannot run twice. A purchase order reserves no stock or money.
    """
    queryset = models.Document.objects.prefetch_related("items", "payments", "returns").all()
    serializer_class = serializers.DocumentReadSerializer
    search_fields = ["number", "customer__name", "supplier__name"]
    ordering_fields = ["id", "date", "total", "number"]

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return serializers.DocumentSerializer
        return self.serializer_class

    def perform_destroy(self, instance):
        instance = models.Document.objects.select_for_update().get(pk=instance.pk)
        if instance.status != "Draft":
            raise ValidationError("Posted documents cannot be deleted. Use returns and refunds.")
        instance.delete()

    @extend_schema(request=None, responses=serializers.DocumentReadSerializer)
    @action(detail=True, methods=["post"])
    def post(self, request, pk=None):
        document = services.post_document(workspace(request.user)[0], self.get_object())
        return Response(serializers.DocumentReadSerializer(document).data)

    @extend_schema(request=None, responses={201: serializers.DocumentReadSerializer})
    @action(detail=True, methods=["post"], url_path="convert-to-bill")
    def convert_to_bill(self, request, pk=None):
        document = services.convert_order(workspace(request.user)[0], self.get_object())
        return Response(serializers.DocumentReadSerializer(document).data, status=201)

    @extend_schema(request=serializers.PaymentSerializer, responses={201: serializers.TransactionSerializer})
    @action(detail=True, methods=["post"])
    def payments(self, request, pk=None):
        data = serializers.PaymentSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        document = self.get_object()
        if data.validated_data["date"] < document.date:
            raise ValidationError({"date": "Payment cannot be dated before the document."})
        result = services.record_payment(workspace(request.user)[0], document, **data.validated_data)
        return Response(serializers.TransactionSerializer(result).data, status=201)


@extend_schema_view(list=extend_schema(parameters=[OpenApiParameter("product", int), OpenApiParameter("document", int), OpenApiParameter("kind", str)]))
class StockViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [WorkspacePermission]
    pagination_class = Page
    queryset = models.StockMovement.objects.all()
    serializer_class = serializers.StockSerializer
    filter_backends = [SearchFilter]
    search_fields = ["reason", "product__name", "product__sku"]
    get_queryset = OwnedViewSet.get_queryset

    @extend_schema(request=serializers.StockInputSerializer, responses={201: serializers.StockSerializer})
    def create(self, request):
        """Record Stock In, Stock Out, or an absolute stock Adjustment with a reason."""
        data = serializers.StockInputSerializer(data=request.data, context={"request": request})
        data.is_valid(raise_exception=True)
        result = services.adjust_stock(workspace(request.user)[0], **data.validated_data)
        return Response(self.get_serializer(result).data, status=201)


@extend_schema_view(list=extend_schema(parameters=[OpenApiParameter("document", int), OpenApiParameter("date_from", OpenApiTypes.DATE), OpenApiParameter("date_to", OpenApiTypes.DATE)]))
class ReturnViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Immutable sales/purchase returns. Values come from the original document lines.

    Returns change stock and reduce the amount due. Any resulting credit can be refunded
    through the document payments action with refund=true. Do not resubmit successful returns.
    """
    permission_classes = [WorkspacePermission]
    pagination_class = Page
    queryset = models.Return.objects.prefetch_related("items").all()
    serializer_class = serializers.ReturnSerializer
    get_queryset = OwnedViewSet.get_queryset

    @extend_schema(request=serializers.ReturnInputSerializer, responses={201: serializers.ReturnSerializer})
    def create(self, request):
        data = serializers.ReturnInputSerializer(data=request.data, context={"request": request})
        data.is_valid(raise_exception=True)
        result = services.create_return(workspace(request.user)[0], data.validated_data)
        return Response(self.get_serializer(result).data, status=201)


@extend_schema_view(list=extend_schema(parameters=[OpenApiParameter("category", str), OpenApiParameter("method", str), OpenApiParameter("date_from", OpenApiTypes.DATE), OpenApiParameter("date_to", OpenApiTypes.DATE)]))
class ExpenseViewSet(OwnedViewSet):
    """Expenses are paid immediately. Edits update their linked cash entry; deletion removes both."""
    queryset = models.Expense.objects.all()
    serializer_class = serializers.ExpenseSerializer
    search_fields = ["name", "category", "description"]
    ordering_fields = ["id", "date", "amount"]


@extend_schema_view(list=extend_schema(parameters=[OpenApiParameter("category", str), OpenApiParameter("method", str), OpenApiParameter("document", int), OpenApiParameter("date_from", OpenApiTypes.DATE), OpenApiParameter("date_to", OpenApiTypes.DATE)]))
class TransactionViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Read-only cash register: payments, refunds, paid expenses, and opening balances."""
    permission_classes = [WorkspacePermission]
    pagination_class = Page
    queryset = models.Transaction.objects.all()
    serializer_class = serializers.TransactionSerializer
    get_queryset = OwnedViewSet.get_queryset
    filter_backends = [SearchFilter]
    search_fields = ["name", "category"]

    @extend_schema(request=serializers.OpeningBalanceSerializer, responses={201: serializers.TransactionSerializer})
    @action(detail=False, methods=["post"], url_path="opening-balance")
    @transaction.atomic
    def opening_balance(self, request):
        owner, role = workspace(request.user)
        if role != "Admin":
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only an Admin can set opening balances.")
        data = serializers.OpeningBalanceSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        if models.Transaction.objects.filter(owner=owner, category="Opening balance", method=data.validated_data["method"]).exists():
            raise ValidationError("An opening balance for this method already exists.")
        result = models.Transaction.objects.create(owner=owner, category="Opening balance", **data.validated_data)
        return Response(self.get_serializer(result).data, status=201)


@extend_schema_view(list=extend_schema(parameters=[OpenApiParameter("role", str, enum=["Admin", "Manager", "Staff"]), OpenApiParameter("status", str, enum=["Active", "Inactive"])]))
class UserViewSet(OwnedViewSet):
    """Admin-only team accounts. Creating a user gives access to this workspace.

    Admin manages users/settings, Manager writes business records, Staff creates and updates business records but cannot delete them.
    DELETE deactivates a member; it does not erase their identity or business history.
    Workspace roles do not grant access to Django's administrator site.
    """
    admin_only = True
    queryset = get_user_model().objects.all()
    serializer_class = serializers.UserSerializer
    search_fields = ["username", "first_name", "email"]
    ordering_fields = ["id", "username"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return self.queryset.none()
        owner, _ = workspace(self.request.user)
        query = self.queryset.filter(Q(pk=owner.pk) | Q(workspace_membership__owner=owner))
        state = self.request.query_params.get("status")
        if state:
            if state not in ["Active", "Inactive"]:
                raise ValidationError({"status": "Use Active or Inactive."})
            query = query.filter(is_active=state == "Active")
        role = self.request.query_params.get("role")
        if role:
            if role not in ["Admin", "Manager", "Staff"]:
                raise ValidationError({"role": "Use Admin, Manager, or Staff."})
            query = query.filter(Q(workspace_membership__role=role) | Q(pk=owner.pk)) if role == "Admin" else query.filter(workspace_membership__role=role)
        return query

    def perform_destroy(self, instance):
        owner, _ = workspace(self.request.user)
        if instance.pk in [owner.pk, self.request.user.pk]:
            raise ValidationError("You cannot deactivate yourself or the workspace owner.")
        instance.is_active = False
        instance.save(update_fields=["is_active"])


class SettingsView(APIView):
    permission_classes = [WorkspacePermission]

    @extend_schema(responses=serializers.CompanySerializer)
    def get(self, request):
        instance, _ = models.CompanySettings.objects.get_or_create(owner=workspace(request.user)[0])
        return Response(serializers.CompanySerializer(instance).data)

    @extend_schema(request=serializers.CompanySerializer, responses=serializers.CompanySerializer)
    @transaction.atomic
    def patch(self, request):
        owner, role = workspace(request.user)
        if role != "Admin":
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only an Admin can update company settings.")
        models.CompanySettings.objects.get_or_create(owner=owner)
        instance = models.CompanySettings.objects.select_for_update().get(owner=owner)
        data = serializers.CompanySerializer(instance, data=request.data, partial=True, context={"request": request})
        data.is_valid(raise_exception=True)
        data.save()
        return Response(data.data)


class ReportView(APIView):
    permission_classes = [WorkspacePermission]

    @extend_schema(parameters=[reports.ReportFilters, OpenApiParameter("report", str, OpenApiParameter.PATH, enum=reports.REPORT_NAMES)], responses=reports.ReportResponseSerializer)
    def get(self, request, report):
        """Date-filtered report. Summary covers the full workspace/date range; search affects rows only.

        Customer/supplier balances are cumulative through date_to, ignoring date_from.
        Inventory is current. Results are paged with limit/offset; count is the full result count.
        """
        if report not in reports.REPORT_NAMES:
            from rest_framework.exceptions import NotFound
            raise NotFound("Unknown report.")
        filters = reports.ReportFilters(data=request.query_params)
        filters.is_valid(raise_exception=True)
        return Response(reports.report(workspace(request.user)[0], report, filters.validated_data))


class DashboardView(APIView):
    permission_classes = [WorkspacePermission]

    @extend_schema(parameters=[OpenApiParameter("date_from", OpenApiTypes.DATE), OpenApiParameter("date_to", OpenApiTypes.DATE)], responses=reports.DashboardSerializer)
    def get(self, request):
        """Eight summary metrics, recent documents/payments, low-stock products, monthly sales."""
        filters = reports.ReportFilters(data=request.query_params)
        filters.is_valid(raise_exception=True)
        return Response(reports.dashboard(workspace(request.user)[0], filters.validated_data))


class AccountingView(APIView):
    permission_classes = [WorkspacePermission]

    @extend_schema(parameters=[OpenApiParameter("date_from", OpenApiTypes.DATE), OpenApiParameter("date_to", OpenApiTypes.DATE)], responses=reports.SummarySerializer)
    def get(self, request):
        """Basic cash and balance overview, not a double-entry general ledger."""
        filters = reports.ReportFilters(data=request.query_params)
        filters.is_valid(raise_exception=True)
        return Response(reports.summary(workspace(request.user)[0], filters.validated_data))
