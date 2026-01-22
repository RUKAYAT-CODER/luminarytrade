import { IsString, IsOptional, IsArray, IsInt, IsObject, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAgentDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  capabilities?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  evolution_level?: number;
}
