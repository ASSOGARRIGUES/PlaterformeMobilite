from rest_framework import serializers

from .models import InAppBroadcast


class InAppBroadcastSerializer(serializers.ModelSerializer):
    class Meta:
        model = InAppBroadcast
        fields = '__all__'


# Register a BroadcastViewedSerializer that will be used to tell the user saw the broadcast.
# The user will simply send a post request with the id of the broadcast he viewed.
class BroadcastViewedSerializer(serializers.Serializer):
    broadcast_id = serializers.IntegerField()

    def validate_broadcast_id(self, value):
        try:
            InAppBroadcast.objects.get(id=value)
        except InAppBroadcast.DoesNotExist:
            raise serializers.ValidationError("Broadcast not found")
        return value

    def save(self):
        broadcast = InAppBroadcast.objects.get(id=self.validated_data['broadcast_id'])
        user = self.context['request'].user
        broadcast.viewedBy.add(user)
        broadcast.save()
        return broadcast
