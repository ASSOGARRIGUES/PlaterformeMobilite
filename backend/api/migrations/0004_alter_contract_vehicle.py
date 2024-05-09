# Generated by Django 5.0.3 on 2024-05-08 20:19

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0003_contract_ended_at'),
    ]

    operations = [
        migrations.AlterField(
            model_name='contract',
            name='vehicle',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='contracts', to='api.vehicle'),
        ),
    ]
