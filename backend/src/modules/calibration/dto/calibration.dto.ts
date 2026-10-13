import { IsIn, IsNumber, IsUUID, Max, Min } from 'class-validator';
import { FIT_KINDS, FitKind } from '../../../domain/coast-down';

export class StartCalibrationDto {
  @IsUUID()
  trainerId!: string;

  @IsUUID()
  bikeId!: string;

  @IsUUID()
  resistanceLevelId!: string;

  @IsNumber()
  @Min(1)
  @Max(15)
  tirePressureBar!: number;
}

export class SelectFitDto {
  @IsIn(FIT_KINDS)
  kind!: FitKind;
}
