from rest_framework.authentication import SessionAuthentication
from rest_framework.parsers import JSONParser
from operations.permissions import WorkspacePermission, workspace
from rest_framework.filters import SearchFilter
from rest_framework.renderers import JSONRenderer
from rest_framework.viewsets import ModelViewSet

from .models import Customer
from .serializers import CustomerSerializer


class CustomerViewSet(ModelViewSet):
    """Session-authenticated customer records scoped to their owner."""

    queryset = Customer.objects.none()
    filter_backends = [SearchFilter]
    search_fields = ["name", "email", "phone"]

    authentication_classes = [SessionAuthentication]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Customer.objects.none()
        query = Customer.objects.filter(owner=workspace(self.request.user)[0]).order_by("id")
        if self.request.query_params.get("status"):
            query = query.filter(status=self.request.query_params["status"])
        return query

    def perform_create(self, serializer):
        serializer.save(owner=workspace(self.request.user)[0])
    serializer_class = CustomerSerializer
    permission_classes = [WorkspacePermission]
    parser_classes = [JSONParser]
    renderer_classes = [JSONRenderer]
