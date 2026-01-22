import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, Between, In } from 'typeorm';
import { Agent } from './entities/agent.entity';
import { CreateAgentDto } from './dto/create-agent.dto';
import { SearchAgentsDto, SortOrder } from './dto/search-agent.dto';

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

@Injectable()
export class IndexerService {
  constructor(
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
  ) {}

  async create(createAgentDto: CreateAgentDto): Promise<Agent> {
    const agent = this.agentRepository.create(createAgentDto);
    return await this.agentRepository.save(agent);
  }

  async search(searchDto: SearchAgentsDto): Promise<PaginatedResponse<Agent>> {
    const { page, limit, sort_by, order, name, capabilities, evolution_level_min, evolution_level_max } = searchDto;

    const queryBuilder = this.agentRepository.createQueryBuilder('agent');

    // Apply filters
    if (name) {
      queryBuilder.andWhere('agent.name ILIKE :name', { name: `%${name}%` });
    }

    if (capabilities && capabilities.length > 0) {
      queryBuilder.andWhere('agent.capabilities @> :capabilities', {
        capabilities: JSON.stringify(capabilities),
      });
    }

    if (evolution_level_min !== undefined) {
      queryBuilder.andWhere('agent.evolution_level >= :min', { min: evolution_level_min });
    }

    if (evolution_level_max !== undefined) {
      queryBuilder.andWhere('agent.evolution_level <= :max', { max: evolution_level_max });
    }

    // Apply sorting
    const orderDirection = order === SortOrder.ASC ? 'ASC' : 'DESC';
    queryBuilder.orderBy(`agent.${sort_by}`, orderDirection);

    // Apply pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    // Execute query
    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<Agent> {
    const agent = await this.agentRepository.findOne({ where: { id } });
    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }
    return agent;
  }

  async updatePerformanceMetrics(
    id: string,
    metrics: Partial<Agent['performance_metrics']>,
  ): Promise<Agent> {
    const agent = await this.findOne(id);
    agent.performance_metrics = { ...agent.performance_metrics, ...metrics };
    return await this.agentRepository.save(agent);
  }

  async getTopPerformers(limit: number = 10): Promise<Agent[]> {
    return await this.agentRepository
      .createQueryBuilder('agent')
      .orderBy("(agent.performance_metrics->>'success_rate')::float", 'DESC')
      .limit(limit)
      .getMany();
  }
}
