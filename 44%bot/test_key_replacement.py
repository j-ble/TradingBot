"""Test if the key replacement is working correctly"""
from dotenv import load_dotenv
import os
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

load_dotenv()

api_secret = os.getenv('COINBASE_API_SECRET', '')

print("BEFORE replacement:")
print(repr(api_secret[:60]))

# This is what the code does in price_feed.py
if '\\n' in api_secret:
    api_secret = api_secret.replace('\\n', '\n')

print("\nAFTER replacement:")
print(repr(api_secret[:60]))
print("\nNow contains actual newline?", '\n' in api_secret)

# Try to load the key
print("\n" + "="*60)
print("Attempting to load private key...")
try:
    private_key = serialization.load_pem_private_key(
        api_secret.encode(),
        password=None,
        backend=default_backend()
    )
    print("✓ SUCCESS! Private key loaded correctly.")
except Exception as e:
    print(f"✗ FAILED: {e}")
    print("\nKey content (first 100 chars):")
    print(api_secret[:100])
