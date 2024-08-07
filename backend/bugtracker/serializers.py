from rest_framework import serializers

from .fields import Base64TextFileField
from .models import Bug
from api.serializers import UserSerializer


class BugSerializer(serializers.ModelSerializer):
    logfile = Base64TextFileField(required=False)
    reporter = UserSerializer(read_only=True)
    class Meta:
        model = Bug
        fields = '__all__'

    def create(self, validated_data):
        validated_data['reporter'] = self.context['request'].user
        return super().create(validated_data)

