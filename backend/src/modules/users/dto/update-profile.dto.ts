import { IsArray, IsInt, IsNumber, IsOptional, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class HrZoneDto {
  @IsInt()
  @Min(1)
  @Max(7)
  zone!: number;

  @IsInt()
  @Min(30)
  @Max(230)
  minBpm!: number;

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(230)
  maxBpm!: number | null;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(600)
  ftpWatts?: number | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HrZoneDto)
  hrZoneBounds?: HrZoneDto[];
}
