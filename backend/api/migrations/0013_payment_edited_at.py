# Generated by Django 5.0.3 on 2024-06-04 20:17

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0012_alter_contract_beneficiary_payment'),
    ]

    operations = [
        migrations.AddField(
            model_name='payment',
            name='edited_at',
            field=models.DateTimeField(auto_now=True),
        ),
    ]