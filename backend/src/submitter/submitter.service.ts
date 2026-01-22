import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Repository } from 'typeorm';
import { Queue } from 'bull';
import { Submission, SubmissionStatus } from './entities/submission.entity';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SubmitterService {
  constructor(
    @InjectRepository(Submission)
    private submissionRepository: Repository<Submission>,
    @InjectQueue('submissions')
    private submissionQueue: Queue,
  ) {}

  async createSubmission(dto: CreateSubmissionDto): Promise<Submission> {
    // Check for existing submission with same idempotency key
    const existing = await this.submissionRepository.findOne({
      where: { idempotencyKey: dto.idempotencyKey },
    });

    if (existing) {
      throw new ConflictException(
        `Submission with idempotency key ${dto.idempotencyKey} already exists`,
      );
    }

    // Create submission
    const submission = this.submissionRepository.create({
      idempotencyKey: dto.idempotencyKey,
      payload: dto.payload,
      status: SubmissionStatus.PENDING,
    });

    await this.submissionRepository.save(submission);

    // Queue for processing
    await this.submissionQueue.add('submit-single', {
      submissionId: submission.id,
    });

    return submission;
  }

  async getSubmission(id: string): Promise<Submission> {
    const submission = await this.submissionRepository.findOne({
      where: { id },
    });

    if (!submission) {
      throw new NotFoundException(`Submission ${id} not found`);
    }

    return submission;
  }

  async getByIdempotencyKey(key: string): Promise<Submission> {
    return this.submissionRepository.findOne({
      where: { idempotencyKey: key },
    });
  }

  async listSubmissions(status?: SubmissionStatus): Promise<Submission[]> {
    if (status) {
      return this.submissionRepository.find({ where: { status } });
    }
    return this.submissionRepository.find({ take: 100 });
  }

  async createBatch(dtos: CreateSubmissionDto[]): Promise<Submission[]> {
    const submissions: Submission[] = [];

    for (const dto of dtos) {
      const submission = await this.createSubmission(dto);
      submissions.push(submission);
    }

    // Queue batch processing
    await this.submissionQueue.add('submit-batch', {
      submissionIds: submissions.map(s => s.id),
    });

    return submissions;
  }
}
