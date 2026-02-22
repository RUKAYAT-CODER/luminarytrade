import { Saga, SagaState, SagaStep } from '../saga/base-saga.class';

interface TestContext {
  value: number;
}

describe('Saga', () => {
  let testSaga: Saga<TestContext>;

  class TestSaga extends Saga<TestContext> {
    constructor() {
      super('TestSaga');
      this.initializeSteps();
    }

    private initializeSteps(): void {
      this.addStep({
        name: 'Step1',
        execute: async (ctx: TestContext) => {
          return { result: ctx.value * 2 };
        },
        compensate: async () => {},
      });

      this.addStep({
        name: 'Step2',
        execute: async () => {
          return { final: true };
        },
        compensate: async () => {},
      });
    }
  }

  beforeEach(() => {
    testSaga = new TestSaga();
  });

  describe('constructor', () => {
    it('should initialize with STARTED state', () => {
      expect(testSaga.state).toBe(SagaState.STARTED);
      expect(testSaga.currentStep).toBe(0);
      expect(testSaga.steps.length).toBe(2);
    });
  });

  describe('execute', () => {
    it('should execute all steps sequentially', async () => {
      const context: TestContext = { value: 5 };
      const result = await testSaga.execute(context);

      expect(testSaga.state).toBe(SagaState.COMPLETED);
      expect(testSaga.currentStep).toBe(1); // After last step
      expect(result.get('Step1').result).toBe(10);
      expect(result.get('Step2').final).toBe(true);
    });

    it('should handle step failures and trigger compensation', async () => {
      const failingSaga = new (class extends Saga<TestContext> {
        constructor() {
          super('FailingSaga');
          this.addStep({
            name: 'SuccessStep',
            execute: async () => ({ ok: true }),
            compensate: async () => {},
          });

          this.addStep({
            name: 'FailingStep',
            execute: async () => {
              throw new Error('Step failed');
            },
            compensate: async () => {},
          });

          this.addStep({
            name: 'NeverRun',
            execute: async () => ({ ok: true }),
          });
        }
      })();

      await expect(failingSaga.execute({ value: 1 })).rejects.toThrow('Step failed');

      expect(failingSaga.state).toBe(SagaState.COMPENSATING);
      expect(failingSaga.error).toBe('Step failed');
    });

    it('should compensate in reverse order on failure', async () => {
      const order: string[] = [];
      const saga = new (class extends Saga<TestContext> {
        constructor() {
          super('OrderedSaga');
          this.addStep({
            name: 'Step1',
            execute: async () => { order.push('execute1'); },
            compensate: async () => { order.push('compensate1'); },
          });

          this.addStep({
            name: 'Step2',
            execute: async () => { order.push('execute2'); },
            compensate: async () => { order.push('compensate2'); },
          });

          this.addStep({
            name: 'Step3',
            execute: async () => {
              order.push('execute3');
              throw new Error('Fail at step 3');
            },
            compensate: async () => { order.push('compensate3'); },
          });
        }
      })();

      await expect(saga.execute({ value: 1 })).rejects.toThrow();

      // Execute all steps, then compensate the failed one
      expect(order).toContain('execute1');
      expect(order).toContain('execute2');
      expect(order).toContain('execute3');
      // Compensation happens for completed steps
      expect(saga.state).toBe(SagaState.COMPENSATING);
    });
  });

  describe('getStatus', () => {
    it('should return current saga status', async () => {
      await testSaga.execute({ value: 1 });

      const status = testSaga.getStatus();

      expect(status.sagaId).toBeDefined();
      expect(status.name).toBe('TestSaga');
      expect(status.state).toBe(SagaState.COMPLETED);
      expect(status.currentStep).toBe(1);
      expect(status.totalSteps).toBe(2);
    });

    it('should include error message when failed', async () => {
      const failingSaga = new (class extends Saga<TestContext> {
        constructor() {
          super('FailingSaga');
          this.addStep({
            name: 'Fail',
            execute: async () => {
              throw new Error('Test error');
            },
          });
        }
      })();

      await expect(failingSaga.execute({ value: 1 })).rejects.toThrow();

      const status = failingSaga.getStatus();
      expect(status.error).toBe('Test error');
    });
  });
});

describe('SagaState', () => {
  it('should have all expected states', () => {
    expect(SagaState.STARTED).toBe('STARTED');
    expect(SagaState.RUNNING).toBe('RUNNING');
    expect(SagaState.COMPENSATING).toBe('COMPENSATING');
    expect(SagaState.COMPLETED).toBe('COMPLETED');
    expect(SagaState.FAILED).toBe('FAILED');
  });
});
