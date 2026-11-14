import { IsOptional, Matches } from 'class-validator';

export class FinanceReportQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month must be a YYYY-MM month' })
  month?: string;
}
