import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { SubmitterService } from './submitter.service';
import { Submission } from './entities/submission.entity';

describe('SubmitterService', () => {
  let service: SubmitterService;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockQueue = {
    add: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubmitterService,
        {
          provide: getRepositoryToken(Submission),
          useValue: mockRepository,
        },
        {
          provide: getQueueToken('submissions'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<SubmitterService>(SubmitterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create submission with idempotency', async () => {
    mockRepository.findOne.mockResolvedValue(null);
    mockRepository.create.mockReturnValue({ id: '123' });
    mockRepository.save.mockResolvedValue({ id: '123' });

    const dto = {
      idempotencyKey: 'test-key',
      payload: { documentHash: 'abc123' },
    };

    const result = await service.createSubmission(dto);
    expect(result).toBeDefined();
    expect(mockQueue.add).toHaveBeenCalled();
  });
});
