import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

const toBoolean = ({ value }: { value: unknown }) => {
  if (value === undefined || value === '') {
    return undefined;
  }

  if (value === 'true' || value === true) {
    return true;
  }

  if (value === 'false' || value === false) {
    return false;
  }

  return value;
};

export class ListClassTeachersQueryDto {
  @Transform(toBoolean)
  @IsOptional()
  @IsBoolean()
  includeEnded?: boolean;
}
