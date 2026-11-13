import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { StudentStatus } from '../../generated/prisma/client.js';
import { MAX_IMPORT_CSV_CHARS } from '../csv.js';
import { CreateStudentDto } from './create-student.dto.js';

export class ImportStudentsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_IMPORT_CSV_CHARS)
  csv!: string;
}

export class ImportStudentRowDto extends CreateStudentDto {
  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;
}
