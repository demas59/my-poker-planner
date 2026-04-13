import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { MemberRole } from './rooms.types';

describe('RoomsService', () => {
    let service: RoomsService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [RoomsService],
        }).compile();

        service = module.get<RoomsService>(RoomsService);
    });

    it('should create a room with valid ID', () => {
        const room = service.createRoom();

        expect(room.roomId).toHaveLength(6);
        expect(room.roomId).toMatch(/^[A-Z0-9_-]{6}$/);
        expect(room.members).toEqual([]);
        expect(room.votes).toEqual({});
        expect(room.participantsCount).toBe(0);
        expect(room.revealed).toBe(false);
    });

    it('should get a room by ID', () => {
        const createdRoom = service.createRoom();
        const retrievedRoom = service.getRoom(createdRoom.roomId);

        expect(retrievedRoom).toEqual(createdRoom);
    });

    it('should throw NotFoundException for non-existent room', () => {
        expect(() => service.getRoom('NONEXISTENT')).toThrow(NotFoundException);
    });

    it('should join a room and emit events', () => {
        const room = service.createRoom();
        let eventCount = 0;

        service.streamRoom(room.roomId).subscribe((event) => {
            eventCount++;
            const data = event.data as any;
            expect(data.type).toBe('room-updated');
            expect(data.room.roomId).toBe(room.roomId);
        });

        const result = service.joinRoom(room.roomId, 'Alice');
        expect(result.member.name).toBe('Alice');
        expect(result.member.role).toBe(MemberRole.Participant);
        expect(result.room.members).toHaveLength(1);
        expect(eventCount).toBeGreaterThan(0);
    });

    it('should handle voting correctly', () => {
        const room = service.createRoom();
        const { member } = service.joinRoom(room.roomId, 'Alice');

        const votedRoom = service.vote(room.roomId, member.id, '5');
        expect(votedRoom.revealed).toBe(false);
        expect(votedRoom.votes[member.id]).toBe('VOTED'); // Not revealed yet

        const revealedRoom = service.reveal(room.roomId);
        expect(revealedRoom.revealed).toBe(true);
        expect(revealedRoom.votes[member.id]).toBe('5'); // Now revealed
    });

    it('should prevent voting by observers', () => {
        const room = service.createRoom();
        const { member } = service.joinRoom(room.roomId, 'Alice', MemberRole.Observer);

        expect(() => service.vote(room.roomId, member.id, '5')).toThrow(BadRequestException);
    });

    it('should prevent reveal when not all participants voted', () => {
        const room = service.createRoom();
        service.joinRoom(room.roomId, 'Alice');
        service.joinRoom(room.roomId, 'Bob');

        expect(() => service.reveal(room.roomId)).toThrow(BadRequestException);
    });

    it('should reset room correctly', () => {
        const room = service.createRoom();
        const { member } = service.joinRoom(room.roomId, 'Alice');
        service.vote(room.roomId, member.id, '5');
        service.reveal(room.roomId);

        const resetRoom = service.reset(room.roomId);
        expect(resetRoom.revealed).toBe(false);
        expect(resetRoom.votes[member.id]).toBeNull();
    });

    it('should handle leaving room', () => {
        const room = service.createRoom();
        const { member } = service.joinRoom(room.roomId, 'Alice');

        const result = service.leaveRoom(room.roomId, member.id);
        expect(result.left).toBe(true);

        // Room should be deleted when empty
        expect(() => service.getRoom(room.roomId)).toThrow(NotFoundException);
    });

    it('should throw error when leaving non-existent room', () => {
        expect(() => service.leaveRoom('NONEXISTENT', 'member-1')).toThrow(NotFoundException);
    });

    it('should throw error when voting in non-existent room', () => {
        expect(() => service.vote('NONEXISTENT', 'member-1', '5')).toThrow(NotFoundException);
    });
});