import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class BikeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsInt()
  @Min(500)
  @Max(3000)
  wheelCircumferenceMm!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @IsInt({ each: true })
  @Min(20, { each: true })
  @Max(70, { each: true })
  chainringTeeth!: number[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(13)
  @IsInt({ each: true })
  @Min(8, { each: true })
  @Max(50, { each: true })
  cogTeeth!: number[];
}
