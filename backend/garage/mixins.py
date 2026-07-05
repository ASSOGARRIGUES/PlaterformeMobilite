class GarageMultiActionMixin:
    """
    Remplace le filtrage standard current_action pour les viewsets garage.
    Si l'utilisateur a garage.view_vehicle, il voit les véhicules de toutes ses Actions.
    Sinon, filtrage standard par current_action.
    """
    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.has_perm('garage.view_vehicle'):
            return qs.filter(vehicle__action__in=user.actions.all())
        return qs.filter(vehicle__action=user.current_action)
