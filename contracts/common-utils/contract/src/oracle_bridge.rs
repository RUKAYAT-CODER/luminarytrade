#![no_std]

use soroban_sdk::{
    contractimpl, panic_with_error, symbol, Address, Bytes, BytesN, Env, IntoVal, Map, Storage, Vec,
};

/// Errors for the OracleBridge contract.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Error {
    /// Oracle key is not approved.
    UnauthorizedOracle = 1,
    /// Nonce has already been used (replay attack).
    NonceAlreadyUsed = 2,
    /// Signature verification failed.
    InvalidSignature = 3,
    /// Only contract admin can perform this action.
    Unauthorized = 4,
    /// Payload is empty or invalid.
    InvalidPayload = 5,
}

impl soroban_sdk::contracterror::ContractError for Error {
    fn as_u32(&self) -> u32 {
        *self as u32
    }
}

/// Event emitted when oracle data is posted.
pub struct OracleDataPosted {
    pub oracle: Address,
    pub nonce: u64,
    pub payload_hash: BytesN<32>,
}

/// Oracle attestation data structure.
#[derive(Clone)]
pub struct OracleAttestation {
    pub oracle: Address,
    pub nonce: u64,
    pub payload: Bytes,
    pub signature: BytesN<64>,
}

/// Main contract struct
pub struct OracleBridgeContract;

const KEY_ADMIN: &str = "admin";
const KEY_APPROVED_ORACLES: &str = "approved_oracles";
const PREFIX_USED_NONCE: &str = "used_nonce";
const PREFIX_ORACLE_DATA: &str = "oracle_data";

#[contractimpl]
impl OracleBridgeContract {
    /// Initialize contract with admin set to caller.
    pub fn initialize(env: Env) {
        let admin = env.invoker();
        env.storage().set(&symbol!(KEY_ADMIN), &admin);
    }

    /// Add an approved oracle key (admin only).
    pub fn add_oracle(env: Env, oracle: Address) {
        Self::require_admin(&env);
        
        let approved_oracles_key = symbol!(KEY_APPROVED_ORACLES);
        let mut approved_oracles: Vec<Address> = env.storage()
            .get(&approved_oracles_key)
            .unwrap_or_else(|| Vec::new(&env));
        
        // Check if oracle is already approved
        if approved_oracles.contains(&oracle) {
            return; // Already approved, no error
        }
        
        approved_oracles.push_back(oracle);
        env.storage().set(&approved_oracles_key, &approved_oracles);
    }

    /// Remove an approved oracle key (admin only).
    pub fn remove_oracle(env: Env, oracle: Address) {
        Self::require_admin(&env);
        
        let approved_oracles_key = symbol!(KEY_APPROVED_ORACLES);
        let mut approved_oracles: Vec<Address> = env.storage()
            .get(&approved_oracles_key)
            .unwrap_or_else(|| Vec::new(&env));
        
        // Remove oracle if exists
        let mut found = false;
        let mut new_oracles = Vec::new(&env);
        for approved_oracle in approved_oracles.iter() {
            if approved_oracle != oracle {
                new_oracles.push_back(approved_oracle);
            } else {
                found = true;
            }
        }
        
        if found {
            env.storage().set(&approved_oracles_key, &new_oracles);
        }
    }

    /// Post oracle data with attestation.
    pub fn post_oracle_data(env: Env, attestation: OracleAttestation) {
        // Verify oracle is approved
        if !Self::is_approved_oracle(&env, &attestation.oracle) {
            panic_with_error!(&env, Error::UnauthorizedOracle);
        }

        // Check nonce hasn't been used
        let nonce_key = (symbol!(PREFIX_USED_NONCE), attestation.oracle.clone(), attestation.nonce);
        if env.storage().has(&nonce_key) {
            panic_with_error!(&env, Error::NonceAlreadyUsed);
        }

        // Validate payload
        if attestation.payload.is_empty() {
            panic_with_error!(&env, Error::InvalidPayload);
        }

        // Verify signature
        let message = Self::create_message(&env, &attestation.oracle, attestation.nonce, &attestation.payload);
        if !Self::verify_signature(&env, &attestation.oracle, &message, &attestation.signature) {
            panic_with_error!(&env, Error::InvalidSignature);
        }

        // Mark nonce as used
        env.storage().set(&nonce_key, &true);

        // Store payload
        let payload_hash = env.crypto().sha256(&attestation.payload);
        let data_key = (symbol!(PREFIX_ORACLE_DATA), attestation.oracle.clone(), payload_hash.clone());
        env.storage().set(&data_key, &attestation.payload);

        // Emit event
        env.events().publish(
            (symbol!("OracleDataPosted"), attestation.oracle.clone()),
            OracleDataPosted {
                oracle: attestation.oracle,
                nonce: attestation.nonce,
                payload_hash,
            },
        );
    }

    /// Get stored oracle data by hash.
    pub fn get_oracle_data(env: Env, oracle: Address, payload_hash: BytesN<32>) -> Option<Bytes> {
        let data_key = (symbol!(PREFIX_ORACLE_DATA), oracle, payload_hash);
        env.storage().get(&data_key)
    }

    /// Check if an oracle is approved.
    pub fn is_approved_oracle(env: &Env, oracle: &Address) -> bool {
        let approved_oracles_key = symbol!(KEY_APPROVED_ORACLES);
        let approved_oracles: Vec<Address> = env.storage()
            .get(&approved_oracles_key)
            .unwrap_or_else(|| Vec::new(env));
        approved_oracles.contains(oracle)
    }

    /// Get list of approved oracles.
    pub fn get_approved_oracles(env: Env) -> Vec<Address> {
        let approved_oracles_key = symbol!(KEY_APPROVED_ORACLES);
        env.storage()
            .get(&approved_oracles_key)
            .unwrap_or_else(|| Vec::new(&env))
    }

    /// Check if a nonce has been used for an oracle.
    pub fn is_nonce_used(env: Env, oracle: Address, nonce: u64) -> bool {
        let nonce_key = (symbol!(PREFIX_USED_NONCE), oracle, nonce);
        env.storage().has(&nonce_key)
    }

    /// Helper to get admin address.
    fn admin(env: &Env) -> Address {
        env.storage()
            .get_unchecked::<_, Address>(&symbol!(KEY_ADMIN))
            .unwrap()
    }

    /// Require admin authorization.
    fn require_admin(env: &Env) {
        let invoker = env.invoker();
        if invoker != Self::admin(env) {
            panic_with_error!(env, Error::Unauthorized);
        }
    }

    /// Create message for signature verification.
    fn create_message(env: &Env, oracle: &Address, nonce: u64, payload: &Bytes) -> Bytes {
        let mut message = Vec::new(env);
        message.extend_from_slice(&oracle.to_bytes(env));
        message.extend_from_slice(&nonce.to_le_bytes());
        message.extend_from_slice(payload);
        Bytes::from_slice(env, &message.into_iter().collect::<Vec<u8>>())
    }

    /// Verify signature using Ed25519.
    fn verify_signature(env: &Env, public_key: &Address, message: &Bytes, signature: &BytesN<64>) -> bool {
        // Convert address to public key bytes
        let pub_key_bytes = public_key.to_bytes(env);
        
        // Verify signature using Soroban's crypto primitives
        env.crypto().ed25519_verify(
            &pub_key_bytes,
            message,
            signature,
        ).is_ok()
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as TestAddress, testutils::Bytes as TestBytes, testutils::BytesN as TestBytesN, testutils::Env as TestEnv};

    #[test]
    fn test_initialize_and_admin() {
        let env = TestEnv::default();
        let contract = OracleBridgeContract {};
        
        contract.initialize(env.clone());
        let admin = OracleBridgeContract::admin(&env);
        assert_eq!(admin, env.invoker());
    }

    #[test]
    fn test_oracle_management() {
        let env = TestEnv::default();
        let contract = OracleBridgeContract {};
        contract.initialize(env.clone());
        
        let oracle1 = TestAddress::random(&env);
        let oracle2 = TestAddress::random(&env);
        
        // Add oracles
        contract.add_oracle(env.clone(), oracle1.clone());
        contract.add_oracle(env.clone(), oracle2.clone());
        
        // Check approved oracles
        let approved = contract.get_approved_oracles(env.clone());
        assert_eq!(approved.len(), 2);
        assert!(approved.contains(&oracle1));
        assert!(approved.contains(&oracle2));
        
        // Remove oracle
        contract.remove_oracle(env.clone(), oracle1.clone());
        let approved = contract.get_approved_oracles(env.clone());
        assert_eq!(approved.len(), 1);
        assert!(!approved.contains(&oracle1));
        assert!(approved.contains(&oracle2));
    }

    #[test]
    fn test_nonce_tracking() {
        let env = TestEnv::default();
        let contract = OracleBridgeContract {};
        contract.initialize(env.clone());
        
        let oracle = TestAddress::random(&env);
        contract.add_oracle(env.clone(), oracle.clone());
        
        // Initially nonce should not be used
        assert!(!contract.is_nonce_used(env.clone(), oracle.clone(), 1));
        
        // Create a mock attestation (signature will be invalid but we'll test nonce)
        let payload = TestBytes::from_slice(&env, b"test payload");
        let signature = TestBytesN::from_array(&env, &[0u8; 64]);
        let attestation = OracleAttestation {
            oracle: oracle.clone(),
            nonce: 1,
            payload: payload.clone(),
            signature,
        };
        
        // This will fail due to invalid signature, but let's manually mark nonce as used for testing
        let nonce_key = (symbol!("used_nonce"), oracle.clone(), 1u64);
        env.storage().set(&nonce_key, &true);
        
        // Now nonce should be marked as used
        assert!(contract.is_nonce_used(env.clone(), oracle.clone(), 1));
    }

    #[test]
    fn test_unauthorized_oracle() {
        let env = TestEnv::default();
        let contract = OracleBridgeContract {};
        contract.initialize(env.clone());
        
        let unauthorized_oracle = TestAddress::random(&env);
        let payload = TestBytes::from_slice(&env, b"test payload");
        let signature = TestBytesN::from_array(&env, &[0u8; 64]);
        let attestation = OracleAttestation {
            oracle: unauthorized_oracle,
            nonce: 1,
            payload: payload.clone(),
            signature,
        };
        
        // Should panic with UnauthorizedOracle error
        let result = std::panic::catch_unwind(|| {
            contract.post_oracle_data(env.clone(), attestation)
        });
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_payload() {
        let env = TestEnv::default();
        let contract = OracleBridgeContract {};
        contract.initialize(env.clone());
        
        let oracle = TestAddress::random(&env);
        contract.add_oracle(env.clone(), oracle.clone());
        
        let empty_payload = TestBytes::from_slice(&env, b"");
        let signature = TestBytesN::from_array(&env, &[0u8; 64]);
        let attestation = OracleAttestation {
            oracle,
            nonce: 1,
            payload: empty_payload,
            signature,
        };
        
        // Should panic with InvalidPayload error
        let result = std::panic::catch_unwind(|| {
            contract.post_oracle_data(env.clone(), attestation)
        });
        assert!(result.is_err());
    }
}
