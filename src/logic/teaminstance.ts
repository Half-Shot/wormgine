import { BehaviorSubject, first, combineLatest, map } from "rxjs";
import { getDefinitionForCode } from "../weapons";
import { IWeaponDefiniton, IWeaponCode } from "../weapons/weapon";
import { TeamInstanceInterface, TeamDefinition } from "./teams";
import { WormInstance } from "./worminstance";

export class TeamInstance implements TeamInstanceInterface {
    public readonly worms: WormInstance[];
    private nextWormStack: WormInstance[];
    public readonly ammo: TeamDefinition["ammo"];

    public get availableWeapons() {
        return Object.entries(this.ammo)
            .filter(([_code, ammo]) => ammo !== 0)
            .map<[IWeaponDefiniton, number]>(([code, ammo]) => [
                getDefinitionForCode(code as IWeaponCode),
                ammo,
            ]);
    }

    // XXX: Stopgap until we can rxjs more things.
    private healthSubject = new BehaviorSubject<number>(0);
    public readonly health$ = this.healthSubject.asObservable();
    public readonly maxHealth$ = this.healthSubject.pipe(first((v) => v !== 0));

    /**
     * @deprecated Stopgap, use health.
     */
    public get health() {
        return this.healthSubject.value;
    }

    constructor(private readonly team: TeamDefinition) {
        this.worms = team.worms.map((w) => new WormInstance(w, this));
        this.nextWormStack = [...this.worms];
        this.ammo = { ...team.ammo };
        combineLatest(this.worms.map((w) => w.health$))
            .pipe(map<number[], number>((v) => v.reduce((p, c) => p + c)))
            .subscribe((v) => this.healthSubject.next(v));
    }

    get name() {
        return this.team.name;
    }

    get uuid() {
        return this.team.uuid;
    }

    get playerUserId() {
        return this.team.playerUserId;
    }

    get group() {
        return this.team.group;
    }

    get flag() {
        return this.team.flag;
    }

    public popNextWorm(): WormInstance {
        // Clear any dead worms
        this.nextWormStack = this.nextWormStack.filter((w) => w.health > 0);
        const [next] = this.nextWormStack.splice(0, 1);
        if (!next) {
            throw Error("Exhausted all worms from team");
        }
        this.nextWormStack.push(next);
        return next;
    }

    public consumeAmmo(code: IWeaponCode) {
        if (this.ammo[code] === 0) {
            throw Error("Cannot consume ammo, no ammo left");
        }
        if (this.ammo[code] === -1) {
            // Unlimited
            return;
        }
        this.ammo[code]--;
    }
}