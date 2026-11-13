import { Transform } from 'class-transformer';
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateEnrollmentDto {
  @IsUUID()
  studentId!: string;

  @IsOptional()
  @IsDateString({}, { message: 'enrolledAt must be an ISO date' })
  enrolledAt?: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
