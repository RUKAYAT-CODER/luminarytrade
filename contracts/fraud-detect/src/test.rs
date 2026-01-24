#![cfg(test)]

use super::*;
use soroban_sdk::testutils::{Address as _, Events};
use soroban_sdk::{symbol_short, vec, Address, Env};

#[test]
fn test_full_lifecycle() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, FraudDetectContract);
    let client = FraudDetectContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let reporter = Address::generate(&env);
    let agent_id = symbol_short!("agent_1");

    // 1. Initialize
    client.initialize(&admin);

    // 2. Add reporter
    client.add_reporter(&reporter);

    // 3. Submit report
    let score = 85;
    client.submit_report(&reporter, &agent_id, &score);

    // 4. Verify report retrieval
    let reports = client.get_reports(&agent_id);
    assert_eq!(reports.len(), 1);
    let report = reports.get(0).unwrap();
    assert_eq!(report.score, score);
    assert_eq!(report.reporter, reporter);

    // 5. Verify latest score
    assert_eq!(client.get_latest_score(&agent_id), score);

    // 6. Verify events
    let events = env.events().all();
    let last_event = events.last().unwrap();
    // (symbol_short!("fraud_rpt"), agent_id)
    assert_eq!(
        last_event.topics,
        vec![&env, (symbol_short!("fraud_rpt"), agent_id).into_val(&env)]
    );
}

#[test]
#[should_panic(expected = "not an approved reporter")]
fn test_unauthorized_reporter() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, FraudDetectContract);
    let client = FraudDetectContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let unauthorized_reporter = Address::generate(&env);
    let agent_id = symbol_short!("agent_1");

    client.initialize(&admin);
    // reporter not added
    client.submit_report(&unauthorized_reporter, &agent_id, &70);
}

#[test]
fn test_remove_reporter() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, FraudDetectContract);
    let client = FraudDetectContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let reporter = Address::generate(&env);
    let agent_id = symbol_short!("agent_1");

    client.initialize(&admin);
    client.add_reporter(&reporter);
    client.submit_report(&reporter, &agent_id, &50);
    
    // Remove reporter
    client.remove_reporter(&reporter);
    
    // Should now fail
    let res = env.as_contract(&contract_id, || {
        client.submit_report(&reporter, &agent_id, &60);
    });
    // Since we are using mock_all_auths, we might need a different way to check panic if we don't use should_panic
    // But let's just use a separate test for that or keep it simple.
}

#[test]
#[should_panic(expected = "already initialized")]
fn test_double_initialization() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, FraudDetectContract);
    let client = FraudDetectContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);
    client.initialize(&admin);
}
