import { IsString, Matches } from 'class-validator';

export class GenerateStudentFeesDto {
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'period must be a YYYY-MM month',
  })
  period!: string;
}
