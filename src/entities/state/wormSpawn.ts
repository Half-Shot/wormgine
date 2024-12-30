import { TeamGroup } from "../../logic/teams";
import { RecordedEntityState } from "../../state/model";

export interface WormSpawnRecordedState extends RecordedEntityState {
  type: "wormgine.worm_spawn";
  teamGroup: TeamGroup;
}
