import { IsBoolean } from 'class-validator';

export class UpdateClassTeacherDto {
  @IsBoolean()
  isPrimary!: boolean;
}
