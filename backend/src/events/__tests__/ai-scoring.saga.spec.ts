import { Test, TestingModule } from '@nestjs/testing';
import { AIScoringSaga } from '../saga/ai-scoring.saga';
import { NestEventBus } from '../nest-event-bus.service';
import { AIResultCreatedEvent, AIResultCompletedEvent } from '../domain-events/ai-result.events';

describe('AIScoringSaga', () => {
  let saga: AIScoringSaga;
  let eventBus: NestEventBus;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIScoringSaga,
        {
          provide: NestEventBus,
          useValue: {
            publish: jest.fn(),
          },
        },
      ],
    }).compile();

    saga = module.get<AIScoringSaga>(AIScoringSaga);
    eventBus = module.get<NestEventBus>(NestEventBus);
  });

  it('should be defined', () => {
    expect(saga).toBeDefined();
  });

  describe('execute', () => {
    it('should execute all saga steps successfully', async () => {
      const resultId = 'test-result-id';
      const userId = 'user-123';
      const provider = 'openai';
      const request = { data: 'test' };

      jest.spyOn(eventBus, 'publish').mockResolvedValue();

      await saga.execute();

      const sagaData = saga.getData();
      expect(sagaData.state).toBe('completed');
      expect(eventBus.publish).toHaveBeenCalledTimes(4); // 4 steps in the saga
    });

    it('should handle step failures and compensate', async () => {
      const resultId = 'test-result-id';
      const userId = 'user-123';
      const provider = 'openai';
      const request = { data: 'test' };

      jest.spyOn(eventBus, 'publish').mockRejectedValue(new Error('Step failed'));

      await saga.execute();

      const sagaData = saga.getData();
      expect(sagaData.state).toBe('compensated');
      expect(sagaData.error).toBeDefined();
    });
  });

  describe('handleScoringCompleted', () => {
    it('should publish AI result completed event', async () => {
      const creditScore = 750;
      const riskScore = 25;
      const riskLevel = 'low';
      const signature = 'test-signature';

      jest.spyOn(eventBus, 'publish').mockResolvedValue();

      saga.handleScoringCompleted(creditScore, riskScore, riskLevel, signature);

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'AIResultCompleted',
          payload: expect.objectContaining({
            creditScore,
            riskScore,
            riskLevel,
            signature,
          }),
        }),
      );
    });
  });

  describe('handleScoringFailed', () => {
    it('should publish AI result failed event', async () => {
      const errorMessage = 'Scoring failed';

      jest.spyOn(eventBus, 'publish').mockResolvedValue();

      saga.handleScoringFailed(errorMessage);

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'AIResultFailed',
          payload: expect.objectContaining({
            errorMessage,
          }),
        }),
      );
    });
  });
});
