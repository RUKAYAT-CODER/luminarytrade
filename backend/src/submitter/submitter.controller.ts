import { Controller, Post, Get, Param, Body, Query } from '@nestjs/common';
import { SubmitterService } from './submitter.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { SubmissionStatus } from './entities/submission.entity';

@Controller('submissions')
export class SubmitterController {
  constructor(private readonly submitterService: SubmitterService) {}

  @Post()
  async createSubmission(@Body() dto: CreateSubmissionDto) {
    return this.submitterService.createSubmission(dto);
  }

  @Post('batch')
  async createBatch(@Body() dtos: CreateSubmissionDto[]) {
    return this.submitterService.createBatch(dtos);
  }

  @Get()
  async listSubmissions(@Query('status') status?: SubmissionStatus) {
    return this.submitterService.listSubmissions(status);
  }

  @Get(':id')
  async getSubmission(@Param('id') id: string) {
    return this.submitterService.getSubmission(id);
  }

  @Get('key/:key')
  async getByKey(@Param('key') key: string) {
    return this.submitterService.getByIdempotencyKey(key);
  }
}
