import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class StartWorkoutDto {
  @IsUUID()
  trainerId!: string;

  @IsUUID()
  bikeId!: string;

  @IsIn(['free', 'planned', 'zone_test'])
  kind!: 'free' | 'planned' | 'zone_test';

  @IsOptional()
  @IsIn(['ramp', 'twenty_minute'])
  zoneTestProtocol?: 'ramp' | 'twenty_minute';

  @IsOptional()
  @IsUUID()
  planSessionId?: string;

  @IsOptional()
  @IsUUID()
  resistanceLevelId?: string;

  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(70)
  chainringTeeth?: number;

  @IsOptional()
  @IsInt()
  @Min(8)
  @Max(50)
  cogTeeth?: number;
}

export class SetupDto {
  @IsOptional()
  @IsUUID()
  trainerId?: string;

  @IsOptional()
  @IsUUID()
  bikeId?: string;

  @IsOptional()
  @IsUUID()
  resistanceLevelId?: string;

  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(70)
  chainringTeeth?: number;

  @IsOptional()
  @IsInt()
  @Min(8)
  @Max(50)
  cogTeeth?: number;
}
