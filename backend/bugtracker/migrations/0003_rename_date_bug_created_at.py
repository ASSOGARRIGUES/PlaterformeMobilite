# Generated by Django 5.0.3 on 2024-07-21 13:37

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('bugtracker', '0002_remove_bug_title_bug_severity_alter_bug_status_and_more'),
    ]

    operations = [
        migrations.RenameField(
            model_name='bug',
            old_name='date',
            new_name='created_at',
        ),
    ]