import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class ReplaceClassSubjectsDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  subjectIds!: string[];
}
