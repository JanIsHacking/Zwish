import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateTrainerDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsUUID()
  deviceId?: string;

  @IsInt()
  @Min(1)
  @Max(15)
  resistanceLevelCount!: number;
}

export class UpdateTrainerDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsUUID()
  deviceId?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(100)
  powerScale?: number;
}

export class SetInertiaDto {
  @IsUUID()
  bikeId!: string;

  @IsNumber()
  @Min(0.001)
  @Max(5)
  inertiaKgM2!: number;
}
