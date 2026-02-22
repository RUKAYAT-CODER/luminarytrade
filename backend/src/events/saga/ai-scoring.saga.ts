import { Injectable, Logger } from '@nestjs/common';
import { Saga, SagaStep, SagaState } from './base-saga.class';
import { AIOrchestrationService } from '../../compute-bridge/service/ai-orchestration.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { NestEventBus } from '../bus/nest-event-bus.service';
import { AIResultCompletedEvent, AIResultFailedEvent } from '../domain/ai-result.events';
import { AIResultStatus } from '../../compute-bridge/entities/ai-result-entity';

export interface AIScoringContext {
  userId: string;
  userData: Record<string, any>;
  provider?: string;
}

export interface AIScoringResult {
  resultId: string;
  creditScore: number;
  riskScore: number;
  riskLevel: string;
  signature: string;
}

/**
 * AI Scoring Saga
 * Coordinates AI scoring and audit logging as a distributed transaction
 */
@Injectable()
export class AIScoringSaga extends Saga<AIScoringContext> {
  constructor(
    private readonly aiOrchestrationService: AIOrchestrationService,
    private readonly auditLogService: AuditLogService,
    private readonly eventBus: NestEventBus,
  ) {
    super('AIScoringSaga');
    this.initializeSteps();
  }

  private initializeSteps(): void {
    // Step 1: Initialize AI scoring
    this.addStep({
      name: 'InitializeAIScoring',
      execute: async (context: AIScoringContext) => {
        const response = await this.aiOrchestrationService.scoreUser({
          userId: context.userId,
          userData: context.userData,
          preferredProvider: context.provider as any,
        });

        return {
          resultId: response.resultId,
          userId: context.userId,
        };
      },
      compensate: async (result: any) => {
        // Compensation: Could mark the AI result as cancelled
        this.logger.warn(`Compensation for InitializeAIScoring - result: ${result.resultId}`);
      },
    });

    // Step 2: Wait for scoring completion (handled asynchronously)
    // This is a simplified step - in production you'd use a more sophisticated approach
    this.addStep({
      name: 'WaitForScoringCompletion',
      execute: async (context: AIScoringContext) => {
        // Poll for completion or wait for event
        const maxAttempts = 10;
        const delayMs = 1000;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          const result = await this.aiOrchestrationService.getResult(
            this.stepResults.get('InitializeAIScoring').resultId,
          );

          if (result.status === AIResultStatus.SUCCESS) {
            return {
              resultId: result.id,
              creditScore: result.creditScore,
              riskScore: result.riskScore,
              riskLevel: result.riskLevel,
              signature: result.signature,
            };
          } else if (result.status === AIResultStatus.FAILED) {
            throw new Error(`AI scoring failed: ${result.errorMessage}`);
          }

          await this.sleep(delayMs);
        }

        throw new Error('AI scoring timed out');
      },
      compensate: async (result: any) => {
        this.logger.warn(`Compensation for WaitForScoringCompletion - result: ${result.resultId}`);
      },
    });

    // Step 3: Create audit log
    this.addStep({
      name: 'CreateAuditLog',
      execute: async (context: AIScoringContext) => {
        const scoringResult = this.stepResults.get('WaitForScoringCompletion');

        const auditLog = await this.auditLogService.logEvent(
          context.userId,
          'AI_SCORING_SAGA_COMPLETED' as any,
          {
            resultId: scoringResult.resultId,
            creditScore: scoringResult.creditScore,
            riskScore: scoringResult.riskScore,
            riskLevel: scoringResult.riskLevel,
          },
          `AI scoring saga completed for user ${context.userId}`,
          scoringResult.resultId,
          'AIResult',
        );

        return { auditLogId: auditLog.id };
      },
      compensate: async (result: any) => {
        this.logger.warn(`Compensation for CreateAuditLog - audit log: ${result.auditLogId}`);
      },
    });

    // Step 4: Publish completion event
    this.addStep({
      name: 'PublishCompletionEvent',
      execute: async (context: AIScoringContext) => {
        const scoringResult = this.stepResults.get('WaitForScoringCompletion');

        const event = new AIResultCompletedEvent({
          aggregateId: scoringResult.resultId,
          userId: context.userId,
          provider: context.provider || 'unknown',
          creditScore: scoringResult.creditScore,
          riskScore: scoringResult.riskScore,
          riskLevel: scoringResult.riskLevel,
          signature: scoringResult.signature,
        });

        await this.eventBus.publish(event);

        return { eventId: event.eventId };
      },
      compensate: async (result: any) => {
        this.logger.warn(`Compensation for PublishCompletionEvent - event: ${result.eventId}`);
      },
    });
  }

  /**
   * Execute the scoring saga
   */
  async execute(context: AIScoringContext): Promise<AIScoringResult> {
    const result = await super.execute(context);
    return {
      resultId: result.get('WaitForScoringCompletion').resultId,
      creditScore: result.get('WaitForScoringCompletion').creditScore,
      riskScore: result.get('WaitForScoringCompletion').riskScore,
      riskLevel: result.get('WaitForScoringCompletion').riskLevel,
      signature: result.get('WaitForScoringCompletion').signature,
    };
  }

  /**
   * Execute with failure event publishing
   */
  async executeWithFailureHandling(context: AIScoringContext): Promise<AIScoringResult> {
    try {
      return await this.execute(context);
    } catch (error) {
      // Publish failure event
      const failedEvent = new AIResultFailedEvent({
        aggregateId: this.stepResults.get('InitializeAIScoring')?.resultId || 'unknown',
        userId: context.userId,
        provider: context.provider || 'unknown',
        errorMessage: (error as Error).message,
      });

      try {
        await this.eventBus.publish(failedEvent);
      } catch (eventError) {
        this.logger.error(`Failed to publish failure event: ${(eventError as Error).message}`);
      }

      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
