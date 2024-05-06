# Generated by Django 5.0.3 on 2024-04-06 09:17

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0005_car_fuel_type_car_transmission_car_type_and_more'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='car',
            name='color',
        ),
        migrations.AddField(
            model_name='car',
            name='fleet_id',
            field=models.IntegerField(blank=True, null=True, unique=True),
        ),
        migrations.AlterField(
            model_name='beneficiary',
            name='address_complement',
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
    ]