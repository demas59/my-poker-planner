import { BadRequestException, Body, Controller, Get, Param, Post, Sse } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { VoteValue } from './rooms.types';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

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
  joinRoom(@Param('roomId') roomId: string, @Body() body: { name?: string }) {
    const name = body?.name?.trim();
    if (!name) {
      throw new BadRequestException('Le nom est obligatoire.');
    }

    return this.roomsService.joinRoom(roomId, name);
  }

  @Post(':roomId/vote')
  vote(
    @Param('roomId') roomId: string,
    @Body() body: { memberId?: string; value?: VoteValue }
  ) {
    if (!body.memberId || !body.value) {
      throw new BadRequestException('memberId et value sont obligatoires.');
    }

    return this.roomsService.vote(roomId, body.memberId, body.value);
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
