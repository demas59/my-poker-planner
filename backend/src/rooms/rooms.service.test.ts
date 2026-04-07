import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RoomsService } from './rooms.service';

test('RoomsService manages room lifecycle and streaming updates', () => {
  const service = new RoomsService();

  const createdRoom = service.createRoom();
  assert.equal(createdRoom.roomId.length, 6);
  assert.match(createdRoom.roomId, /^[A-Z0-9_-]{6}$/);
  assert.deepEqual(createdRoom.members, []);
  assert.deepEqual(createdRoom.votes, {});
  assert.deepEqual(createdRoom.fibonacci, ['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89', '?']);

  const streamedEvents: unknown[] = [];
  const subscription = service.streamRoom(createdRoom.roomId).subscribe((event) => {
    streamedEvents.push(event.data);
  });

  assert.equal(streamedEvents.length, 0);

  const joined = service.joinRoom(createdRoom.roomId.toLowerCase(), 'Alice');
  assert.equal(joined.member.name, 'Alice');
  assert.equal(joined.room.members.length, 1);
  assert.equal(joined.room.votes[joined.member.id], null);
  assert.equal(streamedEvents.length, 1);
  assert.deepEqual(streamedEvents[0], {
    type: 'room-updated',
    room: joined.room
  });

  const votedRoom = service.vote(createdRoom.roomId, joined.member.id, '5');
  assert.equal(votedRoom.revealed, false);
  assert.equal(votedRoom.votes[joined.member.id], 'VOTED');
  assert.equal(streamedEvents.length, 2);

  const revealedRoom = service.reveal(createdRoom.roomId);
  assert.equal(revealedRoom.revealed, true);
  assert.equal(revealedRoom.votes[joined.member.id], '5');
  assert.equal(streamedEvents.length, 3);

  const resetRoom = service.reset(createdRoom.roomId);
  assert.equal(resetRoom.revealed, false);
  assert.equal(resetRoom.votes[joined.member.id], null);
  assert.equal(streamedEvents.length, 4);

  const roomStreams = (service as unknown as { roomStreams: Map<string, Set<unknown>> }).roomStreams;
  assert.equal(roomStreams.get(createdRoom.roomId)?.size, 1);

  subscription.unsubscribe();

  assert.equal(roomStreams.has(createdRoom.roomId), false);
});

test('RoomsService rejects unknown rooms, invalid vote values, and unknown members', () => {
  const service = new RoomsService();
  const createdRoom = service.createRoom();
  const joined = service.joinRoom(createdRoom.roomId, 'Bob');

  assert.throws(() => service.getRoom('missing'), (error: unknown) => {
    assert.ok(error instanceof NotFoundException);
    assert.equal(error.message, 'Salon introuvable.');
    return true;
  });

  assert.throws(() => service.vote(createdRoom.roomId, joined.member.id, '99' as never), (error: unknown) => {
    assert.ok(error instanceof BadRequestException);
    assert.equal(error.message, 'Valeur de vote invalide.');
    return true;
  });

  assert.throws(() => service.vote(createdRoom.roomId, 'unknown-member', '3'), (error: unknown) => {
    assert.ok(error instanceof NotFoundException);
    assert.equal(error.message, 'Participant introuvable dans ce salon.');
    return true;
  });
});
