import { IsEnum, IsNotEmpty, IsString, Length } from 'class-validator';
import { MemberRole } from '../rooms.types';

export class JoinRoomDto {
    @IsString()
    @IsNotEmpty()
    @Length(1, 50)
    name!: string;

    @IsEnum(MemberRole)
    role: MemberRole = MemberRole.Participant;
}

export class VoteDto {
    @IsString()
    @IsNotEmpty()
    memberId!: string;

    @IsString()
    @IsNotEmpty()
    value!: string;
}

export class LeaveRoomDto {
    @IsString()
    @IsNotEmpty()
    memberId!: string;
}