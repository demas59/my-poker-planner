import { BadRequestException, Body, Controller, Get, Param, Post, Sse } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { JoinRoomDto, VoteDto, LeaveRoomDto } from './dto';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) { }

  @Post()
  createRoom() {
    return this.roomsService.createRoom();
  }

  @Get(':roomId')
  getRoom(@Param('roomId') roomId: string) {
    return this.roomsService.getRoom(roomId);
  }

  @Sse(':roomId/events')
  streamRoom(@Param('roomId') roomId: string) {
    return this.roomsService.streamRoom(roomId);
  }

  @Post(':roomId/join')
  joinRoom(@Param('roomId') roomId: string, @Body() joinRoomDto: JoinRoomDto) {
    return this.roomsService.joinRoom(roomId, joinRoomDto.name.trim(), joinRoomDto.role);
  }

  @Post(':roomId/vote')
  vote(@Param('roomId') roomId: string, @Body() voteDto: VoteDto) {
    return this.roomsService.vote(roomId, voteDto.memberId, voteDto.value);
  }

  @Post(':roomId/leave')
  leaveRoom(@Param('roomId') roomId: string, @Body() leaveRoomDto: LeaveRoomDto) {
    return this.roomsService.leaveRoom(roomId, leaveRoomDto.memberId);
  }

  @Post(':roomId/reveal')
  reveal(@Param('roomId') roomId: string) {
    return this.roomsService.reveal(roomId);
  }

  @Post(':roomId/reset')
  reset(@Param('roomId') roomId: string) {
    return this.roomsService.reset(roomId);
  }
}
