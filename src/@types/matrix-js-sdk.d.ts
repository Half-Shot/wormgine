/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only
Please see LICENSE in the repository root for full details.
*/

import {
  GameConfigEvent,
  GameConfigEventType,
  GameStageEvent,
  GameStageEventType,
  FullGameStateEvent,
  PlayerAckEvent,
  PlayerAckEventType,
  GameStateEventType,
} from "../net/models";

// Extend Matrix JS SDK types via Typescript declaration merging to support unspecced event fields and types
declare module "matrix-js-sdk" {
  export interface StateEvents {
    [GameConfigEventType]: GameConfigEvent["content"];
    [GameStageEventType]: GameStageEvent["content"];
  }
  export interface TimelineEvents {
    [PlayerAckEventType]: PlayerAckEvent["content"];
    [GameStateEventType]: FullGameStateEvent["content"];
  }
}
