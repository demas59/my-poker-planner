import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs/operators';
import { Member, MemberRole, Room } from '../../models/planning.model';
import { PlanningService } from '../../services/planning.service';

@Component({
  selector: 'app-room-page',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './room-page.component.html',
  styleUrl: './room-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoomPageComponent implements OnInit {
  private readonly document = inject(DOCUMENT);
  private readonly planningService = inject(PlanningService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly beforeUnloadHandler = () => this.leaveCurrentRoom(true);

  readonly roomCode = signal('');
  readonly room = signal<Room | null>(null);
  readonly currentMember = signal<Member | null>(null);
  readonly selectedVote = signal<string | null>(null);
  readonly userName = signal('');
  readonly userRole = signal<MemberRole>(MemberRole.Participant);
  readonly joinLoading = signal(false);
  readonly voteLoading = signal(false);
  readonly error = signal('');
  readonly roomNotFound = signal(false);
  readonly recreateLoading = signal(false);
  readonly voteOptions = ['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89', '?'];
  readonly voteColorByValue: Record<string, string> = {
    '0': 'vote-color-0',
    '1': 'vote-color-1',
    '2': 'vote-color-2',
    '3': 'vote-color-3',
    '5': 'vote-color-5',
    '8': 'vote-color-8',
    '13': 'vote-color-13',
    '21': 'vote-color-21',
    '34': 'vote-color-34',
    '55': 'vote-color-55',
    '89': 'vote-color-89',
    '?': 'vote-color-q'
  };
  readonly memberRoleEnum = MemberRole;
  readonly roomUrl = computed(() => {
    const origin = this.document.location?.origin ?? '';
    return `${origin}/room/${this.roomCode()}`;
  });
  readonly participants = computed(() =>
    this.room()?.members.filter((member) => this.normalizeRole(member.role) === MemberRole.Participant) ?? []
  );
  readonly observers = computed(
    () => this.room()?.members.filter((member) => this.normalizeRole(member.role) === MemberRole.Observer) ?? []
  );
  readonly canVote = computed(() => {
    const member = this.currentMember();
    return member !== null && this.normalizeRole(member.role) === MemberRole.Participant;
  });
  readonly canReveal = computed(() => Boolean(this.room() && this.currentMember() && this.room()?.allParticipantsVoted));
  readonly consensusLabel = computed(() => {
    const room = this.room();
    if (!room?.revealed) {
      return '';
    }

    const participantVotes = this.participants()
      .map((member) => room.votes[member.id])
      .filter((vote): vote is string => Boolean(vote) && vote !== 'VOTED');

    if (!participantVotes.length) {
      return 'Aucun vote participant.';
    }

    const firstVote = participantVotes[0];
    const consensus = participantVotes.every((vote) => vote === firstVote);
    return consensus ? `Consensus: oui (${firstVote})` : 'Consensus: non';
  });

  ngOnInit(): void {
    const roomId = this.route.snapshot.paramMap.get('roomId')?.toUpperCase();
    if (!roomId) {
      this.error.set('Code room invalide.');
      return;
    }

    this.roomCode.set(roomId);
    this.hydrateFromNavigationState();
    this.restoreMember();
    this.fetchRoomOnce();
    this.startRoomStream();

    window.addEventListener('beforeunload', this.beforeUnloadHandler);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
    });
  }

  recreateRoom(): void {
    const name = this.userName().trim();
    if (!name) {
      this.error.set('Ton nom est obligatoire pour recreer le salon.');
      return;
    }

    this.recreateLoading.set(true);
    this.error.set('');

    this.planningService
      .createRoom()
      .pipe(switchMap((room) => this.planningService.joinRoom(room.roomId, name, this.userRole())))
      .subscribe({
        next: ({ member, room }) => {
          this.currentMember.set({ ...member, role: this.normalizeRole(member.role) });
          this.persistMember(member.id, member.name);
          this.applyRoomUpdate(room);
          this.recreateLoading.set(false);
          this.router.navigate(['/room', room.roomId], { state: { room, member } });
        },
        error: () => {
          this.error.set('Impossible de recreer le salon.');
          this.recreateLoading.set(false);
        }
      });
  }

  joinRoom(): void {
    const name = this.userName().trim();
    if (!name) {
      this.error.set('Ton nom est obligatoire.');
      return;
    }

    this.joinLoading.set(true);
    this.error.set('');

    this.planningService.joinRoom(this.roomCode(), name, this.userRole()).subscribe({
      next: ({ member, room }) => {
        this.currentMember.set({ ...member, role: this.normalizeRole(member.role) });
        this.applyRoomUpdate(room);
        this.persistMember(member.id, member.name);
        this.joinLoading.set(false);
      },
      error: () => {
        this.error.set('Impossible de rejoindre cette room.');
        this.joinLoading.set(false);
      }
    });
  }

  castVote(value: string): void {
    const room = this.room();
    const currentMember = this.currentMember();

    if (!room || !currentMember || this.voteLoading() || this.normalizeRole(currentMember.role) !== MemberRole.Participant) {
      return;
    }

    this.error.set('');
    this.voteLoading.set(true);
    this.selectedVote.set(value);
    this.planningService.vote(this.roomCode(), currentMember.id, value).subscribe({
      next: (updatedRoom) => {
        this.applyRoomUpdate(updatedRoom);
        this.voteLoading.set(false);
      },
      error: () => {
        this.error.set('Vote impossible.');
        this.voteLoading.set(false);
      }
    });
  }

  onVoteKeydown(event: KeyboardEvent, currentIndex: number): void {
    const key = event.key;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key)) {
      return;
    }

    const buttons = this.getVoteButtons();
    if (!buttons.length || currentIndex < 0 || currentIndex >= buttons.length) {
      return;
    }

    event.preventDefault();
    const columns = this.getVoteGridColumnCount(buttons);
    let nextIndex = currentIndex;

    if (key === 'Home') {
      nextIndex = 0;
    } else if (key === 'End') {
      nextIndex = buttons.length - 1;
    } else if (key === 'ArrowLeft') {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : buttons.length - 1;
    } else if (key === 'ArrowRight') {
      nextIndex = currentIndex < buttons.length - 1 ? currentIndex + 1 : 0;
    } else if (key === 'ArrowUp') {
      nextIndex = Math.max(0, currentIndex - columns);
    } else if (key === 'ArrowDown') {
      nextIndex = Math.min(buttons.length - 1, currentIndex + columns);
    }

    buttons[nextIndex]?.focus();
  }

  revealVotes(): void {
    if (!this.room()) {
      return;
    }

    if (!this.room()?.allParticipantsVoted) {
      this.error.set('Impossible de reveler: tous les participants doivent voter.');
      return;
    }

    this.planningService.reveal(this.roomCode()).subscribe({
      next: (room) => {
        this.applyRoomUpdate(room);
      },
      error: () => {
        this.error.set('Impossible de reveler les votes.');
      }
    });
  }

  resetRound(): void {
    if (!this.room()) {
      return;
    }

    this.selectedVote.set(null);
    this.planningService.reset(this.roomCode()).subscribe({
      next: (room) => {
        this.applyRoomUpdate(room);
      },
      error: () => {
        this.error.set('Impossible de reinitialiser le tour.');
      }
    });
  }

  memberVote(memberId: string): string {
    const room = this.room();
    if (!room) {
      return '-';
    }

    const vote = room.votes[memberId];
    return vote ?? '-';
  }

  voteBucketItems(): Array<{ value: string; count: number; colorClass: string }> {
    const room = this.room();
    if (!room?.revealed) {
      return [];
    }

    const buckets = new Map<string, number>();
    for (const participant of this.participants()) {
      const vote = room.votes[participant.id];
      if (!vote || vote === 'VOTED') {
        continue;
      }

      const typedVote = vote as string;
      buckets.set(typedVote, (buckets.get(typedVote) ?? 0) + 1);
    }

    return [...buckets.entries()]
      .sort((a, b) => this.voteOptions.indexOf(a[0]) - this.voteOptions.indexOf(b[0]))
      .map(([value, count]) => ({
        value,
        count,
        colorClass: this.voteColorClass(value)
      }));
  }

  voteChartItems(): Array<{ value: string; count: number; colorClass: string; heightPercent: number }> {
    const buckets = this.voteBucketItems();
    if (!buckets.length) {
      return [];
    }

    const maxCount = Math.max(...buckets.map((bucket) => bucket.count));
    return buckets.map((bucket) => ({
      ...bucket,
      heightPercent: maxCount > 0 ? (bucket.count / maxCount) * 100 : 0
    }));
  }

  memberVoteClass(memberId: string): string {
    const room = this.room();
    if (!room?.revealed) {
      return '';
    }

    const vote = room.votes[memberId];
    if (!vote || vote === 'VOTED') {
      return '';
    }

    return this.voteColorClass(vote as string);
  }

  private fetchRoomOnce(): void {
    this.planningService.getRoom(this.roomCode()).subscribe({
      next: (room) => {
        this.applyRoomUpdate(room);
      },
      error: () => {
        this.roomNotFound.set(true);
      }
    });
  }

  private startRoomStream(): void {
    this.planningService
      .streamRoom(this.roomCode())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (event) => {
          if (event.type === 'room-updated') {
            this.applyRoomUpdate(event.room);
          }
        },
        error: () => {
          this.error.set('Erreur de synchronisation avec la room.');
        }
      });
  }

  private hydrateFromNavigationState(): void {
    const navigationState = history.state as { room?: Room; member?: Member };
    if (navigationState.room?.roomId?.toUpperCase() === this.roomCode()) {
      this.room.set(navigationState.room);
    }

    if (navigationState.member?.id && navigationState.member?.name) {
      this.currentMember.set(navigationState.member);
      this.userName.set(navigationState.member.name);
      this.userRole.set(this.normalizeRole(navigationState.member.role));
      this.persistMember(navigationState.member.id, navigationState.member.name);
    }
  }

  private restoreMember(): void {
    if (this.currentMember()) {
      return;
    }

    const raw = sessionStorage.getItem(this.memberStorageKey());
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as { memberId?: string; name?: string; role?: MemberRole };
      if (!parsed.memberId || !parsed.name) {
        return;
      }

      this.currentMember.set({
        id: parsed.memberId,
        name: parsed.name,
        role: this.normalizeRole(parsed.role)
      });
      this.userName.set(parsed.name);
      this.userRole.set(this.normalizeRole(parsed.role));
    } catch {
      sessionStorage.removeItem(this.memberStorageKey());
    }
  }

  private persistMember(memberId: string, name: string): void {
    const role = this.currentMember()?.role ?? this.userRole();
    sessionStorage.setItem(this.memberStorageKey(), JSON.stringify({ memberId, name, role }));
  }

  private clearMemberSession(): void {
    sessionStorage.removeItem(this.memberStorageKey());
    this.selectedVote.set(null);
  }

  private applyRoomUpdate(room: Room): void {
    const normalizedRoom: Room = {
      ...room,
      members: room.members.map((member) => ({
        ...member,
        role: this.normalizeRole(member.role)
      }))
    };
    this.room.set(normalizedRoom);

    const currentMember = this.currentMember();

    if (!currentMember) {
      return;
    }

    const existsInRoom = normalizedRoom.members.some((member) => member.id === currentMember.id);
    if (!existsInRoom) {
      this.clearMemberSession();
      this.currentMember.set(null);
      return;
    }

    if (normalizedRoom.revealed) {
      const myVote = normalizedRoom.votes[currentMember.id];
      this.selectedVote.set(
        this.normalizeRole(currentMember.role) === MemberRole.Participant ? ((myVote as string) ?? null) : null
      );
      return;
    }

    if (this.normalizeRole(currentMember.role) !== MemberRole.Participant) {
      this.selectedVote.set(null);
      return;
    }

    if (!normalizedRoom.votes[currentMember.id]) {
      this.selectedVote.set(null);
    }
  }

  private normalizeRole(role: MemberRole | string | undefined): MemberRole {
    return role === MemberRole.Observer ? MemberRole.Observer : MemberRole.Participant;
  }

  private voteColorClass(vote: string): string {
    return this.voteColorByValue[vote] ?? 'vote-color-neutral';
  }

  private getVoteButtons(): HTMLButtonElement[] {
    return Array.from(this.document.querySelectorAll('.votes-grid .vote-card')).filter(
      (element): element is HTMLButtonElement => element instanceof HTMLButtonElement
    );
  }

  private getVoteGridColumnCount(buttons: HTMLButtonElement[]): number {
    if (!buttons.length) {
      return 1;
    }

    const firstRowTop = buttons[0].offsetTop;
    const columns = buttons.filter((button) => button.offsetTop === firstRowTop).length;
    return columns > 0 ? columns : 1;
  }

  private leaveCurrentRoom(useBeacon: boolean): void {
    const member = this.currentMember();
    const roomId = this.roomCode();

    if (!member || !roomId) {
      return;
    }

    if (useBeacon) {
      this.planningService.leaveRoomWithBeacon(roomId, member.id);
      return;
    }

    this.planningService.leaveRoom(roomId, member.id).subscribe({
      next: () => {
        this.clearMemberSession();
        this.currentMember.set(null);
      },
      error: () => {
        // Ignore leave failures in teardown/browser-close paths.
      }
    });
  }

  private memberStorageKey(): string {
    return `pp_member_${this.roomCode()}`;
  }
}
