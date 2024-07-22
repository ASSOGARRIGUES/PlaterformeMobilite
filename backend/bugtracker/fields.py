import filetype
from drf_extra_fields.fields import Base64FileField


class Base64TextFileField(Base64FileField):
    """
       A custom serializer field to handle base64-encoded plain text files.
    """
    ALLOWED_MIME_TYPES = {
        'text/plain': 'txt',
    }

    ALLOWED_TYPES = ['txt', 'logs']

    def get_file_extension(self, filename, decoded_file):
        return "txt"

    def to_internal_value(self, data):
        if isinstance(data, str):
            return super().to_internal_value(data)
        return data
