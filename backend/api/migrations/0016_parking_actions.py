# Generated by Django 5.0.3 on 2024-09-15 22:35

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0015_beneficiary_action_contract_action_vehicle_action'),
        ('core', '0004_rename_actions_action'),
    ]

    operations = [
        migrations.AddField(
            model_name='parking',
            name='actions',
            field=models.ManyToManyField(blank=True, related_name='parkings', to='core.action'),
        ),
    ]
