import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AcceptInvitationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  token!: string;
}
