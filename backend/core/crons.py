from django.core import management

def dbBackup():
    try:
        management.call_command('dbbackup')
    except Exception as e:
        print(e)
        print("Error in dbBackup")