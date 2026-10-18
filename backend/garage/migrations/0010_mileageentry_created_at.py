from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('garage', '0009_data_mileage_migration'),
    ]

    operations = [
        migrations.AddField(
            model_name='mileageentry',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True, null=True),
        ),
    ]
