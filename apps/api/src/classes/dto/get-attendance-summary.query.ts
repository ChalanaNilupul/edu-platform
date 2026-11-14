import { IsDateString } from 'class-validator';

export class GetAttendanceSummaryQueryDto {
  @IsDateString({ strict: true }, { message: 'from must be a YYYY-MM-DD calendar date' })
  from!: string;

  @IsDateString({ strict: true }, { message: 'to must be a YYYY-MM-DD calendar date' })
  to!: string;
}
