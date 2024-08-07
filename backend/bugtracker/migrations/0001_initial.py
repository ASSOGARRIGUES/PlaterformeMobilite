# Generated by Django 5.0.3 on 2024-07-20 18:29

from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Bug',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('description', models.TextField()),
                ('reproduction_steps', models.TextField(blank=True, null=True)),
                ('targeted_version', models.CharField(max_length=200)),
                ('logfile', models.FileField(blank=True, null=True, upload_to='logs/')),
                ('date', models.DateTimeField(auto_now_add=True)),
                ('type', models.CharField(choices=[('B', 'Bug'), ('F', 'Feature'), ('O', 'Suggestions')], default='B', max_length=1)),
                ('status', models.CharField(choices=[('O', 'Open'), ('C', 'Closed'), ('P', 'Pending')], default='O', max_length=1)),
                ('resolve_version', models.CharField(blank=True, max_length=200, null=True)),
            ],
        ),
    ]
