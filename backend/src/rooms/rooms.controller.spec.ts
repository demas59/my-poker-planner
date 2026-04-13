import { Test, TestingModule } from '@nestjs/testing';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { MemberRole } from './rooms.types';

describe('RoomsController', () => {
    let controller: RoomsController;
    let service: RoomsService;

    beforeEach(async () => {
        const mockService = {
            createRoom: jest.fn(),
            getRoom: jest.fn(),
            streamRoom: jest.fn(),
            joinRoom: jest.fn(),
            vote: jest.fn(),
            reveal: jest.fn(),
            reset: jest.fn(),
            leaveRoom: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [RoomsController],
            providers: [
                {
                    provide: RoomsService,
                    useValue: mockService,
                },
            ],
        }).compile();

        controller = module.get<RoomsController>(RoomsController);
        service = module.get<RoomsService>(RoomsService);
    });

    it('should delegate room creation to service', () => {
        const mockResult = {
            roomId: 'ROOM01',
            members: [],
            revealed: false,
            votes: {},
            participantsCount: 0,
            participantsVotedCount: 0,
            allParticipantsVoted: false,
            updatedAt: '2024-01-01T00:00:00.000Z'
        };
        jest.spyOn(service, 'createRoom').mockReturnValue(mockResult);

        expect(controller.createRoom()).toEqual(mockResult);
        expect(service.createRoom).toHaveBeenCalled();
    });

    it('should delegate room retrieval to service', () => {
        const mockResult = {
            roomId: 'room42',
            members: [],
            revealed: false,
            votes: {},
            participantsCount: 0,
            participantsVotedCount: 0,
            allParticipantsVoted: false,
            updatedAt: '2024-01-01T00:00:00.000Z'
        };
        jest.spyOn(service, 'getRoom').mockReturnValue(mockResult);

        expect(controller.getRoom('room42')).toEqual(mockResult);
        expect(service.getRoom).toHaveBeenCalledWith('room42');
    });

    it('should delegate room streaming to service', () => {
        const mockResult = { roomId: 'room42', stream: true };
        jest.spyOn(service, 'streamRoom').mockReturnValue(mockResult as any);

        expect(controller.streamRoom('room42')).toEqual(mockResult);
        expect(service.streamRoom).toHaveBeenCalledWith('room42');
    });

    it('should delegate room joining to service with trimmed name', () => {
        const mockResult = {
            member: { id: 'member-1', name: 'Alice', role: MemberRole.Participant },
            room: {
                roomId: 'room42',
                members: [{ id: 'member-1', name: 'Alice', role: MemberRole.Participant }],
                revealed: false,
                votes: { 'member-1': null },
                participantsCount: 1,
                participantsVotedCount: 0,
                allParticipantsVoted: false,
                updatedAt: '2024-01-01T00:00:00.000Z'
            }
        };
        jest.spyOn(service, 'joinRoom').mockReturnValue(mockResult);

        expect(controller.joinRoom('room42', { name: '  Alice  ', role: MemberRole.Participant })).toEqual(mockResult);
        expect(service.joinRoom).toHaveBeenCalledWith('room42', 'Alice', MemberRole.Participant);
    });

    it('should delegate voting to service', () => {
        const mockResult = {
            roomId: 'room42',
            members: [{ id: 'member-1', name: 'Alice', role: MemberRole.Participant }],
            revealed: false,
            votes: { 'member-1': 'VOTED' },
            participantsCount: 1,
            participantsVotedCount: 1,
            allParticipantsVoted: true,
            updatedAt: '2024-01-01T00:00:00.000Z'
        };
        jest.spyOn(service, 'vote').mockReturnValue(mockResult);

        expect(controller.vote('room42', { memberId: 'member-1', value: '8' })).toEqual(mockResult);
        expect(service.vote).toHaveBeenCalledWith('room42', 'member-1', '8');
    });

    it('should delegate reveal to service', () => {
        const mockResult = {
            roomId: 'room42',
            members: [{ id: 'member-1', name: 'Alice', role: MemberRole.Participant }],
            revealed: true,
            votes: { 'member-1': '8' },
            participantsCount: 1,
            participantsVotedCount: 1,
            allParticipantsVoted: true,
            updatedAt: '2024-01-01T00:00:00.000Z'
        };
        jest.spyOn(service, 'reveal').mockReturnValue(mockResult);

        expect(controller.reveal('room42')).toEqual(mockResult);
        expect(service.reveal).toHaveBeenCalledWith('room42');
    });

    it('should delegate reset to service', () => {
        const mockResult = {
            roomId: 'room42',
            members: [{ id: 'member-1', name: 'Alice', role: MemberRole.Participant }],
            revealed: false,
            votes: {},
            participantsCount: 1,
            participantsVotedCount: 0,
            allParticipantsVoted: false,
            updatedAt: '2024-01-01T00:00:00.000Z'
        };
        jest.spyOn(service, 'reset').mockReturnValue(mockResult);

        expect(controller.reset('room42')).toEqual(mockResult);
        expect(service.reset).toHaveBeenCalledWith('room42');
    });

    it('should delegate leave room to service', () => {
        const mockResult = { left: true };
        jest.spyOn(service, 'leaveRoom').mockReturnValue(mockResult);

        expect(controller.leaveRoom('room42', { memberId: 'member-1' })).toEqual(mockResult);
        expect(service.leaveRoom).toHaveBeenCalledWith('room42', 'member-1');
    });
});