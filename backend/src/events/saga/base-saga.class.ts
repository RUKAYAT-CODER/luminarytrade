import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

/**
 * Saga state enumeration
 */
export enum SagaState {
  STARTED = 'STARTED',
  RUNNING = 'RUNNING',
  COMPENSATING = 'COMPENSATING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/**
 * Step status
 */
export enum StepStatus {
  PENDING = 'PENDING',
  EXECUTING = 'EXECUTING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  COMPENSATED = 'COMPENSATED',
}

/**
 * Step interface for saga
 */
export interface SagaStep<T = any> {
  name: string;
  execute(payload: T): Promise<any>;
  compensate?(result: any): Promise<void>;
}

/**
 * Base class for sagas
 */
export abstract class Saga<T = any> {
  public readonly sagaId: string;
  public state: SagaState;
  public currentStep: number = 0;
  public steps: SagaStep[] = [];
  public stepResults: Map<string, any> = new Map();
  public error?: string;
  protected readonly logger: Logger;

  constructor(public readonly name: string) {
    this.sagaId = uuidv4();
    this.state = SagaState.STARTED;
    this.logger = new Logger(`Saga:${name}`);
  }

  /**
   * Add a step to the saga
   */
  addStep(step: SagaStep): this {
    this.steps.push(step);
    return this;
  }

  /**
   * Execute the saga
   */
  async execute(context: T): Promise<any> {
    this.state = SagaState.RUNNING;
    this.logger.log(`Saga ${this.name} started with ID ${this.sagaId}`);

    try {
      for (let i = 0; i < this.steps.length; i++) {
        this.currentStep = i;
        const step = this.steps[i];

        this.logger.debug(`Executing step ${i + 1}/${this.steps.length}: ${step.name}`);

        const result = await step.execute(context);
        this.stepResults.set(step.name, result);

        this.logger.debug(`Step ${step.name} completed`);
      }

      this.state = SagaState.COMPLETED;
      this.logger.log(`Saga ${this.name} completed successfully`);

      return this.stepResults;
    } catch (error) {
      this.state = SagaState.FAILED;
      this.error = (error as Error).message;
      this.logger.error(`Saga ${this.name} failed: ${this.error}`);

      // Start compensation
      await this.compensate();

      throw error;
    }
  }

  /**
   * Compensate all completed steps
   */
  async compensate(): Promise<void> {
    if (this.state === SagaState.COMPENSATING) {
      this.logger.warn('Compensation already in progress');
      return;
    }

    this.state = SagaState.COMPENSATING;
    this.logger.log(`Starting compensation for saga ${this.name}`);

    // Compensate in reverse order
    for (let i = this.currentStep; i >= 0; i--) {
      const step = this.steps[i];
      const result = this.stepResults.get(step.name);

      if (result && step.compensate) {
        try {
          this.logger.debug(`Compensating step: ${step.name}`);
          await step.compensate(result);
          this.logger.debug(`Compensation for step ${step.name} completed`);
        } catch (compError) {
          this.logger.error(
            `Compensation failed for step ${step.name}: ${(compError as Error).message}`,
          );
          // Continue with other compensations
        }
      }
    }

    this.logger.log(`Compensation for saga ${this.name} completed`);
  }

  /**
   * Get saga status
   */
  getStatus(): {
    sagaId: string;
    name: string;
    state: SagaState;
    currentStep: number;
    totalSteps: number;
    error?: string;
  } {
    return {
      sagaId: this.sagaId,
      name: this.name,
      state: this.state,
      currentStep: this.currentStep,
      totalSteps: this.steps.length,
      error: this.error,
    };
  }
}

/**
 * Saga orchestrator for managing multiple sagas
 */
@Injectable()
export class SagaOrchestrator {
  private readonly logger = new Logger(SagaOrchestrator.name);
  private readonly activeSagas: Map<string, Saga> = new Map();

  /**
   * Register a saga
   */
  registerSaga(saga: Saga): void {
    this.activeSagas.set(saga.sagaId, saga);
    this.logger.debug(`Saga ${saga.name} registered with ID ${saga.sagaId}`);
  }

  /**
   * Get saga by ID
   */
  getSaga(sagaId: string): Saga | undefined {
    return this.activeSagas.get(sagaId);
  }

  /**
   * Get all active sagas
   */
  getActiveSagas(): Saga[] {
    return Array.from(this.activeSagas.values()).filter(
      (saga) => saga.state === SagaState.RUNNING || saga.state === SagaState.COMPENSATING,
    );
  }

  /**
   * Remove completed saga
   */
  removeSaga(sagaId: string): void {
    this.activeSagas.delete(sagaId);
    this.logger.debug(`Saga ${sagaId} removed from orchestrator`);
  }
}
