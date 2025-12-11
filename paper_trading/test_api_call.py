"""Test the actual Coinbase API call with JWT"""
import asyncio
import time
import uuid
import httpx
from dotenv import load_dotenv
import os
import jwt as pyjwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

load_dotenv()

async def test_api_call():
    # Load credentials
    api_key = os.getenv('COINBASE_API_KEY', '')
    api_secret = os.getenv('COINBASE_API_SECRET', '')

    print(f"API Key: {api_key}")
    print(f"API Key length: {len(api_key)}")

    # Process secret
    if '\\n' in api_secret:
        api_secret = api_secret.replace('\\n', '\n')

    # Load private key
    private_key = serialization.load_pem_private_key(
        api_secret.encode(),
        password=None,
        backend=default_backend()
    )
    print("✓ Private key loaded\n")

    # Generate JWT
    request_method = 'GET'
    request_path = '/api/v3/brokerage/best_bid_ask?product_ids=BTC-USD'

    uri = f"{request_method} api.coinbase.com{request_path}"
    now = int(time.time())

    payload = {
        'sub': api_key,
        'iss': 'coinbase-cloud',
        'nbf': now,
        'exp': now + 120,
        'aud': ['cdp_service'],
        'uri': uri
    }

    print("JWT Payload:")
    for key, value in payload.items():
        print(f"  {key}: {value}")

    nonce = str(uuid.uuid4())
    headers_jwt = {'kid': api_key, 'nonce': nonce}

    print(f"\nJWT Headers:")
    print(f"  kid: {api_key}")
    print(f"  nonce: {nonce}")

    token = pyjwt.encode(
        payload,
        private_key,
        algorithm='ES256',
        headers=headers_jwt
    )

    print(f"\n✓ JWT Token generated (length: {len(token)})")
    print(f"Token (first 50 chars): {token[:50]}...\n")

    # Make API request
    url = f"https://api.coinbase.com{request_path}"
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }

    print("="*60)
    print("Making API request...")
    print(f"URL: {url}")
    print(f"Method: {request_method}")
    print(f"Authorization: Bearer {token[:30]}...")
    print("="*60 + "\n")

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(url, headers=headers)

            print(f"Response Status: {response.status_code}")
            print(f"Response Headers: {dict(response.headers)}")

            if response.status_code == 200:
                print("\n✓ SUCCESS!")
                data = response.json()
                print(f"Response data: {data}")
            else:
                print(f"\n✗ FAILED with status {response.status_code}")
                print(f"Response body: {response.text}")

        except Exception as e:
            print(f"\n✗ Exception occurred: {e}")

if __name__ == "__main__":
    asyncio.run(test_api_call())
