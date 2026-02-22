import {
  Injectable,
  Logger,
  BadRequestException,
  Inject,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import {
  AIResultEntity,
  AIResultStatus,
} from "../entities/ai-result-entity";
import {
  NormalizedScoringResult,
  ScoringRequestDto,
  ScoringResponseDto,
} from "../dto/ai-scoring.dto";
import { AuditLogService } from "../../audit/audit-log.service";
import { AuditEventType } from "../../audit/entities/audit-log.entity";
import { IEventBus } from "../../events/interfaces/event-bus.interface";
import { 
  AIResultCreatedEvent, 
  AIResultCompletedEvent, 
  AIResultFailedEvent 
} from "../../events/domain-events/ai-result.events";
import { AdapterFactory } from "../../adapters/factory/adapter.factory";
import { AdapterRegistry } from "../../adapters/registry/adapter.registry";
import { FallbackHandler } from "../../adapters/patterns/fallback-handler";

/**
 * AI Orchestration Service
 * Handles AI scoring operations using adapter abstraction.
 * Now decoupled from specific AI providers - uses IAIModelAdapter instead.
 */
@Injectable()
export class AIOrchestrationService {
  private readonly logger = new Logger(AIOrchestrationService.name);
  private readonly secretKey: string;
  private readonly fallbackHandler: FallbackHandler<NormalizedScoringResult>;

  constructor(
    @InjectRepository(AIResultEntity)
    private aiResultRepository: Repository<AIResultEntity>,
    private configService: ConfigService,
    private auditLogService: AuditLogService,
    private readonly adapterFactory: AdapterFactory,
    private readonly adapterRegistry: AdapterRegistry,
    @Inject("EventBus")
    private readonly eventBus: IEventBus,
  ) {
    this.secretKey =
      this.configService.get<string>("AI_SIGNATURE_SECRET") ||
      "default-secret-key";
    this.fallbackHandler = new FallbackHandler<NormalizedScoringResult>(
      "AIScoring",
    );
  }

  /**
   * Score user with fallback to multiple AI providers
   */
  async scoreUser(request: ScoringRequestDto): Promise<ScoringResponseDto> {
    // Create initial record
    const aiResult = this.aiResultRepository.create({
      userId: request.userId,
      provider: request.preferredProvider || "default",
      status: AIResultStatus.PENDING,
      request: request.userData,
      retryCount: 0,
    });

    await this.aiResultRepository.save(aiResult);

    // Emit AI Result Created Event
    const aiResultCreatedEvent = new AIResultCreatedEvent(
      aiResult.id,
      {
        userId: aiResult.userId,
        provider: aiResult.provider,
        request: aiResult.request,
      },
    );
    await this.eventBus.publish(aiResultCreatedEvent);

    // Log audit event for scoring started
    await this.auditLogService.logEvent(
      request.userId,
      AuditEventType.AI_SCORING_STARTED,
      {
        resultId: aiResult.id,
        provider: aiResult.provider,
        userData: request.userData,
      },
      `AI scoring initiated for user ${request.userId}`,
      aiResult.id,
      "AIResult",
    );

    // Execute scoring asynchronously
    this.executeScoringAsync(
      aiResult.id,
      request.userId,
      request.userData,
      request.preferredProvider,
    ).catch((error) => {
      this.logger.error(`Async scoring failed for ${aiResult.id}:`, error);
    });

    // Return immediately with pending status
    return {
      resultId: aiResult.id,
      userId: aiResult.userId,
      provider: aiResult.provider,
      creditScore: null,
      riskScore: null,
      riskLevel: null,
      signature: null,
      completedAt: null,
    };
  }

  async getResult(resultId: string): Promise<AIResultEntity> {
    return this.aiResultRepository.findOne({ where: { id: resultId } });
  }

  async getUserResults(
    userId: string,
    limit: number = 10,
  ): Promise<AIResultEntity[]> {
    return this.aiResultRepository.find({
      where: { userId },
      order: { createdAt: "DESC" },
      take: limit,
    });
  }

  /**
   * Execute scoring asynchronously with adapter fallback
   */
  private async executeScoringAsync(
    resultId: string,
    wallet: string,
    userData: Record<string, any>,
    preferredProvider?: string,
  ): Promise<void> {
    const aiResult = await this.aiResultRepository.findOne({
      where: { id: resultId },
    });
    if (!aiResult) return;

    try {
      aiResult.status = AIResultStatus.RETRYING;
      await this.aiResultRepository.save(aiResult);

      // Execute with adapter factory (circuit breaker + fallback)
      const scoringResult =
        await this.adapterFactory.executeAIOperationWithFallback(
          async (adapter) => {
            return await adapter.score(userData);
          },
          preferredProvider,
        );

      // Sign the result
      const signature = this.signResult(scoringResult);

      // Update with success
      aiResult.status = AIResultStatus.SUCCESS;
      aiResult.provider = scoringResult.provider;
      aiResult.response = scoringResult.rawResponse;
      aiResult.creditScore = scoringResult.creditScore;
      aiResult.riskScore = scoringResult.riskScore;
      aiResult.riskLevel = scoringResult.riskLevel;
      aiResult.signature = signature;
      aiResult.completedAt = new Date();

      await this.aiResultRepository.save(aiResult);

      // Emit AI Result Completed Event
      const aiResultCompletedEvent = new AIResultCompletedEvent(
        aiResult.id,
        {
          userId: aiResult.userId,
          provider: scoringResult.provider,
          creditScore: aiResult.creditScore,
          riskScore: aiResult.riskScore,
          riskLevel: aiResult.riskLevel,
          signature: signature,
          completedAt: aiResult.completedAt,
        },
      );
      await this.eventBus.publish(aiResultCompletedEvent);

      // Log audit event for scoring completed
      await this.auditLogService.logEvent(
        wallet,
        AuditEventType.AI_SCORING_COMPLETED,
        {
          resultId: aiResult.id,
          provider: scoringResult.provider,
          creditScore: aiResult.creditScore,
          riskScore: aiResult.riskScore,
          riskLevel: aiResult.riskLevel,
        },
        `AI scoring completed for user ${wallet}`,
        aiResult.id,
        "AIResult",
      );

      this.logger.log(
        `Scoring completed for ${resultId} using ${scoringResult.provider}`,
      );
    } catch (error) {
      aiResult.status = AIResultStatus.FAILED;
      aiResult.errorMessage = error.message;
      await this.aiResultRepository.save(aiResult);

      // Emit AI Result Failed Event
      const aiResultFailedEvent = new AIResultFailedEvent(
        aiResult.id,
        {
          userId: aiResult.userId,
          provider: aiResult.provider,
          errorMessage: error.message,
          failedAt: new Date(),
        },
      );
      await this.eventBus.publish(aiResultFailedEvent);

      // Log audit event for scoring failed
      await this.auditLogService.logEvent(
        wallet,
        AuditEventType.AI_SCORING_FAILED,
        {
          resultId: aiResult.id,
          errorMessage: error.message,
          provider: aiResult.provider,
        },
        `AI scoring failed for user ${wallet}: ${error.message}`,
        aiResult.id,
        "AIResult",
      );

      this.logger.error(`Scoring failed for ${resultId}:`, error);
    }
  }

  private signResult(result: NormalizedScoringResult): string {
    const data = JSON.stringify({
      provider: result.provider,
      creditScore: result.creditScore,
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
      timestamp: Date.now(),
    });

    return crypto
      .createHmac("sha256", this.secretKey)
      .update(data)
      .digest("hex");
  }

  async verifySignature(result: AIResultEntity): Promise<boolean> {
    const data = JSON.stringify({
      provider: result.provider,
      creditScore: result.creditScore,
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
      timestamp: result.completedAt?.getTime(),
    });

    const expectedSignature = crypto
      .createHmac("sha256", this.secretKey)
      .update(data)
      .digest("hex");

    return expectedSignature === result.signature;
  }

  /**
   * Get health status of all registered AI adapters
   */
  async getAdapterHealth(): Promise<Record<string, boolean>> {
    const adapters = this.adapterRegistry.getAllAIAdapters();
    const health: Record<string, boolean> = {};

    for (const adapter of adapters) {
      try {
        health[adapter.getName()] = await adapter.isHealthy();
      } catch (error) {
        health[adapter.getName()] = false;
      }
    }

    return health;
  }
}
