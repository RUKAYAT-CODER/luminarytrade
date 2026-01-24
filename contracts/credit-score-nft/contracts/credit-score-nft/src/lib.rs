#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, String, Vec};

#[contracttype]
#[derive(Clone)]
pub struct CreditScoreNFT {
    pub owner: Address,
    pub metadata_cid: String,
    pub token_id: u64,
    pub mint_timestamp: u64,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Minters(Address),
    TokenId,
    NFT(u64),
    OwnerTokens(Address),
}

#[contract]
pub struct CreditScoreNFTContract;

#[contractimpl]
impl CreditScoreNFTContract {
    /// Initialize the credit score NFT contract
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Contract already initialized");
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::TokenId, &0u64);

        env.events()
            .publish((symbol_short!("init"), symbol_short!("contract")), admin);
    }

    /// Add an authorized minter
    pub fn add_minter(env: Env, minter: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        env.storage()
            .persistent()
            .set(&DataKey::Minters(minter.clone()), &true);

        env.events()
            .publish((symbol_short!("add"), symbol_short!("minter")), minter);
    }

    /// Remove an authorized minter
    pub fn remove_minter(env: Env, minter: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        env.storage()
            .persistent()
            .remove(&DataKey::Minters(minter.clone()));

        env.events()
            .publish((symbol_short!("remove"), symbol_short!("minter")), minter);
    }

    /// Check if an address is an authorized minter
    pub fn is_minter(env: Env, address: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::Minters(address))
            .unwrap_or(false)
    }

    /// Mint a new credit score NFT
    pub fn mint(env: Env, minter: Address, to: Address, metadata_cid: String) -> u64 {
        minter.require_auth();

        // Check if caller is authorized minter
        let is_authorized = Self::is_minter(env.clone(), minter.clone());

        if !is_authorized {
            let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
            if minter != admin {
                panic!("Unauthorized: caller is not an authorized minter");
            }
        }

        // Get and increment token ID
        let mut token_id: u64 = env.storage().instance().get(&DataKey::TokenId).unwrap_or(0);
        token_id += 1;
        env.storage().instance().set(&DataKey::TokenId, &token_id);

        // Create NFT
        let nft = CreditScoreNFT {
            owner: to.clone(),
            metadata_cid: metadata_cid.clone(),
            token_id,
            mint_timestamp: env.ledger().timestamp(),
        };

        // Store NFT
        env.storage()
            .persistent()
            .set(&DataKey::NFT(token_id), &nft);

        // Update owner's token list
        let mut owner_tokens: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::OwnerTokens(to.clone()))
            .unwrap_or(Vec::new(&env));
        owner_tokens.push_back(token_id);
        env.storage()
            .persistent()
            .set(&DataKey::OwnerTokens(to.clone()), &owner_tokens);

        // Emit mint event
        env.events().publish(
            (symbol_short!("mint"), symbol_short!("nft")),
            (to, token_id, metadata_cid),
        );

        token_id
    }

    /// Transfer NFT to a new owner
    pub fn transfer(env: Env, from: Address, to: Address, token_id: u64) {
        from.require_auth();

        // Get NFT
        let mut nft: CreditScoreNFT = env
            .storage()
            .persistent()
            .get(&DataKey::NFT(token_id))
            .expect("NFT not found");

        // Verify ownership
        if nft.owner != from {
            panic!("Unauthorized: caller is not the owner");
        }

        // Remove token from previous owner's list
        let mut from_tokens: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::OwnerTokens(from.clone()))
            .unwrap_or(Vec::new(&env));

        if let Some(index) = from_tokens.iter().position(|id| id == token_id) {
            from_tokens.remove(index as u32);
            env.storage()
                .persistent()
                .set(&DataKey::OwnerTokens(from.clone()), &from_tokens);
        }

        // Add token to new owner's list
        let mut to_tokens: Vec<u64> = env
            .storage()
            .persistent()
            .get(&DataKey::OwnerTokens(to.clone()))
            .unwrap_or(Vec::new(&env));
        to_tokens.push_back(token_id);
        env.storage()
            .persistent()
            .set(&DataKey::OwnerTokens(to.clone()), &to_tokens);

        // Update NFT owner
        nft.owner = to.clone();
        env.storage()
            .persistent()
            .set(&DataKey::NFT(token_id), &nft);

        // Emit transfer event
        env.events().publish(
            (symbol_short!("transfer"), symbol_short!("nft")),
            (from, to, token_id),
        );
    }

    /// Get NFT metadata
    pub fn get_nft(env: Env, token_id: u64) -> CreditScoreNFT {
        env.storage()
            .persistent()
            .get(&DataKey::NFT(token_id))
            .expect("NFT not found")
    }

    /// Get metadata CID for a token
    pub fn get_metadata_cid(env: Env, token_id: u64) -> String {
        let nft: CreditScoreNFT = Self::get_nft(env, token_id);
        nft.metadata_cid
    }

    /// Get owner of a token
    pub fn get_owner(env: Env, token_id: u64) -> Address {
        let nft: CreditScoreNFT = Self::get_nft(env, token_id);
        nft.owner
    }

    /// Get all tokens owned by an address
    pub fn get_tokens_by_owner(env: Env, owner: Address) -> Vec<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::OwnerTokens(owner))
            .unwrap_or(Vec::new(&env))
    }

    /// Get total supply of NFTs
    pub fn total_supply(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::TokenId).unwrap_or(0)
    }

    /// Get contract admin
    pub fn get_admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Address, Env, String};

    #[test]
    fn test_initialize() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, CreditScoreNFTContract);
        let client = CreditScoreNFTContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.initialize(&admin);

        assert_eq!(client.get_admin(), admin);
        assert_eq!(client.total_supply(), 0);
    }

    #[test]
    fn test_add_minter() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, CreditScoreNFTContract);
        let client = CreditScoreNFTContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let minter = Address::generate(&env);

        client.initialize(&admin);
        client.add_minter(&minter);

        assert!(client.is_minter(&minter));
    }

    #[test]
    fn test_mint_nft() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, CreditScoreNFTContract);
        let client = CreditScoreNFTContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let minter = Address::generate(&env);
        let recipient = Address::generate(&env);

        client.initialize(&admin);
        client.add_minter(&minter);

        let metadata = String::from_str(&env, "QmXYZ123...");
        let token_id = client.mint(&minter, &recipient, &metadata);

        assert_eq!(token_id, 1);
        assert_eq!(client.get_owner(&token_id), recipient);
        assert_eq!(client.get_metadata_cid(&token_id), metadata);
        assert_eq!(client.total_supply(), 1);
    }

    #[test]
    fn test_transfer_nft() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, CreditScoreNFTContract);
        let client = CreditScoreNFTContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let minter = Address::generate(&env);
        let owner = Address::generate(&env);
        let recipient = Address::generate(&env);

        client.initialize(&admin);
        client.add_minter(&minter);

        let metadata = String::from_str(&env, "QmXYZ123...");
        let token_id = client.mint(&minter, &owner, &metadata);

        client.transfer(&owner, &recipient, &token_id);

        assert_eq!(client.get_owner(&token_id), recipient);

        // Verify token lists updated
        let owner_tokens = client.get_tokens_by_owner(&owner);
        assert_eq!(owner_tokens.len(), 0);

        let recipient_tokens = client.get_tokens_by_owner(&recipient);
        assert_eq!(recipient_tokens.len(), 1);
        assert_eq!(recipient_tokens.get(0).unwrap(), token_id);
    }

    #[test]
    #[should_panic(expected = "Unauthorized: caller is not an authorized minter")]
    fn test_mint_unauthorized() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, CreditScoreNFTContract);
        let client = CreditScoreNFTContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let unauthorized = Address::generate(&env);
        let recipient = Address::generate(&env);

        client.initialize(&admin);

        let metadata = String::from_str(&env, "QmXYZ123...");
        client.mint(&unauthorized, &recipient, &metadata);
    }

    #[test]
    fn test_admin_can_mint() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, CreditScoreNFTContract);
        let client = CreditScoreNFTContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let recipient = Address::generate(&env);

        client.initialize(&admin);

        let metadata = String::from_str(&env, "QmABC456...");
        let token_id = client.mint(&admin, &recipient, &metadata);

        assert_eq!(token_id, 1);
        assert_eq!(client.get_owner(&token_id), recipient);
    }

    #[test]
    fn test_remove_minter() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, CreditScoreNFTContract);
        let client = CreditScoreNFTContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let minter = Address::generate(&env);

        client.initialize(&admin);
        client.add_minter(&minter);
        assert!(client.is_minter(&minter));

        client.remove_minter(&minter);
        assert!(!client.is_minter(&minter));
    }

    #[test]
    fn test_multiple_mints() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, CreditScoreNFTContract);
        let client = CreditScoreNFTContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let minter = Address::generate(&env);
        let recipient = Address::generate(&env);

        client.initialize(&admin);
        client.add_minter(&minter);

        let metadata1 = String::from_str(&env, "QmFirst...");
        let token_id1 = client.mint(&minter, &recipient, &metadata1);

        let metadata2 = String::from_str(&env, "QmSecond...");
        let token_id2 = client.mint(&minter, &recipient, &metadata2);

        assert_eq!(token_id1, 1);
        assert_eq!(token_id2, 2);
        assert_eq!(client.total_supply(), 2);

        let tokens = client.get_tokens_by_owner(&recipient);
        assert_eq!(tokens.len(), 2);
    }
}
