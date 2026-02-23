#![no_std]

use soroban_sdk::{contracttype, Bytes, Env, Vec};
use common_utils::error::{ValidationError, ContractError};
use common_utils::parser::{MetadataParser, MetadataBuilder, ParserConfig};

/// Legacy error type for backward compatibility
/// Maps to new ValidationError codes
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum MetadataError {
    /// Invalid JSON format -> ValidationError::InvalidJsonStructure
    InvalidJsonFormat = 1,
    /// Missing required field -> ValidationError::MissingRequiredField
    MissingRequiredField = 2,
    /// Invalid CID format -> ValidationError::InvalidCidFormat
    InvalidCidFormat = 3,
    /// Hash verification failed -> ValidationError::InvalidHashFormat
    HashVerificationFailed = 4,
    /// Invalid metadata structure -> ValidationError::InvalidFormat
    InvalidStructure = 5,
    /// CID too long -> ValidationError::InvalidLength
    CidTooLong = 6,
    /// Hash too long -> ValidationError::InvalidLength
    HashTooLong = 7,
}

impl MetadataError {
    /// Convert legacy MetadataError to new ValidationError
    pub fn to_validation_error(&self) -> ValidationError {
        match self {
            MetadataError::InvalidJsonFormat => ValidationError::InvalidJsonStructure,
            MetadataError::MissingRequiredField => ValidationError::MissingRequiredField,
            MetadataError::InvalidCidFormat => ValidationError::InvalidCidFormat,
            MetadataError::HashVerificationFailed => ValidationError::InvalidHashFormat,
            MetadataError::InvalidStructure => ValidationError::InvalidFormat,
            MetadataError::CidTooLong | MetadataError::HashTooLong => ValidationError::InvalidLength,
        }
    }
    
    /// Convert ValidationError to legacy MetadataError
    pub fn from_validation_error(err: ValidationError) -> Self {
        match err {
            ValidationError::InvalidJsonStructure => MetadataError::InvalidJsonFormat,
            ValidationError::MissingRequiredField => MetadataError::MissingRequiredField,
            ValidationError::InvalidCidFormat => MetadataError::InvalidCidFormat,
            ValidationError::InvalidHashFormat => MetadataError::HashVerificationFailed,
            ValidationError::InvalidFormat => MetadataError::InvalidStructure,
            ValidationError::InvalidLength => MetadataError::CidTooLong,
        }
    }
}

/// Structured agent metadata object
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct AgentMetadata {
    /// JSON CID pointing to the metadata
    pub json_cid: Bytes,
    /// Model hash for verification
    pub model_hash: Bytes,
    /// Agent name
    pub name: Bytes,
    /// Agent description
    pub description: Bytes,
    /// Agent version
    pub version: Bytes,
    /// Additional metadata fields
    pub extra_fields: Vec<(Bytes, Bytes)>,
}

impl AgentMetadata {
    /// Convert from parsed metadata
    pub fn from_parsed(parsed: common_utils::parser::metadata_parser::ParsedMetadata) -> Self {
        Self {
            json_cid: parsed.json_cid,
            model_hash: parsed.model_hash,
            name: parsed.name,
            description: parsed.description,
            version: parsed.version,
            extra_fields: parsed.extra_fields,
        }
    }
}

/// CID validation constants
pub mod cid {
    use soroban_sdk::Bytes;
    
    pub const MAX_CID_LENGTH: usize = 100;
    pub const MIN_CID_LENGTH: usize = 10;
    
    /// Basic CID format validation (simplified for Soroban constraints)
    pub fn is_valid_cid(cid: &Bytes) -> bool {
        let len = cid.len() as usize;
        if len < MIN_CID_LENGTH || len > MAX_CID_LENGTH {
            return false;
        }
        
        // For Soroban Bytes, we'll use a simplified validation
        // Check if it has reasonable length and basic format
        len >= MIN_CID_LENGTH && len <= MAX_CID_LENGTH
    }
}

/// Hash validation constants
pub mod hash {
    use soroban_sdk::Bytes;
    
    pub const MAX_HASH_LENGTH: usize = 128;
    pub const MIN_HASH_LENGTH: usize = 32;
    
    /// Basic hash format validation
    pub fn is_valid_hash(hash: &Bytes) -> bool {
        let len = hash.len() as usize;
        if len < MIN_HASH_LENGTH || len > MAX_HASH_LENGTH {
            return false;
        }
        
        // For Soroban Bytes, we'll use simplified validation
        // Check if it has reasonable length for a hash
        len >= MIN_HASH_LENGTH && len <= MAX_HASH_LENGTH
    }
}

/// Main metadata validator and parser
/// 
/// Now uses the reusable parser framework from common-utils
pub struct MetadataValidator {
    parser: MetadataParser,
}

impl MetadataValidator {
    /// Create a new validator instance with default configuration
    pub fn new() -> Self {
        Self {
            parser: MetadataParser::new(),
        }
    }
    
    /// Create a validator with custom parser configuration
    pub fn with_config(config: ParserConfig) -> Self {
        Self {
            parser: MetadataParser::with_config(config),
        }
    }
    
    /// Validate and parse agent metadata from raw components
    /// 
    /// # Arguments
    /// * `json_cid` - CID pointing to JSON metadata
    /// * `model_hash` - Hash for model verification
    /// * `name` - Agent name
    /// * `description` - Agent description  
    /// * `version` - Agent version
    /// * `extra_fields` - Additional metadata fields
    /// 
    /// # Returns
    /// * `Ok(AgentMetadata)` - Validated metadata object
    /// * `Err(MetadataError)` - Validation error
    pub fn validate_and_parse(
        &self,
        env: &Env,
        json_cid: Bytes,
        model_hash: Bytes,
        name: Bytes,
        description: Bytes,
        version: Bytes,
        extra_fields: Vec<(Bytes, Bytes)>,
    ) -> Result<AgentMetadata, MetadataError> {
        // Use the reusable parser from common-utils
        let parsed = self.parser.parse_metadata(
            env,
            json_cid,
            model_hash,
            name,
            description,
            version,
            extra_fields,
        ).map_err(MetadataError::from_validation_error)?;
        
        // Convert to AgentMetadata
        Ok(AgentMetadata::from_parsed(parsed))
    }
    
    /// Validate JSON CID format only
    pub fn validate_cid(&self, env: &Env, cid: &Bytes) -> Result<(), MetadataError> {
        self.parser.parse_cid(env, cid)
            .map(|_| ())
            .map_err(MetadataError::from_validation_error)
    }
    
    /// Validate model hash format only
    pub fn validate_model_hash(&self, env: &Env, hash: &Bytes) -> Result<(), MetadataError> {
        self.parser.parse_hash(env, hash)
            .map(|_| ())
            .map_err(MetadataError::from_validation_error)
    }
    
    /// Verify that a provided hash matches the expected hash
    pub fn verify_hash(&self, provided_hash: &Bytes, expected_hash: &Bytes) -> Result<(), MetadataError> {
        if provided_hash == expected_hash {
            Ok(())
        } else {
            Err(MetadataError::HashVerificationFailed)
        }
    }
}

impl Default for MetadataValidator {
    fn default() -> Self {
        Self::new()
    }
}

/// Convenience functions for common validation operations
pub mod convenience {
    use super::*;
    
    /// Quick validation of all metadata components using parser
    pub fn validate_metadata_quick(
        env: &Env,
        json_cid: Bytes,
        model_hash: Bytes,
        name: Bytes,
        description: Bytes,
        version: Bytes,
    ) -> Result<AgentMetadata, MetadataError> {
        let validator = MetadataValidator::new();
        let empty_fields = Vec::new(env);
        validator.validate_and_parse(
            env,
            json_cid,
            model_hash,
            name,
            description,
            version,
            empty_fields,
        )
    }
    
    /// Validate only CID and hash (for quick checks)
    pub fn validate_cid_and_hash(
        env: &Env,
        json_cid: Bytes,
        model_hash: Bytes,
    ) -> Result<(), MetadataError> {
        let validator = MetadataValidator::new();
        validator.validate_cid(env, &json_cid)?;
        validator.validate_model_hash(env, &model_hash)?;
        Ok(())
    }
    
    /// Build metadata using the builder pattern
    pub fn build_metadata(
        env: &Env,
        json_cid: Bytes,
        model_hash: Bytes,
        name: Bytes,
        description: Bytes,
        version: Bytes,
    ) -> Result<AgentMetadata, MetadataError> {
        MetadataBuilder::new()
            .with_cid(json_cid)
            .with_hash(model_hash)
            .with_name(name)
            .with_description(description)
            .with_version(version)
            .build(env)
            .map(AgentMetadata::from_parsed)
            .map_err(MetadataError::from_validation_error)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{Bytes, Env, Vec};
    
    #[test]
    fn test_valid_cid_validation() {
        let env = Env::default();
        
        // Test valid CID formats
        let valid_cid_v0 = Bytes::from_slice(&env, b"QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG");
        let valid_cid_v1 = Bytes::from_slice(&env, b"bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi");
        
        assert!(cid::is_valid_cid(&valid_cid_v0));
        assert!(cid::is_valid_cid(&valid_cid_v1));
    }
    
    #[test]
    fn test_invalid_cid_validation() {
        let env = Env::default();
        
        // Test invalid CID formats
        let empty_cid = Bytes::from_slice(&env, b"");
        let short_cid = Bytes::from_slice(&env, b"Qm");
        let long_cid = Bytes::from_slice(&env, b"QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdGQmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdGQmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdGQmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG");
        
        assert!(!cid::is_valid_cid(&empty_cid));
        assert!(!cid::is_valid_cid(&short_cid));
        assert!(!cid::is_valid_cid(&long_cid));
    }
    
    #[test]
    fn test_valid_hash_validation() {
        let env = Env::default();
        
        let valid_hash = Bytes::from_slice(&env, b"a1b2c3d4e5f6789012345678901234567890abcdef");
        let short_valid_hash = Bytes::from_slice(&env, b"00000000000000000000000000000000");
        
        assert!(hash::is_valid_hash(&valid_hash));
        assert!(hash::is_valid_hash(&short_valid_hash));
    }
    
    #[test]
    fn test_invalid_hash_validation() {
        let env = Env::default();
        
        let empty_hash = Bytes::from_slice(&env, b"");
        let short_hash = Bytes::from_slice(&env, b"abc");
        let invalid_chars = Bytes::from_slice(&env, b"xyz123");
        
        assert!(!hash::is_valid_hash(&empty_hash));
        assert!(!hash::is_valid_hash(&short_hash));
        assert!(!hash::is_valid_hash(&invalid_chars));
    }
    
    #[test]
    fn test_complete_metadata_validation() {
        let env = Env::default();
        let validator = MetadataValidator::new();
        
        let json_cid = Bytes::from_slice(&env, b"QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG");
        let model_hash = Bytes::from_slice(&env, b"a1b2c3d4e5f6789012345678901234567890abcdef");
        let name = Bytes::from_slice(&env, b"TestAgent");
        let description = Bytes::from_slice(&env, b"A test agent for validation");
        let version = Bytes::from_slice(&env, b"1.0.0");
        let extra_fields = Vec::new(&env);
        
        let result = validator.validate_and_parse(
            &env,
            json_cid.clone(),
            model_hash.clone(),
            name.clone(),
            description.clone(),
            version.clone(),
            extra_fields,
        );
        
        assert!(result.is_ok());
        let metadata = result.unwrap();
        assert_eq!(metadata.json_cid, json_cid);
        assert_eq!(metadata.model_hash, model_hash);
        assert_eq!(metadata.name, name);
        assert_eq!(metadata.description, description);
        assert_eq!(metadata.version, version);
    }
    
    #[test]
    fn test_missing_required_fields() {
        let env = Env::default();
        let validator = MetadataValidator::new();
        
        let json_cid = Bytes::from_slice(&env, b"QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG");
        let model_hash = Bytes::from_slice(&env, b"a1b2c3d4e5f6789012345678901234567890abcdef");
        let empty_name = Bytes::from_slice(&env, b"");
        let description = Bytes::from_slice(&env, b"A test agent");
        let version = Bytes::from_slice(&env, b"1.0.0");
        let extra_fields = Vec::new(&env);
        
        let result = validator.validate_and_parse(
            &env,
            json_cid,
            model_hash,
            empty_name,
            description,
            version,
            extra_fields,
        );
        
        assert_eq!(result, Err(MetadataError::MissingRequiredField));
    }
    
    #[test]
    fn test_convenience_functions() {
        let env = Env::default();
        
        let json_cid = Bytes::from_slice(&env, b"QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG");
        let model_hash = Bytes::from_slice(&env, b"a1b2c3d4e5f6789012345678901234567890abcdef");
        let name = Bytes::from_slice(&env, b"TestAgent");
        let description = Bytes::from_slice(&env, b"A test agent");
        let version = Bytes::from_slice(&env, b"1.0.0");
        
        let result = convenience::validate_metadata_quick(
            &env,
            json_cid,
            model_hash,
            name,
            description,
            version,
        );
        
        assert!(result.is_ok());
    }
}
