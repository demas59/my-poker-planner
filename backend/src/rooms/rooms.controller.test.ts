import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { RoomsController } from './rooms.controller';
import { VoteValue } from './rooms.types';

test('RoomsController delegates room actions to the service', () => {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const service = {
    createRoom: () => {
      calls.push({ method: 'createRoom', args: [] });
      return { roomId: 'ROOM01' };
    },
    getRoom: (roomId: string) => {
      calls.push({ method: 'getRoom', args: [roomId] });
      return { roomId };
    },
    streamRoom: (roomId: string) => {
      calls.push({ method: 'streamRoom', args: [roomId] });
      return { roomId, stream: true };
    },
    joinRoom: (roomId: string, name: string) => {
      calls.push({ method: 'joinRoom', args: [roomId, name] });
      return { roomId, name };
    },
    vote: (roomId: string, memberId: string, value: VoteValue) => {
      calls.push({ method: 'vote', args: [roomId, memberId, value] });
      return { roomId, memberId, value };
    },
    reveal: (roomId: string) => {
      calls.push({ method: 'reveal', args: [roomId] });
      return { roomId, revealed: true };
    },
    reset: (roomId: string) => {
      calls.push({ method: 'reset', args: [roomId] });
      return { roomId, reset: true };
    }
  };

  const controller = new RoomsController(service as never);

  assert.deepEqual(controller.createRoom(), { roomId: 'ROOM01' });
  assert.deepEqual(controller.getRoom('room42'), { roomId: 'room42' });
  assert.deepEqual(controller.streamRoom('room42'), { roomId: 'room42', stream: true });
  assert.deepEqual(controller.joinRoom('room42', { name: '  Alice  ' }), { roomId: 'room42', name: 'Alice' });
  assert.deepEqual(controller.vote('room42', { memberId: 'member-1', value: '8' }), {
    roomId: 'room42',
    memberId: 'member-1',
    value: '8'
  });
  assert.deepEqual(controller.reveal('room42'), { roomId: 'room42', revealed: true });
  assert.deepEqual(controller.reset('room42'), { roomId: 'room42', reset: true });

  assert.deepEqual(calls, [
    { method: 'createRoom', args: [] },
    { method: 'getRoom', args: ['room42'] },
    { method: 'streamRoom', args: ['room42'] },
    { method: 'joinRoom', args: ['room42', 'Alice'] },
    { method: 'vote', args: ['room42', 'member-1', '8'] },
    { method: 'reveal', args: ['room42'] },
    { method: 'reset', args: ['room42'] }
  ]);
});

test('RoomsController validates required payload fields', () => {
  const service = {};
  const controller = new RoomsController(service as never);

  assert.throws(() => controller.joinRoom('room42', {}), (error: unknown) => {
    assert.ok(error instanceof BadRequestException);
    assert.equal(error.message, 'Le nom est obligatoire.');
    return true;
  });

  assert.throws(() => controller.joinRoom('room42', { name: '   ' }), (error: unknown) => {
    assert.ok(error instanceof BadRequestException);
    assert.equal(error.message, 'Le nom est obligatoire.');
    return true;
  });

  assert.throws(() => controller.vote('room42', { value: '5' }), (error: unknown) => {
    assert.ok(error instanceof BadRequestException);
    assert.equal(error.message, 'memberId et value sont obligatoires.');
    return true;
  });

  assert.throws(() => controller.vote('room42', { memberId: 'member-1' }), (error: unknown) => {
    assert.ok(error instanceof BadRequestException);
    assert.equal(error.message, 'memberId et value sont obligatoires.');
    return true;
  });
});
