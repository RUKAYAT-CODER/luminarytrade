# Stellar/Soroban Submitter Module

NestJS microservice for queuing and batch-submitting verified results to Stellar/Soroban blockchain.

## Features

✅ Queue-based submission system (Bull/Redis)
✅ Idempotency keys prevent double submission
✅ Automatic retry mechanism with exponential backoff
✅ Batch submission support
✅ PostgreSQL for persistent storage
✅ Transaction status tracking
✅ Stellar SDK integration

## Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- Stellar account with testnet XLM

## Quick Start

### Using Docker Compose

```bash
docker-compose up --build
```

### Local Development

```bash
# Install dependencies
npm install

# Start databases
docker-compose up postgres redis

# Run migrations (auto with synchronize)
npm run start:dev
```

## API Endpoints

### Create Submission
```bash
POST /submissions
Content-Type: application/json

{
  "idempotencyKey": "unique-key-123",
  "payload": {
    "documentHash": "abc123...",
    "metadata": {}
  }
}
```

### Create Batch
```bash
POST /submissions/batch
Content-Type: application/json

[
  {
    "idempotencyKey": "key-1",
    "payload": { "documentHash": "hash1" }
  },
  {
    "idempotencyKey": "key-2",
    "payload": { "documentHash": "hash2" }
  }
]
```

### Get Submission
```bash
GET /submissions/:id
GET /submissions/key/:idempotencyKey
```

### List Submissions
```bash
GET /submissions?status=completed
```

## Submission States

- `pending` - Queued for processing
- `processing` - Currently submitting to Stellar
- `completed` - Successfully submitted
- `failed` - Permanently failed after retries
- `retrying` - Temporarily failed, will retry

## Retry Logic

- Automatic retries with exponential backoff
- Default max retries: 3
- Delay: 2^retryCount seconds
- Failed submissions marked after max retries

## Environment Variables

```bash
DB_HOST=localhost
DB_PORT=5432
REDIS_HOST=localhost
REDIS_PORT=6379
STELLAR_NETWORK=testnet
STELLAR_SECRET_KEY=your_secret_key
```

## Testing

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Coverage
npm run test:cov
```

## Idempotency

All submissions require a unique `idempotencyKey`. Duplicate keys will return `409 Conflict` with the existing submission.

## Monitoring

- Queue status via Bull Board (optional)
- Database for submission history
- Logs for transaction tracking

## Production Deployment

1. Set production environment variables
2. Use mainnet Stellar network
3. Configure proper retry limits
4. Enable queue monitoring
5. Set up database backups

## Architecture

```
Client → API Controller → Service → Database
                              ↓
                         Queue (Bull)
                              ↓
                       Processor
                              ↓
                    Stellar Network
```
