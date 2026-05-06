# Intelli-Park Camera Integration Research Report

**Date:** 2026-05-05  
**Researcher:** Claude  
**Project:** Intelli-Park Camera Management SaaS (NestJS Backend)

---

## Topic 1: Milesight MS-C8241-X36PE HTTP Push Notification

### Configuration Format
Milesight cameras support **HTTP POST method** for pushing notifications (requires firmware TS series PE platform with version T_61.8.0.3-XX-r7 or later).

**Image Format:** Snapshots are posted as **multipart form-data** with JSON metadata. Three snapshot types available:
- Full Snapshot (standard 4K JPEG)
- License Plate (cropped/zoomed JPEG)
- All (both types in single push)

**Configuration Parameters:**
- **Destination URL:** Configurable HTTP/HTTPS endpoint
- **Trigger Interval:** 0–900 seconds (key insight: 500ms ~= 2 FPS)
- **Snapshot Option:** Checkbox to include JPEG attachment with each push
- **Auth:** Basic auth supported (username/password)

### Server Load Implications (500ms interval)
At ~2 FPS with full snapshots:
- **Bandwidth:** ~2–5 MB/sec per camera (4K resolution, JPEG 80% quality assumed)
- **Request frequency:** 2,000 requests/hour per camera
- **Processing bottleneck:** JPEG parsing + multi-part form parsing on NestJS endpoint
- **Recommendation:** Use **queuing layer** (Bull/Redis) to decouple receiving from processing; implement **backpressure handling** for concurrent cameras

**NestJS Endpoint Pattern:**
```typescript
@Post('/camera-push/:cameraId')
@UseInterceptors(FileInterceptor('snapshot'))
async receivePush(
  @Param('cameraId') cameraId: string,
  @Body() data: any,
  @UploadedFile() file?: Express.Multer.File
) {
  // Parse multipart, validate signature, enqueue for async processing
}
```

---

## Topic 2: ONVIF Connection Probe

### Best npm Packages
**Recommended:** `node-onvif` (active maintenance, Promise-based, snapshot support)
- Alternative: `onvif` (lower-level SOAP control, WS-Discovery probe included)

### Connection Probe Pattern
```typescript
const device = new OnvifDevice({
  xaddr: 'http://192.168.1.100:10080/onvif/device_service',
  user: 'admin',
  pass: 'password'
});

await device.init(); // Validates connection, fetches capabilities
```

**What `init()` does:**
- Calls `getSystemDateAndTime`, `getCapabilities`, `getVideoSources`, `getProfiles`
- Throws if authentication fails or device unreachable
- Returns promise; completes in ~1–3 seconds

**Snapshot Retrieval:**
```typescript
const snapshot = await device.fetchSnapshot(); // Returns Buffer (JPEG)
```

**Common Errors:**
- `ECONNREFUSED` → device offline or wrong port
- `401 Unauthorized` → invalid credentials
- `SOAP fault` → camera does not support requested operation (check firmware)

---

## Topic 3: AES-256 Encryption for Credentials

### Production Pattern (Node.js Crypto Module)
**Recommended approach:** Random IV + ciphertext prefix (avoid static IV vulnerability)

**Implementation:**
```typescript
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

class EncryptionService {
  private algorithm = 'aes-256-cbc';
  private key = createHash('sha256')
    .update(process.env.ENCRYPTION_KEY) // 32+ byte key from .env
    .digest();

  encrypt(plaintext: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final()
    ]);
    // Prefix IV to ciphertext, return base64
    return Buffer.concat([iv, encrypted]).toString('base64');
  }

  decrypt(encoded: string): string {
    const buffer = Buffer.from(encoded, 'base64');
    const iv = buffer.slice(0, 16);
    const encrypted = buffer.slice(16);
    const decipher = createDecipheriv(this.algorithm, this.key, iv);
    return decipher.update(encrypted) + decipher.final('utf8');
  }
}
```

**Key Requirements:**
- Store `ENCRYPTION_KEY` in `.env` (never commit)
- Key length: 32 bytes minimum (sha256 hash ensures this)
- Generate fresh IV for every encryption call
- Use `process.env.ENCRYPTION_KEY` with sufficient entropy (~256 bits)

**NestJS Integration:**
Inject service in camera repository to encrypt/decrypt credentials on save/load:
```typescript
@Injectable()
export class CameraRepository {
  constructor(private crypto: EncryptionService) {}

  async saveCredentials(cameraId, username, password) {
    return db.update(cameraId, {
      username_encrypted: this.crypto.encrypt(username),
      password_encrypted: this.crypto.encrypt(password)
    });
  }
}
```

**Avoid:** Static IV, hardcoded keys, or using base password digest without random salt.

---

## Summary & Trade-offs

| Topic | Solution | Rationale |
|-------|----------|-----------|
| **HTTP Push Receiving** | Multipart parser + Bull queue | Handle 2 FPS load; async processing |
| **ONVIF Probe** | node-onvif with init() + timeout | Standard, well-tested, 3-sec validation |
| **Encryption** | Node.js crypto + random IV | No external deps; meets compliance |

**Unresolved Questions:**
- Does Milesight support HTTPS push signatures (HMAC-SHA256)?
- What is the max number of concurrent HTTP push streams a single NestJS instance can handle (100? 1000)?
- Should credentials be re-encrypted on key rotation, or stored with version tagging?

---

## References

- [Milesight HTTP Notification Setup](https://support.milesight.com/support/solutions/articles/69000797374-how-to-set-http-notification)
- [node-onvif GitHub](https://github.com/GuilhermeC18/node-onvif)
- [NestJS Encryption & Hashing](https://docs.nestjs.com/security/encryption-and-hashing)
- [AES-256-CBC in Node.js](https://dev.to/jobizil/encrypt-and-decrypt-data-in-nodejs-using-aes-256-cbc-2l6d)
- [Comprehensive NestJS Encryption Service](https://dev.to/imzihad21/comprehensive-encryption-and-security-service-in-nestjs-argon2-hashing-token-generation-and-aes-encryption-595o)
- [IP Camera HTTP Notification Patterns](https://www.pushsafer.com/en/ip-cameras)
