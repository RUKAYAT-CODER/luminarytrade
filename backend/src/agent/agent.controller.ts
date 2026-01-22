import { Controller, Get, Post, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { IndexerService } from './indexer.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { SearchAgentsDto } from './dto/search-agent.dto';

@Controller('agents')
export class IndexerController {
  constructor(private readonly indexerService: IndexerService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createAgentDto: CreateAgentDto) {
    return await this.indexerService.create(createAgentDto);
  }

  @Get('search')
  async search(@Query() searchDto: SearchAgentsDto) {
    return await this.indexerService.search(searchDto);
  }

  @Get('top-performers')
  async getTopPerformers(@Query('limit') limit?: number) {
    return await this.indexerService.getTopPerformers(limit);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.indexerService.findOne(id);
  }
}
