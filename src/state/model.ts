import { TeamGroup } from "../logic/teams"
import { IWeaponCode } from "../weapons/weapon"

export interface RecordedEntityState {
    type: number,
    // Translation
    tra: {x: string, y: string},
    // Rotation
    rot: string,
    // Linear velocity
    vel: {x: string, y: string},
}


export enum StateRecordKind {
    Header,
    EntitySync,
    WormAction,
    WormSelectWeapon,
    GameState,
}

export interface StateRecordLine<T> {
    index: number,
    kind: StateRecordKind,
    data: T,
    ts: number,
}

export type StateRecordHeader = StateRecordLine<null>

export type StateRecordEntitySync = StateRecordLine<{
    entities: (RecordedEntityState&{uuid: string})[]
}>

export enum StateWormAction {
    MoveLeft,
    MoveRight,
    AimUp,
    AimDown,
    Stop,
    Fire,
    EndFire,
    Jump,
    Backflip,
}

export type StateRecordWormAction = StateRecordLine<{
    id: string,
    action: StateWormAction,
}>

export type StateRecordWormSelectWeapon = StateRecordLine<{
    id: string,
    weapon: IWeaponCode,
}>

export type StateRecordWormGameState = StateRecordLine<{
    teams: {
        group: TeamGroup,
        name: string,
        worms: {
            uuid: string,
            name: string,
            health: number,
            maxHealth: number,
        }[]
    }[],
    iteration: number,
    wind: number,
}>