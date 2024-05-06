# Generated by Django 5.0.3 on 2024-04-07 00:34

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0010_alter_contract_created_by'),
    ]

    operations = [
        migrations.AddField(
            model_name='contract',
            name='comment',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='contract',
            name='discount',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='contract',
            name='reason',
            field=models.TextField(blank=True, choices=[('CDD', 'CDD'), ('CDI', 'CDI'), ('Formation', 'Formation'), ('Intérim', 'Intérim'), ('Contrat aidé', 'Contrat aidé'), ('Recherche d’emploi', 'Recherche d’emploi'), ('Alternance', 'Alternance')], null=True),
        ),
    ]