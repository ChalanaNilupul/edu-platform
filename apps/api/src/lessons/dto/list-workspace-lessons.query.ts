import { IsOptional, IsUUID } from 'class-validator';

import { ListLessonsQueryDto } from './list-lessons.query.js';

export class ListWorkspaceLessonsQueryDto extends ListLessonsQueryDto {
  @IsOptional()
  @IsUUID()
  classId?: string;
}
