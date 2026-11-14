import { IsDateString } from 'class-validator';

export class GetAttendanceQueryDto {
  @IsDateString({ strict: true }, { message: 'date must be a YYYY-MM-DD calendar date' })
  date!: string;
}
