"""Quick test to see how the private key is being loaded"""
from dotenv import load_dotenv
import os

load_dotenv()

api_secret = os.getenv('COINBASE_API_SECRET', '')

print("Raw value from .env:")
print(repr(api_secret))
print("\nLength:", len(api_secret))
print("\nFirst 50 chars:", repr(api_secret[:50]))
print("\nContains literal backslash-n?", '\\n' in api_secret)
print("Contains actual newline?", '\n' in api_secret)
