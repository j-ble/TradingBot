# Advanced Trade WebSocket Authentication

## Overview

This guide covers authenticating requests to the Advanced Trade WebSocket API server channels. Prerequisites include having already created API keys.

## Sending Messages with API Keys

### Making Requests

Generate and export a JSON Web Token (JWT) to make authenticated requests.

> **Note:** WebSocket JWTs (vs those for REST API) are not built with a request method or request path.

### Generating a JWT

Follow these steps regardless of programming language:

1. Replace `key name` and `key secret` with your credentials. The `key secret` is multi-line; preserve newlines using `\n` escaped characters or multi-line strings.
2. Run the generation script that prints `export JWT=...`
3. Execute the generated command to save your JWT.

> **Warning:** Your JWT expires after 2 minutes, after which all requests are unauthenticated.

### Code Samples by Language

#### Python SDK

```bash
pip3 install coinbase-advanced-py
```

```python
from coinbase import jwt_generator

api_key = "organizations/{org_id}/apiKeys/{key_id}"
api_secret = "-----BEGIN EC PRIVATE KEY-----\nYOUR PRIVATE KEY\n-----END EC PRIVATE KEY-----\n"

def main():
    jwt_token = jwt_generator.build_ws_jwt(api_key, api_secret)
    print(f"export JWT={jwt_token}")

if __name__ == "__main__":
    main()
```

#### Python

```bash
pip install PyJWT
pip install cryptography
```

```python
import jwt
from cryptography.hazmat.primitives import serialization
import time
import secrets

key_name     = "organizations/{org_id}/apiKeys/{key_id}"
key_secret   = "-----BEGIN EC PRIVATE KEY-----\nYOUR PRIVATE KEY\n-----END EC PRIVATE KEY-----\n"

def build_jwt():
    private_key_bytes = key_secret.encode('utf-8')
    private_key = serialization.load_pem_private_key(private_key_bytes, password=None)

    jwt_payload = {
        'sub': key_name,
        'iss': "cdp",
        'nbf': int(time.time()),
        'exp': int(time.time()) + 120,
    }

    jwt_token = jwt.encode(
        jwt_payload,
        private_key,
        algorithm='ES256',
        headers={'kid': key_name, 'nonce': secrets.token_hex()},
    )

    return jwt_token

def main():
    jwt_token = build_jwt()
    print(f"export JWT={jwt_token}")

if __name__ == "__main__":
    main()
```

#### Go

```bash
go mod init jwt-generator
go mod tidy
go run main.go
```

```go
package main

import (
    "crypto/rand"
    "crypto/x509"
    "encoding/pem"
    "fmt"
    "math"
    "math/big"
    "time"

    log "github.com/sirupsen/logrus"
    "gopkg.in/go-jose/go-jose.v2"
    "gopkg.in/go-jose/go-jose.v2/jwt"
)

const (
    keyName     = "organizations/{org_id}/apiKeys/{key_id}"
    keySecret   = "-----BEGIN EC PRIVATE KEY-----\nYOUR PRIVATE KEY\n-----END EC PRIVATE KEY-----\n"
)

type APIKeyClaims struct {
    *jwt.Claims
}

func buildJWT() (string, error) {
    block, _ := pem.Decode([]byte(keySecret))
    if block == nil {
        return "", fmt.Errorf("jwt: Could not decode private key")
    }

    key, err := x509.ParseECPrivateKey(block.Bytes)
    if err != nil {
        return "", fmt.Errorf("jwt: %w", err)
    }

    sig, err := jose.NewSigner(
        jose.SigningKey{Algorithm: jose.ES256, Key: key},
        (&jose.SignerOptions{NonceSource: nonceSource{}}).WithType("JWT").WithHeader("kid", keyName),
    )
    if err != nil {
        return "", fmt.Errorf("jwt: %w", err)
    }

    cl := &APIKeyClaims{
        Claims: &jwt.Claims{
            Subject:   keyName,
            Issuer:    "cdp",
            NotBefore: jwt.NewNumericDate(time.Now()),
            Expiry:    jwt.NewNumericDate(time.Now().Add(2 * time.Minute)),
        },
    }
    jwtString, err := jwt.Signed(sig).Claims(cl).CompactSerialize()
    if err != nil {
        return "", fmt.Errorf("jwt: %w", err)
    }
    return jwtString, nil
}

var max = big.NewInt(math.MaxInt64)

type nonceSource struct{}

func (n nonceSource) Nonce() (string, error) {
    r, err := rand.Int(rand.Reader, max)
    if err != nil {
        return "", err
    }
    return r.String(), nil
}

func main() {
    jwt, err := buildJWT()
    if err != nil {
        log.Errorf("error building jwt: %v", err)
    }
    fmt.Println("export JWT=" + jwt)
}
```

#### JavaScript

```bash
npm install jsonwebtoken
```

```javascript
const { sign } = require('jsonwebtoken');
const crypto = require('crypto');

const key_name       = 'organizations/{org_id}/apiKeys/{key_id}';
const key_secret = '-----BEGIN EC PRIVATE KEY-----\nYOUR PRIVATE KEY\n-----END EC PRIVATE KEY-----\n';

const algorithm = 'ES256';

const token = sign(
        {
           iss: 'cdp',
           nbf: Math.floor(Date.now() / 1000),
           exp: Math.floor(Date.now() / 1000) + 120,
           sub: key_name,
        },
        key_secret,
        {
           algorithm,
           header: {
              kid: key_name,
              nonce: crypto.randomBytes(16).toString('hex'),
           },
        }
);
console.log('export JWT=' + token);
```

#### PHP

```bash
composer require firebase/php-jwt
composer require vlucas/phpdotenv
```

```php
<?php
require 'vendor/autoload.php';
use Firebase\JWT\JWT;
use \Dotenv\Dotenv;

$dotenv = Dotenv::createImmutable(__DIR__);
$dotenv->load();

function buildJwt() {
    $keyName = $_ENV['NAME'];
    $keySecret = str_replace('\\n', "\n", $_ENV['PRIVATE_KEY']);

    $privateKeyResource = openssl_pkey_get_private($keySecret);
    if (!$privateKeyResource) {
        throw new Exception('Private key is not valid');
    }
    $time = time();
    $nonce = bin2hex(random_bytes(16));
    $jwtPayload = [
        'sub' => $keyName,
        'iss' => 'cdp',
        'nbf' => $time,
        'exp' => $time + 120,
    ];
    $headers = [
        'typ' => 'JWT',
        'alg' => 'ES256',
        'kid' => $keyName,
        'nonce' => $nonce
    ];
    $jwtToken = JWT::encode($jwtPayload, $privateKeyResource, 'ES256', $keyName, $headers);
    return $jwtToken;
}
```

#### Java

Dependencies:
- nimbus-jose-jwt (v9.39)
- bcpkix-jdk18on (v1.78)
- java-dotenv (v5.2.2)

```bash
mvn compile
export JWT=$(mvn exec:java -Dexec.mainClass=Main)
```

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
        Security.addProvider(new BouncyCastleProvider());
        Dotenv dotenv = Dotenv.load();
        String privateKeyPEM = dotenv.get("PRIVATE_KEY").replace("\\n", "\n");
        String name = dotenv.get("NAME");

        Map<String, Object> header = new HashMap<>();
        header.put("alg", "ES256");
        header.put("typ", "JWT");
        header.put("kid", name);
        header.put("nonce", String.valueOf(Instant.now().getEpochSecond()));

        Map<String, Object> data = new HashMap<>();
        data.put("iss", "cdp");
        data.put("nbf", Instant.now().getEpochSecond());
        data.put("exp", Instant.now().getEpochSecond() + 120);
        data.put("sub", name);

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

        KeyFactory keyFactory = KeyFactory.getInstance("EC");
        PKCS8EncodedKeySpec keySpec = new PKCS8EncodedKeySpec(privateKey.getEncoded());
        ECPrivateKey ecPrivateKey = (ECPrivateKey) keyFactory.generatePrivate(keySpec);

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

#### C++

```bash
apt-get update
apt-get install libcurlpp-dev libssl-dev
git clone https://github.com/Thalhammer/jwt-cpp
cd jwt-cpp && mkdir build && cd build
cmake .. && make && make install
g++ main.cpp -o myapp -lcurlpp -lcurl -lssl -lcrypto -I/usr/local/include -L/usr/local/lib -ljwt -std=c++17
export JWT=$(./myapp)
```

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
    std::string key_name = "organizations/{org_id}/apiKeys/{key_id}";
    std::string key_secret = "-----BEGIN EC PRIVATE KEY-----\nYOUR PRIVATE KEY\n-----END EC PRIVATE KEY-----\n";

    unsigned char nonce_raw[16];
    RAND_bytes(nonce_raw, sizeof(nonce_raw));
    std::string nonce(reinterpret_cast<char*>(nonce_raw), sizeof(nonce_raw));

    auto token = jwt::create()
        .set_subject(key_name)
        .set_issuer("cdp")
        .set_not_before(std::chrono::system_clock::now())
        .set_expires_at(std::chrono::system_clock::now() + std::chrono::seconds{120})
        .set_header_claim("kid", jwt::claim(key_name))
        .set_header_claim("nonce", jwt::claim(nonce))
        .sign(jwt::algorithm::es256(key_name, key_secret));

    return token;
}

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

#### TypeScript

```bash
npm install jsonwebtoken
npm install @types/jsonwebtoken
npm install -g typescript
tsc main.ts
node main.js
export JWT=$(node main.js)
```

```typescript
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

const keyName = 'organizations/{org_id}/apiKeys/{key_id}';
const keySecret = `-----BEGIN EC PRIVATE KEY-----
YOUR PRIVATE KEY
-----END EC PRIVATE KEY-----`;
const algorithm = 'ES256';

const generateJWT = (): string => {
  const payload = {
    iss: 'cdp',
    nbf: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 120,
    sub: keyName,
  };

  const header = {
    alg: algorithm,
    kid: keyName,
    nonce: crypto.randomBytes(16).toString('hex'),
  };

  return jwt.sign(payload, keySecret, { algorithm, header });
};

const main = () => {
  const token = generateJWT();
  console.log(token);
};

main();
```

#### C#

```bash
dotnet new console
dotnet add package Microsoft.IdentityModel.Tokens
dotnet add package System.IdentityModel.Tokens.Jwt
dotnet add package Jose-JWT
dotnet build
dotnet run
```

```csharp
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using Jose;

namespace JwtTest {
    internal class Program {
        static Random random = new Random();

        static void Main(string[] args) {
            string name = "organizations/{org_id}/apiKeys/{key_id}";
            string cbPrivateKey = "-----BEGIN EC PRIVATE KEY-----\nYOUR PRIVATE KEY\n-----END EC PRIVATE KEY-----\n";

            string key = parseKey(cbPrivateKey);
            string token = generateToken(name, key);

            Console.WriteLine($"Token is valid? {isTokenValid(token, name, key)}");
        }

        static string generateToken(string name, string secret) {
            var privateKeyBytes = Convert.FromBase64String(secret);
            using var key = ECDsa.Create();
            key.ImportECPrivateKey(privateKeyBytes, out _);

            var payload = new Dictionary<string, object>
            {
                { "sub", name },
                { "iss", "coinbase-cloud" },
                { "nbf", Convert.ToInt64((DateTime.UtcNow - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalSeconds) },
                { "exp", Convert.ToInt64((DateTime.UtcNow.AddMinutes(1) - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalSeconds) },
            };

            var extraHeaders = new Dictionary<string, object>
            {
                { "kid", name },
                { "nonce", randomHex(10) },
                { "typ", "JWT"}
            };

            var encodedToken = JWT.Encode(payload, key, JwsAlgorithm.ES256, extraHeaders);
            Console.WriteLine(encodedToken);
            return encodedToken;
        }

        static bool isTokenValid(string token, string tokenId, string secret) {
            if (token == null)
                return false;

            var key = ECDsa.Create();
            key?.ImportECPrivateKey(Convert.FromBase64String(secret), out _);

            var securityKey = new ECDsaSecurityKey(key) { KeyId = tokenId };

            try {
                var tokenHandler = new JwtSecurityTokenHandler();
                tokenHandler.ValidateToken(token, new TokenValidationParameters {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = securityKey,
                    ValidateIssuer = false,
                    ValidateAudience = false,
                    ClockSkew = TimeSpan.Zero
                }, out var validatedToken);

                return true;
            } catch {
                return false;
            }
        }

        static string parseKey(string key) {
            List<string> keyLines = new List<string>();
            keyLines.AddRange(key.Split('\n', StringSplitOptions.RemoveEmptyEntries));

            keyLines.RemoveAt(0);
            keyLines.RemoveAt(keyLines.Count - 1);

            return String.Join("", keyLines);
        }

        static string randomHex(int digits) {
            byte[] buffer = new byte[digits / 2];
            random.NextBytes(buffer);
            string result = String.Concat(buffer.Select(x => x.ToString("X2")).ToArray());
            if (digits % 2 == 0)
                return result;
            return result + random.Next(16).ToString("X");
        }
    }
}
```

#### Ruby

```bash
gem install JWT
gem install OpenSSL
ruby main.rb
export JWT=$(ruby main.rb)
```

```ruby
require 'jwt'
require 'openssl'
require 'time'
require 'securerandom'

Key_name = "organizations/{org_id}/apiKeys/{key_id}"
Key_secret = "-----BEGIN EC PRIVATE KEY-----\nYOUR PRIVATE KEY\n-----END EC PRIVATE KEY-----\n"

def build_jwt()
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
      exp: Time.now.to_i + 120,
    }

    private_key = OpenSSL::PKey::read(Key_secret)
    JWT.encode(claims, private_key, 'ES256', header)
  end

token = build_jwt()
puts token
```

## Sending Messages without API Keys

### Subscribing

```json
{
    "type": "subscribe",
    "product_ids": [
        "ETH-USD",
        "ETH-EUR"
    ],
    "channel": "level2"
}
```

### Unsubscribing

```json
{
    "type": "unsubscribe",
    "product_ids": [
        "ETH-USD",
        "ETH-EUR"
    ],
    "channel": "level2"
}
```

## Sequence Numbers

Feed messages typically include sequence numbers—incrementing integers per product where successive messages increase by exactly one.

When sequence numbers increase by more than one, a message was dropped. Values lower than the previous number indicate out-of-order arrival and can be disregarded.

> **Note:** Even though a WebSocket connection is over TCP, the WebSocket servers receive market data in a manner that can result in dropped messages.

Your feed consumer should handle sequence gaps and out-of-order messages, or utilize channels guaranteeing message delivery.

> **Tip:** To guarantee that messages are delivered and your order book is in sync, consider using the level2 channel.
