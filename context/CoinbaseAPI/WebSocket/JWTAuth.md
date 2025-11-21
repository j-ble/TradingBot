# JWT Authentication

A JSON Web Token (JWT) is a secure method of authenticating API calls used by Coinbase Developer Platform. They combine encryption and access management in a single token, offering a robust security layer compared to traditional API keys.

## Generating a JWT

Regardless of which code snippet you use, follow these steps:

1. Replace `key name` and `key secret` with your key name and private key. `key secret` is a multi-line key and newlines must be preserved to properly parse the key. Do this on one line with `\n` escaped newlines, or with a multi-line string.
2. Update the `request_path` and `request_host or url` variables as needed depending on which endpoint is being targeted.
3. Run the generation script that prints the command `export JWT=...`.
4. Run the generated command to save your JWT.

> **Warning:** Your JWT expires after 2 minutes, after which all requests are unauthenticated.

### Code samples for Ed25519 Keys

These code samples are for Ed25519 Signature algorithm keys.

#### JavaScript

First, install the CDP SDK:

```bash
npm install @coinbase/cdp-sdk
```

Create a new file for JWT generation code:

```javascript
const { generateJwt } = require("@coinbase/cdp-sdk/auth");

const main = async () => {
  // Generate the JWT using the CDP SDK
  const token = await generateJwt({
    apiKeyId: process.env.KEY_NAME,
    apiKeySecret: process.env.KEY_SECRET,
    requestMethod: process.env.REQUEST_METHOD,
    requestHost: process.env.REQUEST_HOST,
    requestPath: process.env.REQUEST_PATH,
    expiresIn: 120 // optional (defaults to 120 seconds)
  });

  console.log(token);
};

main();
```

Finally, run the script to generate the JWT output and export it as an environment variable:

```bash
export JWT=$(node main.js)
echo $JWT
```

#### TypeScript

First, install the CDP SDK:

```bash
npm install @coinbase/cdp-sdk
```

Create a new file for JWT generation code:

```typescript
import { generateJwt } from "@coinbase/cdp-sdk/auth";

const main = async () => {
    // Generate the JWT using the CDP SDK
    const token = await generateJwt({
        apiKeyId: process.env.KEY_NAME!,
        apiKeySecret: process.env.KEY_SECRET!,
        requestMethod: process.env.REQUEST_METHOD!,
        requestHost: process.env.REQUEST_HOST!,
        requestPath: process.env.REQUEST_PATH!,
        expiresIn: 120 // optional (defaults to 120 seconds)
    });

    console.log(token);
};

main();
```

Finally, run the script to generate the JWT output and export it as an environment variable:

```bash
export JWT=$(npx tsx main.ts)
echo $JWT
```

#### Python

First, install the CDP SDK:

```bash
pip install cdp-sdk
```

Create a new file for JWT generation code:

```python
import os
from cdp.auth.utils.jwt import generate_jwt, JwtOptions

# Generate the JWT using the CDP SDK
jwt_token = generate_jwt(JwtOptions(
    api_key_id=os.getenv('KEY_NAME'),
    api_key_secret=os.getenv('KEY_SECRET'),
    request_method=os.getenv('REQUEST_METHOD'),
    request_host=os.getenv('REQUEST_HOST'),
    request_path=os.getenv('REQUEST_PATH'),
    expires_in=120  # optional (defaults to 120 seconds)
))

print(jwt_token)
```

Finally, run the script to generate the JWT output and export it as an environment variable:

```bash
export JWT=$(python main.py)
echo $JWT
```

#### Go

First, install the CDP SDK:

```bash
go mod init jwt-example
go get github.com/coinbase/cdp-sdk/go
```

Create a new file for JWT generation code:

```go
package main

import (
    "fmt"
    "log"
    "os"

    "github.com/coinbase/cdp-sdk/go/auth"
)

func main() {
    // Generate the JWT using the CDP SDK
    jwt, err := auth.GenerateJWT(auth.JwtOptions{
        KeyID:         os.Getenv("KEY_NAME"),
        KeySecret:     os.Getenv("KEY_SECRET"),
        RequestMethod: os.Getenv("REQUEST_METHOD"),
        RequestHost:   os.Getenv("REQUEST_HOST"),
        RequestPath:   os.Getenv("REQUEST_PATH"),
        ExpiresIn:     120, // optional (defaults to 120 seconds)
    })
    if err != nil {
        log.Fatalf("error building jwt: %v", err)
    }

    fmt.Println(jwt)
}
```

Finally, run the script to generate the JWT output and export it as an environment variable:

```bash
export JWT=$(go run main.go)
echo $JWT
```

#### Ruby

First, install required dependencies:

```bash
gem install jwt
gem install ed25519
```

Create a new file for JWT generation code:

```ruby
require 'jwt'
require 'ed25519'
require 'base64'
require 'time'
require 'securerandom'

# Fetching environment variables
key_name = ENV['KEY_NAME']
key_secret = ENV['KEY_SECRET']
request_method = ENV['REQUEST_METHOD']
request_host = ENV['REQUEST_HOST']
request_path = ENV['REQUEST_PATH']

def build_jwt(key_name, key_secret, uri)
  # Decode the Ed25519 private key from base64
  decoded = Base64.decode64(key_secret)

  # Ed25519 keys are 64 bytes (32 bytes seed + 32 bytes public key)
  if decoded.length != 64
    raise "Invalid Ed25519 key length"
  end

  # Extract the seed (first 32 bytes)
  seed = decoded[0, 32]
  signing_key = Ed25519::SigningKey.new(seed)

  # Header for the JWT
  header = {
    alg: 'EdDSA',
    typ: 'JWT',
    kid: key_name,
    nonce: SecureRandom.hex(16)
  }

  # Claims for the JWT
  claims = {
    sub: key_name,
    iss: 'cdp',
    aud: ['cdp_service'],
    nbf: Time.now.to_i,
    exp: Time.now.to_i + 120, # Expiration time: 2 minute from now.
    uri: uri
  }

  # Encode the JWT with EdDSA algorithm
  JWT.encode(claims, signing_key, 'EdDSA', header)
end

# Build the JWT with the URI
token = build_jwt(key_name, key_secret, "#{request_method.upcase} #{request_host}#{request_path}")

# Print the JWT token
puts token
```

Finally, run the script to generate the JWT output and export it as an environment variable:

```bash
export JWT=$(ruby main.rb)
echo $JWT
```

#### PHP

First, ensure the Sodium extension is enabled (included by default in PHP 7.2+):

```bash
# Ensure the sodium extension is enabled
php -m | grep sodium
```

Create a new file for JWT generation code:

```php
<?php
function buildJwt() {
    // Fetching values directly from environment variables
    $keyName = getenv('KEY_NAME');
    $keySecret = getenv('KEY_SECRET');
    $requestMethod = getenv('REQUEST_METHOD');
    $requestHost = getenv('REQUEST_HOST');
    $requestPath = getenv('REQUEST_PATH');

    // Ensure that the environment variables are set
    if (!$keyName || !$keySecret || !$requestMethod || !$requestHost || !$requestPath) {
        throw new Exception('Required environment variables are missing');
    }

    // Decode the Ed25519 private key from base64
    $decoded = base64_decode($keySecret);

    // Ed25519 keys are 64 bytes (32 bytes seed + 32 bytes public key)
    if (strlen($decoded) != 64) {
        throw new Exception('Invalid Ed25519 key length');
    }

    // Extract the seed (first 32 bytes) - this is the actual private key for sodium
    $privateKey = substr($decoded, 0, 32);

    // Constructing the URI from method, host, and path
    $uri = $requestMethod . ' ' . $requestHost . $requestPath;

    // Setting the current time and creating a unique nonce
    $time = time();
    $nonce = substr(str_replace(['+', '/', '='], '', base64_encode(random_bytes(12))), 0, 16);

    // JWT Header
    $header = [
        'alg' => 'EdDSA',
        'typ' => 'JWT',
        'kid' => $keyName,
        'nonce' => $nonce
    ];

    // JWT Payload
    $payload = [
        'sub' => $keyName,
        'iss' => 'cdp',
        'aud' => ['cdp_service'],
        'nbf' => $time,
        'exp' => $time + 120,  // Token valid for 120 seconds from now
        'uri' => $uri
    ];

    // Encode header and payload
    $encodedHeader = rtrim(strtr(base64_encode(json_encode($header)), '+/', '-_'), '=');
    $encodedPayload = rtrim(strtr(base64_encode(json_encode($payload)), '+/', '-_'), '=');

    // Create the message to sign
    $message = $encodedHeader . '.' . $encodedPayload;

    // Sign with Ed25519 using sodium
    $signature = sodium_crypto_sign_detached($message, $privateKey);

    // Encode signature
    $encodedSignature = rtrim(strtr(base64_encode($signature), '+/', '-_'), '=');

    // Create the JWT
    return $message . '.' . $encodedSignature;
}

// Example of calling the function to generate the JWT
try {
    $jwt = buildJwt();
    echo $jwt . "\n";
} catch (Exception $e) {
    echo "Error generating JWT: " . $e->getMessage() . "\n";
}
```

Finally, run the script to generate the JWT output and export it as an environment variable:

```bash
export JWT=$(php main.php)
echo $JWT
```

#### Java

First, install required dependencies:

```xml
<!-- Add this to your pom.xml -->
<dependency>
    <groupId>com.nimbusds</groupId>
    <artifactId>nimbus-jose-jwt</artifactId>
    <version>9.31</version>
</dependency>
```

Create a new file for JWT generation code:

```java
import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.*;
import com.nimbusds.jwt.*;
import java.util.Date;
import java.util.UUID;
import java.util.Base64;

public class Main {
    public static void main(String[] args) throws Exception {
        // Load environment variables
        String keySecret = System.getenv("KEY_SECRET");
        String keyName = System.getenv("KEY_NAME");
        String requestMethod = System.getenv("REQUEST_METHOD");
        String requestHost = System.getenv("REQUEST_HOST");
        String requestPath = System.getenv("REQUEST_PATH");

        // Ensure all environment variables are provided
        if (keySecret == null || keyName == null || requestMethod == null || requestHost == null || requestPath == null) {
            throw new IllegalArgumentException("Required environment variables are missing");
        }

        // Decode the Ed25519 private key from base64
        byte[] decoded = Base64.getDecoder().decode(keySecret);

        // Ed25519 keys are 64 bytes (32 bytes seed + 32 bytes public key)
        if (decoded.length != 64) {
            throw new Exception("Invalid Ed25519 key length");
        }

        // Extract the seed (first 32 bytes) and public key (last 32 bytes)
        byte[] seed = new byte[32];
        byte[] publicKey = new byte[32];
        System.arraycopy(decoded, 0, seed, 0, 32);
        System.arraycopy(decoded, 32, publicKey, 0, 32);

        // Create OctetKeyPair for Ed25519
        OctetKeyPair okp = new OctetKeyPair.Builder(Curve.Ed25519, Base64.getUrlEncoder().withoutPadding().encodeToString(publicKey))
            .d(Base64.getUrlEncoder().withoutPadding().encodeToString(seed))
            .keyUse(KeyUse.SIGNATURE)
            .build();

        // Create URI string for current request
        String uri = requestMethod + " " + requestHost + requestPath;

        // Create JWT claims
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
            .issuer("cdp")
            .subject(keyName)
            .notBeforeTime(new Date())
            .expirationTime(new Date(System.currentTimeMillis() + 120000)) // 120 seconds
            .claim("uri", uri)
            .build();

        // Create JWT header with nonce
        JWSHeader header = new JWSHeader.Builder(JWSAlgorithm.EdDSA)
            .keyID(keyName)
            .customParam("nonce", UUID.randomUUID().toString().replace("-", ""))
            .build();

        // Sign the JWT
        SignedJWT signedJWT = new SignedJWT(header, claims);
        JWSSigner signer = new Ed25519Signer(okp);
        signedJWT.sign(signer);

        String jwt = signedJWT.serialize();
        System.out.println(jwt);
    }
}
```

Finally, compile the script and export the JWT output as an environment variable:

```bash
javac -cp "nimbus-jose-jwt-9.31.jar:." Main.java
export JWT=$(java -cp "nimbus-jose-jwt-9.31.jar:." Main)
echo $JWT
```

#### C++

First, install required dependencies:

```bash
# For Ubuntu/Debian
sudo apt-get install libsodium-dev nlohmann-json3-dev

# For MacOS
brew install libsodium nlohmann-json
```

Create a new file for JWT generation code:

```cpp
#include <iostream>
#include <sstream>
#include <string>
#include <cstdlib>
#include <cstring>
#include <chrono>
#include <random>
#include <sodium.h>
#include <nlohmann/json.hpp>

// Base64 URL encoding helper
std::string base64url_encode(const unsigned char* data, size_t len) {
    static const char* base64_chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

    std::string encoded;
    encoded.reserve(((len + 2) / 3) * 4);

    for (size_t i = 0; i < len; i += 3) {
        unsigned int octet1 = data[i];
        unsigned int octet2 = (i + 1 < len) ? data[i + 1] : 0;
        unsigned int octet3 = (i + 2 < len) ? data[i + 2] : 0;

        unsigned int combined = (octet1 << 16) | (octet2 << 8) | octet3;

        encoded += base64_chars[(combined >> 18) & 0x3F];
        encoded += base64_chars[(combined >> 12) & 0x3F];
        if (i + 1 < len) encoded += base64_chars[(combined >> 6) & 0x3F];
        if (i + 2 < len) encoded += base64_chars[combined & 0x3F];
    }

    return encoded;
}

// Base64 decode helper
std::vector<unsigned char> base64_decode(const std::string& encoded) {
    static const unsigned char base64_table[256] = {
        64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64,
        64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64,
        64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 62, 64, 64, 64, 63,
        52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 64, 64, 64, 64, 64, 64,
        64,  0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14,
        15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 64, 64, 64, 64, 64,
        64, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
        41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 64, 64, 64, 64, 64,
        64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64,
        64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64,
        64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64,
        64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64,
        64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64,
        64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64, 64
    };

    std::vector<unsigned char> decoded;
    decoded.reserve((encoded.length() * 3) / 4);

    for (size_t i = 0; i < encoded.length(); ) {
        unsigned char c1 = base64_table[static_cast<unsigned char>(encoded[i++])];
        unsigned char c2 = base64_table[static_cast<unsigned char>(encoded[i++])];
        unsigned char c3 = (i < encoded.length()) ? base64_table[static_cast<unsigned char>(encoded[i++])] : 64;
        unsigned char c4 = (i < encoded.length()) ? base64_table[static_cast<unsigned char>(encoded[i++])] : 64;

        if (c1 == 64 || c2 == 64) break;

        decoded.push_back((c1 << 2) | (c2 >> 4));
        if (c3 != 64) decoded.push_back((c2 << 4) | (c3 >> 2));
        if (c4 != 64) decoded.push_back((c3 << 6) | c4);
    }

    return decoded;
}

std::string create_jwt() {
    // Initialize libsodium
    if (sodium_init() < 0) {
        throw std::runtime_error("Failed to initialize libsodium");
    }

    // Fetching environment variables
    const char* key_name_env = std::getenv("KEY_NAME");
    const char* key_secret_env = std::getenv("KEY_SECRET");
    const char* request_method_env = std::getenv("REQUEST_METHOD");
    const char* request_host_env = std::getenv("REQUEST_HOST");
    const char* request_path_env = std::getenv("REQUEST_PATH");

    // Ensure all environment variables are present
    if (!key_name_env || !key_secret_env || !request_method_env || !request_host_env || !request_path_env) {
        throw std::runtime_error("Missing required environment variables");
    }

    std::string key_name = key_name_env;
    std::string key_secret = key_secret_env;
    std::string request_method = request_method_env;
    std::string request_host = request_host_env;
    std::string request_path = request_path_env;

    // Decode the Ed25519 private key from base64
    std::vector<unsigned char> decoded = base64_decode(key_secret);

    // Ed25519 keys are 64 bytes (32 bytes seed + 32 bytes public key)
    if (decoded.size() != 64) {
        throw std::runtime_error("Invalid Ed25519 key length");
    }

    // Extract the seed (first 32 bytes)
    unsigned char private_key[32];
    std::memcpy(private_key, decoded.data(), 32);

    std::string uri = request_method + " " + request_host + request_path;

    // Generate a random nonce (16 digits)
    std::random_device rd;
    std::mt19937 gen(rd());
    std::uniform_int_distribution<> dis(0, 9);
    std::string nonce;
    for (int i = 0; i < 16; ++i) {
        nonce += std::to_string(dis(gen));
    }

    // Get current timestamp
    auto now = std::chrono::system_clock::now();
    auto now_seconds = std::chrono::duration_cast<std::chrono::seconds>(now.time_since_epoch()).count();

    // Create JWT header
    nlohmann::json header = {
        {"alg", "EdDSA"},
        {"typ", "JWT"},
        {"kid", key_name},
        {"nonce", nonce}
    };

    // Create JWT payload
    nlohmann::json payload = {
        {"sub", key_name},
        {"iss", "cdp"},
        {"aud", nlohmann::json::array({"cdp_service"})},
        {"nbf", now_seconds},
        {"exp", now_seconds + 120},
        {"uri", uri}
    };

    // Encode header and payload
    std::string header_json = header.dump();
    std::string payload_json = payload.dump();

    std::string encoded_header = base64url_encode(
        reinterpret_cast<const unsigned char*>(header_json.c_str()),
        header_json.length()
    );
    std::string encoded_payload = base64url_encode(
        reinterpret_cast<const unsigned char*>(payload_json.c_str()),
        payload_json.length()
    );

    // Create message to sign
    std::string message = encoded_header + "." + encoded_payload;

    // Sign with Ed25519
    unsigned char signature[crypto_sign_BYTES];
    crypto_sign_detached(signature, nullptr,
        reinterpret_cast<const unsigned char*>(message.c_str()), message.length(),
        private_key);

    // Encode signature
    std::string encoded_signature = base64url_encode(signature, crypto_sign_BYTES);

    // Return complete JWT
    return message + "." + encoded_signature;
}

int main() {
    try {
        std::string token = create_jwt();
        std::cout << token << std::endl;
    } catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << std::endl;
        return 1;
    }
    return 0;
}
```

Finally, compile the script and export the JWT output as an environment variable:

```bash
g++ main.cpp -o myapp -lsodium -std=c++17
export JWT=$(./myapp)
echo $JWT
```

#### C#

First, install required dependencies:

```bash
dotnet add package System.IdentityModel.Tokens.Jwt
dotnet add package BouncyCastle.NetCore
dotnet add package Microsoft.IdentityModel.Tokens
dotnet add package Newtonsoft.Json
```

Create a new file for JWT generation code:

```csharp
using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;
using Org.BouncyCastle.Crypto.Parameters;
using Org.BouncyCastle.Crypto.Signers;
using Newtonsoft.Json;

namespace BearerJWT
{
    internal class Program
    {
        static void Main(string[] args)
        {
            // Get environment variables
            string keyName = Environment.GetEnvironmentVariable("KEY_NAME");
            string keySecret = Environment.GetEnvironmentVariable("KEY_SECRET");
            string requestMethod = Environment.GetEnvironmentVariable("REQUEST_METHOD");
            string requestHost = Environment.GetEnvironmentVariable("REQUEST_HOST");
            string requestPath = Environment.GetEnvironmentVariable("REQUEST_PATH");

            // Validate environment variables
            if (string.IsNullOrEmpty(keyName) || string.IsNullOrEmpty(keySecret) ||
                string.IsNullOrEmpty(requestMethod) || string.IsNullOrEmpty(requestHost) ||
                string.IsNullOrEmpty(requestPath))
            {
                throw new InvalidOperationException("Missing required environment variables");
            }

            string token = GenerateBearerJWT(keyName, keySecret, requestMethod, requestHost, requestPath);
            Console.WriteLine(token);
        }

        static string GenerateBearerJWT(string keyName, string keySecret, string requestMethod,
            string requestHost, string requestPath)
        {
            // Decode the Ed25519 private key from base64
            byte[] decoded = Convert.FromBase64String(keySecret);

            // Ed25519 keys are 64 bytes (32 bytes seed + 32 bytes public key)
            if (decoded.Length != 64)
            {
                throw new Exception("Invalid Ed25519 key length");
            }

            // Extract the seed (first 32 bytes)
            byte[] seed = new byte[32];
            Array.Copy(decoded, 0, seed, 0, 32);

            // Create Ed25519 private key parameters
            var privateKey = new Ed25519PrivateKeyParameters(seed, 0);

            // Create the URI
            string uri = $"{requestMethod} {requestHost}{requestPath}";

            // Create header
            var header = new Dictionary<string, object>
            {
                { "alg", "EdDSA" },
                { "typ", "JWT" },
                { "kid", keyName },
                { "nonce", GenerateNonce() }
            };

            // Create payload with timing
            var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            var payload = new Dictionary<string, object>
            {
                { "sub", keyName },
                { "iss", "cdp" },
                { "aud", new[] { "cdp_service" } },
                { "nbf", now },
                { "exp", now + 120 }, // 2 minutes expiration
                { "uri", uri }
            };

            // Encode header and payload
            string headerJson = JsonConvert.SerializeObject(header);
            string payloadJson = JsonConvert.SerializeObject(payload);

            string encodedHeader = Base64UrlEncode(Encoding.UTF8.GetBytes(headerJson));
            string encodedPayload = Base64UrlEncode(Encoding.UTF8.GetBytes(payloadJson));

            string message = $"{encodedHeader}.{encodedPayload}";

            // Sign with Ed25519
            var signer = new Ed25519Signer();
            signer.Init(true, privateKey);
            byte[] messageBytes = Encoding.UTF8.GetBytes(message);
            signer.BlockUpdate(messageBytes, 0, messageBytes.Length);
            byte[] signature = signer.GenerateSignature();

            string encodedSignature = Base64UrlEncode(signature);

            return $"{message}.{encodedSignature}";
        }

        // Method to generate a dynamic nonce
        static string GenerateNonce()
        {
            var random = new Random();
            var nonce = new char[16];
            for (int i = 0; i < 16; i++)
            {
                nonce[i] = (char)('0' + random.Next(10));
            }
            return new string(nonce);
        }

        // Base64 URL encoding without padding
        static string Base64UrlEncode(byte[] input)
        {
            return Convert.ToBase64String(input)
                .Replace("+", "-")
                .Replace("/", "_")
                .Replace("=", "");
        }
    }
}
```

Finally, build and run the project to generate the JWT output and export it as an environment variable:

```bash
dotnet build
export JWT=$(dotnet run)
echo $JWT
```

### Code samples for ECDSA Keys

> **Note:** ECDSA is a legacy key algorithm. You should use **Ed25519** instead. Choose **ECDSA** only when required by the Coinbase App SDK or Advanced Trade SDK.

The easiest way to generate a JWT is to use the built-in functions in our SDKs.

#### Python

First, install the CDP SDK:

```bash
pip install cdp-sdk
```

Create a new file for JWT generation code:

```python
import os
from cdp.auth.utils.jwt import generate_jwt, JwtOptions

# Generate the JWT using the CDP SDK
jwt_token = generate_jwt(JwtOptions(
    api_key_id=os.getenv('KEY_NAME'),
    api_key_secret=os.getenv('KEY_SECRET'),
    request_method=os.getenv('REQUEST_METHOD'),
    request_host=os.getenv('REQUEST_HOST'),
    request_path=os.getenv('REQUEST_PATH'),
    expires_in=120  # optional (defaults to 120 seconds)
))

print(jwt_token)
```

Finally, run the script to generate the JWT output and export it as an environment variable:

```bash
export JWT=$(python main.py)
echo $JWT
```

#### JavaScript

First, install the CDP SDK:

```bash
npm install @coinbase/cdp-sdk
```

Create a new file for JWT generation code:

```javascript
const { generateJwt } = require("@coinbase/cdp-sdk/auth");

const main = async () => {
  // Generate the JWT using the CDP SDK
  const token = await generateJwt({
    apiKeyId: process.env.KEY_NAME,
    apiKeySecret: process.env.KEY_SECRET,
    requestMethod: process.env.REQUEST_METHOD,
    requestHost: process.env.REQUEST_HOST,
    requestPath: process.env.REQUEST_PATH,
    expiresIn: 120 // optional (defaults to 120 seconds)
  });

  console.log(token);
};

main();
```

Finally, run the script to generate the JWT output and export it as an environment variable:

```bash
export JWT=$(node main.js)
echo $JWT
```

#### TypeScript

First, install the CDP SDK:

```bash
npm install @coinbase/cdp-sdk
```

Create a new file for JWT generation code:

```typescript
import { generateJwt } from "@coinbase/cdp-sdk/auth";

const main = async () => {
    // Generate the JWT using the CDP SDK
    const token = await generateJwt({
        apiKeyId: process.env.KEY_NAME!,
        apiKeySecret: process.env.KEY_SECRET!,
        requestMethod: process.env.REQUEST_METHOD!,
        requestHost: process.env.REQUEST_HOST!,
        requestPath: process.env.REQUEST_PATH!,
        expiresIn: 120 // optional (defaults to 120 seconds)
    });

    console.log(token);
};

main();
```

Finally, run the script to generate the JWT output and export it as an environment variable:

```bash
export JWT=$(npx tsx main.ts)
echo $JWT
```

#### Go

First, install the CDP SDK:

```bash
go mod init jwt-example
go get github.com/coinbase/cdp-sdk/go
```

Create a new file for JWT generation code:

```go
package main

import (
    "fmt"
    "log"
    "os"

    "github.com/coinbase/cdp-sdk/go/auth"
)

func main() {
    // Generate the JWT using the CDP SDK
    jwt, err := auth.GenerateJWT(auth.JwtOptions{
        KeyID:         os.Getenv("KEY_NAME"),
        KeySecret:     os.Getenv("KEY_SECRET"),
        RequestMethod: os.Getenv("REQUEST_METHOD"),
        RequestHost:   os.Getenv("REQUEST_HOST"),
        RequestPath:   os.Getenv("REQUEST_PATH"),
        ExpiresIn:     120, // optional (defaults to 120 seconds)
    })
    if err != nil {
        log.Fatalf("error building jwt: %v", err)
    }

    fmt.Println(jwt)
}
```

Finally, run the script to generate the JWT output and export it as an environment variable:

```bash
export JWT=$(go run main.go)
echo $JWT
```

#### Ruby

1. Install dependencies `JWT` and `OpenSSL`.

```bash
gem install JWT
gem install OpenSSL
```

2. Copy this code into `main.rb`:

```ruby
require 'jwt'
require 'openssl'
require 'time'
require 'securerandom'

Key_name = "organizations/{org_id}/apiKeys/{key_id}"
Key_secret = "-----BEGIN EC PRIVATE KEY-----\nYOUR PRIVATE KEY\n-----END EC PRIVATE KEY-----\n"

request_method = "GET"
request_host   = "api.coinbase.com"
request_path = "/api/v3/brokerage/accounts"

def build_jwt(uri)
    header = {
      typ: 'JWT',
      kid: Key_name,
      nonce: SecureRandom.hex(16)
    }

    claims = {
      sub: Key_name,
      iss: 'cdp',
      aud: ['cdp_service'],
      nbf: Time.now.to_i,
      exp: Time.now.to_i + 120, # Expiration time: 2 minute from now.
      uri: uri
    }

    private_key = OpenSSL::PKey::read(Key_secret)
    JWT.encode(claims, private_key, 'ES256', header)
end

token = build_jwt("#{request_method.upcase} #{request_host}#{request_path}")
puts token
```

3. Export the JWT:

```bash
export JWT=$(ruby main.rb)
echo $JWT
```

#### PHP

1. Add PHP dependencies with Composer (for JWT and environment variable management):

```
composer require firebase/php-jwt
composer require vlucas/phpdotenv
```

2. Copy this code into `generate_jwt.php`:

```php
<?php
require 'vendor/autoload.php';
use Firebase\JWT\JWT;
use \Dotenv\Dotenv;

// Load environment variables
$dotenv = Dotenv::createImmutable(__DIR__);
$dotenv->load();

function buildJwt() {
    $keyName = $_ENV['NAME'];
    $keySecret = str_replace('\\n', "\n", $_ENV['PRIVATE_KEY']);
    $request_method = 'GET';
    $url = 'api.coinbase.com';
    $request_path = '/api/v3/brokerage/accounts';

    $uri = $request_method . ' ' . $url . $request_path;
    $privateKeyResource = openssl_pkey_get_private($keySecret);
    if (!$privateKeyResource) {
        throw new Exception('Private key is not valid');
    }
    $time = time();
    $nonce = bin2hex(random_bytes(16));  // Generate a 32-character hexadecimal nonce
    $jwtPayload = [
        'sub' => $keyName,
        'iss' => 'cdp',
        'nbf' => $time,
        'exp' => $time + 120,  // Token valid for 120 seconds from now
        'uri' => $uri,
    ];
    $headers = [
        'typ' => 'JWT',
        'alg' => 'ES256',
        'kid' => $keyName,  // Key ID header for JWT
        'nonce' => $nonce  // Nonce included in headers for added security
    ];
    $jwtToken = JWT::encode($jwtPayload, $privateKeyResource, 'ES256', $keyName, $headers);
    return $jwtToken;
}

$token = buildJwt();
echo $token;
?>
```

3. Export the JWT:

```
export JWT=$(php generate_jwt.php)
echo $JWT
```

#### Java

1. Add Java Dependencies to your project's Maven or Gradle configuration:

```
nimbus-jose-jwt (version 9.39), bcpkix-jdk18on (version 1.78), and java-dotenv (version 5.2.2)
```

2. Copy this into `Main.java`:

```java
import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.*;
import com.nimbusds.jwt.*;
import java.security.interfaces.ECPrivateKey;
import java.util.Map;
import java.util.HashMap;
import java.time.Instant;
import java.util.Base64;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.openssl.PEMParser;
import org.bouncycastle.openssl.jcajce.JcaPEMKeyConverter;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.KeyFactory;
import java.io.StringReader;
import java.security.PrivateKey;
import java.security.Security;
import io.github.cdimascio.dotenv.Dotenv;

public class Main {
    public static void main(String[] args) throws Exception {
        // Register BouncyCastle as a security provider
        Security.addProvider(new BouncyCastleProvider());

        // Load environment variables
        Dotenv dotenv = Dotenv.load();
        String privateKeyPEM = dotenv.get("PRIVATE_KEY").replace("\\n", "\n");
        String name = dotenv.get("NAME");

        // create header object
        Map<String, Object> header = new HashMap<>();
        header.put("alg", "ES256");
        header.put("typ", "JWT");
        header.put("kid", name);
        header.put("nonce", String.valueOf(Instant.now().getEpochSecond()));

        // create uri string for current request
        String requestMethod = "GET";
        String url = "api.coinbase.com/api/v3/brokerage/accounts";
        String uri = requestMethod + " " + url;

        // create data object
        Map<String, Object> data = new HashMap<>();
        data.put("iss", "cdp");
        data.put("nbf", Instant.now().getEpochSecond());
        data.put("exp", Instant.now().getEpochSecond() + 120);
        data.put("sub", name);
        data.put("uri", uri);

        // Load private key
        PEMParser pemParser = new PEMParser(new StringReader(privateKeyPEM));
        JcaPEMKeyConverter converter = new JcaPEMKeyConverter().setProvider("BC");
        Object object = pemParser.readObject();
        PrivateKey privateKey;

        if (object instanceof PrivateKey) {
            privateKey = (PrivateKey) object;
        } else if (object instanceof org.bouncycastle.openssl.PEMKeyPair) {
            privateKey = converter.getPrivateKey(((org.bouncycastle.openssl.PEMKeyPair) object).getPrivateKeyInfo());
        } else {
            throw new Exception("Unexpected private key format");
        }
        pemParser.close();

        // Convert to ECPrivateKey
        KeyFactory keyFactory = KeyFactory.getInstance("EC");
        PKCS8EncodedKeySpec keySpec = new PKCS8EncodedKeySpec(privateKey.getEncoded());
        ECPrivateKey ecPrivateKey = (ECPrivateKey) keyFactory.generatePrivate(keySpec);

        // create JWT
        JWTClaimsSet.Builder claimsSetBuilder = new JWTClaimsSet.Builder();
        for (Map.Entry<String, Object> entry : data.entrySet()) {
            claimsSetBuilder.claim(entry.getKey(), entry.getValue());
        }
        JWTClaimsSet claimsSet = claimsSetBuilder.build();

        JWSHeader jwsHeader = new JWSHeader.Builder(JWSAlgorithm.ES256).customParams(header).build();
        SignedJWT signedJWT = new SignedJWT(jwsHeader, claimsSet);

        JWSSigner signer = new ECDSASigner(ecPrivateKey);
        signedJWT.sign(signer);

        String sJWT = signedJWT.serialize();
        System.out.println(sJWT);
    }
}
```

3. Compile and export the JWT:

```bash
mvn compile
export JWT=$(mvn exec:java -Dexec.mainClass=Main)
echo $JWT
```

#### C++

1. Install C++ project dependencies like so:

```
apt-get update
apt-get install libcurlpp-dev libssl-dev
git clone https://github.com/Thalhammer/jwt-cpp
cd jwt-cpp
mkdir build && cd build
cmake ..
make
make install
```

2. Copy this into `main.cpp`:

```cpp
#include <iostream>
#include <sstream>
#include <string>
#include <curlpp/cURLpp.hpp>
#include <curlpp/Easy.hpp>
#include <curlpp/Options.hpp>
#include <jwt-cpp/jwt.h>
#include <openssl/evp.h>
#include <openssl/ec.h>
#include <openssl/pem.h>
#include <openssl/rand.h>

std::string create_jwt() {
    // Set request parameters
    std::string key_name = "organizations/{org_id}/apiKeys/{key_id}";
    std::string key_secret = "-----BEGIN EC PRIVATE KEY-----\nYOUR PRIVATE KEY\n-----END EC PRIVATE KEY-----\n";
    std::string request_method = "GET";
    std::string url = "api.coinbase.com";
    std::string request_path = "/api/v3/brokerage/accounts";
    std::string uri = request_method + " " + url + request_path;

    // Generate a random nonce
    unsigned char nonce_raw[16];
    RAND_bytes(nonce_raw, sizeof(nonce_raw));
    std::string nonce(reinterpret_cast<char*>(nonce_raw), sizeof(nonce_raw));

    // Create JWT token
    auto token = jwt::create()
        .set_subject(key_name)
        .set_issuer("cdp")
        .set_not_before(std::chrono::system_clock::now())
        .set_expires_at(std::chrono::system_clock::now() + std::chrono::seconds{120})
        .set_payload_claim("uri", jwt::claim(uri))
        .set_header_claim("kid", jwt::claim(key_name))
        .set_header_claim("nonce", jwt::claim(nonce))
        .sign(jwt::algorithm::es256(key_name, key_secret));

    return token;
};

int main() {
    try {
        std::string token = create_jwt();
        std::cout << "Generated JWT Token: " << token << std::endl;
    } catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << std::endl;
        return 1;
    }
    return 0;
}
```

3. Export the JWT:

```
export JWT=$(./myapp)
```

#### C#

1. Create a new console project by running the following command:

```
dotnet new console
```

2. Install C# project dependencies like so:

```
dotnet add package Microsoft.IdentityModel.Tokens
dotnet add package System.IdentityModel.Tokens.Jwt
dotnet add package Jose-JWT
```

3. Replace Program.cs with the following code:

```csharp
// Environment is .NET 4.7.2
using System;
using System.IdentityModel.Tokens.Jwt;
using System.Net.Http;
using System.Security.Cryptography;
using Microsoft.IdentityModel.Tokens;
using Org.BouncyCastle.Crypto;
using Org.BouncyCastle.Crypto.Parameters;
using Org.BouncyCastle.OpenSsl;
using Org.BouncyCastle.Security;
using System.IO;

namespace JwtTest
{
    internal class Program
    {
        static void Main(string[] args)
        {
            string name = "organizations/{org_id}/apiKeys/{key_id}";
            string cbPrivateKey = "-----BEGIN EC PRIVATE KEY-----\nYOUR PRIVATE KEY\n-----END EC PRIVATE KEY-----\n";

            string endpoint = "api.coinbase.com/api/v3/brokerage/products";
            string token = GenerateToken(name, cbPrivateKey, $"GET {endpoint}");

            Console.WriteLine($"Generated Token: {token}");
            Console.WriteLine("Calling API...");
            Console.WriteLine(CallApiGET($"https://{endpoint}", token));
        }

        static string GenerateToken(string name, string privateKeyPem, string uri)
        {
            // Load EC private key using BouncyCastle
            var ecPrivateKey = LoadEcPrivateKeyFromPem(privateKeyPem);

            // Create security key from the manually created ECDsa
            var ecdsa = GetECDsaFromPrivateKey(ecPrivateKey);
            var securityKey = new ECDsaSecurityKey(ecdsa);

            // Signing credentials
            var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.EcdsaSha256);

            var now = DateTimeOffset.UtcNow;

            // Header and payload
            var header = new JwtHeader(credentials);
            header["kid"] = name;
            header["nonce"] = GenerateNonce(); // Generate dynamic nonce

            var payload = new JwtPayload
            {
                { "iss", "coinbase-cloud" },
                { "sub", name },
                { "nbf", now.ToUnixTimeSeconds() },
                { "exp", now.AddMinutes(2).ToUnixTimeSeconds() },
                { "uri", uri }
            };

            var token = new JwtSecurityToken(header, payload);

            var tokenHandler = new JwtSecurityTokenHandler();
            return tokenHandler.WriteToken(token);
        }

        // Method to generate a dynamic nonce
        static string GenerateNonce(int length = 64)
        {
            byte[] nonceBytes = new byte[length / 2]; // Allocate enough space for the desired length (in hex characters)
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(nonceBytes);
            }
            return BitConverter.ToString(nonceBytes).Replace("-", "").ToLower(); // Convert byte array to hex string
        }

        // Method to load EC private key from PEM using BouncyCastle
        static ECPrivateKeyParameters LoadEcPrivateKeyFromPem(string privateKeyPem)
        {
            using (var stringReader = new StringReader(privateKeyPem))
            {
                var pemReader = new PemReader(stringReader);
                var keyPair = pemReader.ReadObject() as AsymmetricCipherKeyPair;
                if (keyPair == null)
                    throw new InvalidOperationException("Failed to load EC private key from PEM");

                return (ECPrivateKeyParameters)keyPair.Private;
            }
        }

        // Method to convert ECPrivateKeyParameters to ECDsa
        static ECDsa GetECDsaFromPrivateKey(ECPrivateKeyParameters privateKey)
        {
            var q = privateKey.Parameters.G.Multiply(privateKey.D).Normalize();
            var qx = q.AffineXCoord.GetEncoded();
            var qy = q.AffineYCoord.GetEncoded();

            var ecdsaParams = new ECParameters
            {
                Curve = ECCurve.NamedCurves.nistP256, // Adjust if you're using a different curve
                Q =
                {
                    X = qx,
                    Y = qy
                },
                D = privateKey.D.ToByteArrayUnsigned()
            };

            return ECDsa.Create(ecdsaParams);
        }

        // Method to call the API with a GET request
        static string CallApiGET(string url, string bearerToken = "")
        {
            using (var client = new HttpClient())
            {
                using (var request = new HttpRequestMessage(HttpMethod.Get, url))
                {
                    if (!string.IsNullOrEmpty(bearerToken))
                        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", bearerToken);
                    var response = client.SendAsync(request).Result;

                    if (response != null)
                        return response.Content.ReadAsStringAsync().Result;
                    else
                        return "";
                }
            }
        }
    }
}
```

4. Build and run, exporting the JWT:

```bash
dotnet build
export JWT=$(dotnet run)
echo $JWT
```

## Using a JWT

Use your generated JWT by including it as a bearer token within your request:

> **Warning:** Your JWT is only valid for a period of **2 minutes** from the time it is generated. You'll need to re-generate your JWT before it expires to ensure uninterrupted access to our APIs.

```bash
curl -L -X <HTTP_METHOD> "<API_ENDPOINT_URL>" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json"
```

Here's a sample request to the Get Asset by ID endpoint, using a redacted JWT:

```bash
curl -L -X POST "https://api.cdp.coinbase.com/platform/v1/networks/base-mainnet/assets/BTC" \
  -H "Authorization: Bearer eyJ...IYg" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json"
```

## Learn More about JWTs

JWTs are a secure method of authenticating API calls, especially crucial for platforms handling sensitive financial information. They combine encryption and access management in a single token, offering a robust security layer compared to traditional API keys.

Coinbase's approach to security emphasizes maintaining trust by implementing robust safeguarding measures. JWTs for API authentication provide a format that verifies identity while encrypting critical information within a secure token framework.

### What is a JSON Web Token (JWT)?

A JSON Web Token is a compact, URL-safe means of representing claims to be transferred between two parties. JWTs encapsulate claims in a JSON object that can be digitally signed or encrypted. Each JWT consists of three parts: the Header, the Payload, and the Signature.

**JWT Structure Components:**

- **Header**: Declares the token type as JWT and specifies the signing algorithm (such as ES256), which ensures security and token integrity.
- **Payload**: Contains claims such as user identity, role, and token expiration time, enabling authentication and authorization verification for transactions aligned with user privileges.
- **Signature**: A cryptographic signature verifies that the token originates from a trusted source and has not been altered, ensuring transaction security and verifiability.

### Why Use JWTs for API Authentication?

In financial transaction contexts, where security is paramount, JWTs offer a sophisticated authentication method beyond traditional approaches. They excel due to:

- **Improved Security Features**: JWTs use advanced algorithms for signatures, securing each token against tampering, which is crucial for protecting sensitive financial data.
- **Stateless Nature**: Unlike session-based authentication, JWTs don't require server-side storage for verification. This statelessness enables dynamic scaling without session management overhead, critical for high-transaction volumes.
- **Detailed Control Over User Permissions and Token Expiration**: JWTs contain claims specifying user roles and access privileges, enabling fine-grained access control. Token expiration is explicitly managed within the JWT, ensuring timely permission revocation.

> **Note:** When working with APIs across different environments or multiple endpoints, extract and verify each URI component: HTTP Method (ensuring it matches requirements like GET or POST), Host (confirming it corresponds to the correct API server such as api.coinbase.com), and Endpoint Path (verifying the path for specific API functionality).

### Common Pitfalls and How to Avoid Them

- **Dynamic Parameters**: Pass the HTTP method and correctly formatted URL domain and path. These variables must be assigned dynamically at runtime for the API endpoint being queried.
- **Token Expiration**: Manage token expiration to a timeframe appropriate for your use-case (adding time for latency if using a proxy). Reference implementations set expiration to 120 seconds.
- **Format and Import API Keys**: Preserve original key formatting when importing both the name and private key into JWT creation files. If authentication issues persist after following all steps, add debugging to verify what the actual private key and key name resolve to at runtime.
- **Clock Skew Issues**: JWTs depend on synchronized timestamps for `nbf` (Not Before) and `exp` (Expiration) claims. Even small clock discrepancies between server and client can cause token rejection. Ensure systems synchronize using reliable time sources like NTP.
- **Improper Header Configuration**: Ensure the JWT header includes the correct `alg` (Algorithm) and `kid` (Key ID). Misconfigurations result in verification failure. Follow Coinbase guidelines for accurate field configuration.
- **Payload Bloat**: Avoid adding unnecessary data to the JWT payload. Overloading it increases token size, creating performance issues and potentially exposing sensitive information. Include only essential claims needed for the specific API request.

### Further JWT Related Reading

- [Official JWT Documentation](https://datatracker.ietf.org/doc/html/rfc7519)
- [JWT.io Debugging Tool](http://JWT.io)
