# Agent Metadata Validation Library

A professional Soroban smart contract library for validating and parsing agent metadata, including JSON CID validation and hash verification.

## Features

- **JSON CID Validation**: Validates CID formats (CIDv0, CIDv1) with proper length and format checks
- **Model Hash Verification**: Validates and verifies model hashes with hexadecimal format checking
- **Structured Metadata**: Returns properly structured `AgentMetadata` objects
- **Comprehensive Error Handling**: Detailed error types for different validation failures
- **Soroban Optimized**: Built specifically for Soroban smart contract environment

## Installation

Add this to your contract's `Cargo.toml`:

```toml
[dependencies]
agent-metadata = { path = "../agent-metadata" }
```

## Usage

### Basic Validation

```rust
use agent_metadata::{MetadataValidator, AgentMetadata};
use soroban_sdk::{Env, Bytes, Vec};

let env = Env::default();
let validator = MetadataValidator::new();

let json_cid = Bytes::from_slice(&env, b"QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG");
let model_hash = Bytes::from_slice(&env, b"a1b2c3d4e5f6789012345678901234567890abcdef");
let name = Bytes::from_slice(&env, b"MyAgent");
let description = Bytes::from_slice(&env, b"An AI agent for data processing");
let version = Bytes::from_slice(&env, b"1.0.0");
let extra_fields = Vec::new(&env);

let metadata = validator.validate_and_parse(
    &env,
    json_cid,
    model_hash,
    name,
    description,
    version,
    extra_fields,
)?;
```

### Quick Validation

For simple use cases, use the convenience functions:

```rust
use agent_metadata::convenience;

let metadata = convenience::validate_metadata_quick(
    &env,
    json_cid,
    model_hash,
    name,
    description,
    version,
)?;
```

### Individual Component Validation

```rust
let validator = MetadataValidator::new();

// Validate only CID
validator.validate_cid(&json_cid)?;

// Validate only hash
validator.validate_model_hash(&model_hash)?;

// Verify hash matches expected
validator.verify_hash(&provided_hash, &expected_hash)?;
```

## API Reference

### MetadataValidator

Main validator class with the following methods:

- `new()` - Create a new validator instance
- `validate_and_parse()` - Complete validation and parsing
- `validate_cid()` - Validate CID format only
- `validate_model_hash()` - Validate hash format only
- `verify_hash()` - Verify hash matches expected

### AgentMetadata

Structured metadata object containing:

- `json_cid: Bytes` - CID pointing to JSON metadata
- `model_hash: Bytes` - Hash for model verification
- `name: Bytes` - Agent name
- `description: Bytes` - Agent description
- `version: Bytes` - Agent version
- `extra_fields: Vec<(Bytes, Bytes)>` - Additional metadata fields

### Error Types

- `InvalidJsonFormat` - JSON format validation failed
- `MissingRequiredField` - Required field is missing or empty
- `InvalidCidFormat` - CID format is invalid
- `HashVerificationFailed` - Hash verification failed
- `InvalidStructure` - Metadata structure is invalid
- `CidTooLong` - CID exceeds maximum length
- `HashTooLong` - Hash exceeds maximum length

## Validation Rules

### CID Validation

- Minimum length: 10 characters
- Maximum length: 100 characters
- Supports CIDv0 (Qm...), CIDv1 (bafy...), and base58btc (z...) formats
- Alphanumeric character validation for other formats

### Hash Validation

- Minimum length: 32 characters
- Maximum length: 128 characters
- Must contain only hexadecimal characters (0-9, a-f, A-F)

## Testing

Run tests with:

```bash
cargo test
```

The library includes comprehensive unit tests covering:

- Valid and invalid CID formats
- Valid and invalid hash formats
- Complete metadata validation
- Error handling scenarios
- Convenience function testing

## Integration with Existing Contracts

To integrate with your existing Soroban contracts:

1. Add the dependency to your `Cargo.toml`
2. Import the library: `use agent_metadata::{MetadataValidator, AgentMetadata};`
3. Use the validator in your contract functions

Example integration:

```rust
use agent_metadata::MetadataValidator;

pub fn register_agent(
    env: Env,
    json_cid: Bytes,
    model_hash: Bytes,
    name: Bytes,
    description: Bytes,
    version: Bytes,
) -> Result<AgentMetadata, MetadataError> {
    let validator = MetadataValidator::new();
    let metadata = validator.validate_and_parse(
        &env,
        json_cid,
        model_hash,
        name,
        description,
        version,
        Vec::new(&env),
    )?;
    
    // Store metadata in contract storage
    env.storage().persistent().set(&metadata.name, &metadata);
    
    Ok(metadata)
}
```

## Security Considerations

- All validation is performed on-chain within the Soroban environment
- No external dependencies or network calls
- Memory-efficient validation suitable for blockchain constraints
- Comprehensive input validation prevents malformed data

## License

MIT License - see LICENSE file for details.
