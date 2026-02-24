#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short,
    Address, Bytes, BytesN, Env, Map, Symbol,
};
use common_utils::error::{AuthorizationError, CryptoError, ValidationError, ContractError};
use common_utils::authorization::{IAuthorizable, SignatureBasedAuth, Permission, PermissionCache, CachedAuth};
use common_utils::{permission, auth, cached_auth, check_authorization, verify_signature};

/// -------------------------
/// Storage Keys
/// -------------------------
#[contracttype]
pub enum DataKey {
    BridgePubKey,
    Risk(Address),
}

/// -------------------------
/// Risk Levels
/// -------------------------
#[contracttype]
#[derive(Clone, Copy)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

/// -------------------------
/// Signed Payload
/// -------------------------
#[contracttype]
pub struct RiskAttestation {
    pub agent: Address,
    pub risk: RiskLevel,
    pub timestamp: u64,
}

/// -------------------------
/// Contract
/// -------------------------
#[contract]
pub struct RiskEvaluationContract;

/// -------------------------
/// Implementation
/// -------------------------
#[contractimpl]
impl RiskEvaluationContract {
    /// Initialize contract with AI bridge public key
    pub fn init(env: Env, bridge_pubkey: BytesN<32>) -> Result<(), AuthorizationError> {
        if env.storage().instance().has(&DataKey::BridgePubKey) {
            return Err(AuthorizationError::AlreadyInitialized);
        }

        env.storage()
            .instance()
            .set(&DataKey::BridgePubKey, &bridge_pubkey);
        Ok(())
    }

    /// Submit signed risk evaluation
    pub fn submit_risk(
        env: Env,
        attestation: RiskAttestation,
        signature: BytesN<64>,
        payload: Bytes,
    ) -> Result<(), CryptoError> {
        let auth = Self::get_auth(&env);
        
        // Verify signature using the authorization system
        if !auth.verify_signature(&env, &payload, &signature)? {
            return Err(CryptoError::SignatureVerificationFailed);
        }
        
        // Check custom permission for signature-based auth
        check_authorization!(auth, &env, &attestation.agent, permission!(Custom(Symbol::new(&env, "signature"))));

        // Optional replay protection (basic)
        let now = env.ledger().timestamp();
        if attestation.timestamp > now + 60 {
            return Err(CryptoError::InvalidSignature);
        }

        // Store risk level for agent
        env.storage()
            .persistent()
            .set(&DataKey::Risk(attestation.agent.clone()), &attestation.risk);

        // Emit event
        env.events().publish(
            (symbol_short!("RiskEvaluated"), attestation.agent),
            attestation.risk,
        );

        Ok(())
    }

    /// Get risk level for an agent
    pub fn get_risk(env: Env, agent: Address) -> Option<RiskLevel> {
        env.storage()
            .persistent()
            .get(&DataKey::Risk(agent))
    }
    
    /// Get the authorization instance for this contract
    fn get_auth(env: &Env) -> CachedAuth<SignatureBasedAuth> {
        let sig_auth = auth!(SignatureBased, Symbol::new(env, "bridge_pubkey"));
        let cache = PermissionCache::new(300, Symbol::new(env, "auth_cache"));
        cached_auth!(sig_auth, cache)
    }
    
    /// Verify a signature directly (utility method)
    pub fn verify_signature_direct(env: Env, payload: Bytes, signature: BytesN<64>) -> Result<bool, CryptoError> {
        let auth = Self::get_auth(&env);
        auth.verify_signature(&env, &payload, &signature)
    }
}

