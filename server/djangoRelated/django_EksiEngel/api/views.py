from django.db.models import Count, Exists, OuterRef, Q
from rest_framework import generics
from rest_framework import views, status
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from django.http import HttpResponse
from .serializers import CollectActionDataSerializer, EksiSozlukUserStatViewSerializer, MostBannedUsersSerializer, MostBannedUsersUniqueSerializer
from .models import Action, ActionConfig, EksiSozlukUser

class WhereIsEksiSozlukView(views.APIView):
    permission_classes = [AllowAny]

    def get(self, request, format=None):
        return HttpResponse("https://eksisozluk1923.com")
        
class CollectActionDataView(views.APIView):
    permission_classes = [AllowAny]
    
    # for debug
    def get(self, request, format=None):
        serializer = CollectActionDataSerializer(None, many=False)
        return Response(serializer.data)
        
    def post(self, request, format=None):
        serializer = CollectActionDataSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class MostBannedUsersUniqueView(generics.ListAPIView):
    permission_classes = [AllowAny]
    
    serializer_class = MostBannedUsersUniqueSerializer
    
    def get_queryset(self):
        return EksiSozlukUser.objects.annotate(banned_by_unique_count=Count('author_list_in_action__eksi_engel_user', distinct=True,  filter=Q(author_list_in_action__ban_mode__ban_mode='BAN'))).order_by('-banned_by_unique_count')

class MostBannedUsersView(generics.ListAPIView):
    permission_classes = [AllowAny]
    
    serializer_class = MostBannedUsersSerializer
    
    def get_queryset(self):
        return EksiSozlukUser.objects.annotate(banned_by_count=Count('author_list_in_action', distinct=False,  filter=Q(author_list_in_action__ban_mode__ban_mode='BAN'))).order_by('-banned_by_count')
        
        """
        
         EksiSozlukUser.objects     
        .annotate(action_for_ban_count=Count('action__eksi_engel_user', distinct=False))
        .annotate(target_author_for_ban_count=Count('action__author_list', distinct=False))
        .annotate(unique_target_author_for_ban_count=Count('action__author_list', distinct=True))
        .annotate(banned_by_count=
            Count('author_list_in_action', 
                distict=False,
                filter=Q(author_list_in_action__ban_mode__ban_mode='BAN')
            )
        )
        .annotate(banned_by_unique_count=
            Count('author_list_in_action__eksi_engel_user', 
                distinct=True,
                filter=Q(author_list_in_action__ban_mode__ban_mode='BAN')
            )
         )
        """         

class EksiSozlukUserStatView(generics.ListAPIView):
    permission_classes = [AllowAny]

    serializer_class = EksiSozlukUserStatViewSerializer
    queryset = EksiSozlukUser.objects.all()
