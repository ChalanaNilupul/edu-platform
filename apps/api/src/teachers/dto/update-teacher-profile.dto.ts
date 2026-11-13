import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

const trimList = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? value.map((item) => (typeof item === 'string' ? item.trim() : item))
    : value;

export class UpdateTeacherProfileDto {
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  qualifications?: string | null;

  @Transform(trimList)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  specializations?: string[];

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string | null;

  @IsOptional()
  @IsDateString()
  joinedAt?: string | null;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}
