export enum CameraLockPriority {
    // Do not lock the camera to this object
    NoLock = 0,
    // Snap the camera to this object if the current player isn't local, but allow the user to move away.
    SuggestedLockNonLocal = 1,
    // Snap the camera to this object, but allow the user to move away.
    SuggestedLockLocal = 2,
    // Lock the camera to this object, but only suggest it to local players.
    LockIfNotLocalPlayer = 3,
    // Always lock the camera to this object.
    AlwaysLock = 4
}