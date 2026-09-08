from django.urls import path
from . import views

urlpatterns = [
    path("session/", views.session),
    path("signup/", views.signup),
    path("login/", views.signin),
    path("logout/", views.signout),
]
